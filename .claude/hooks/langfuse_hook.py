#!/usr/bin/env python3.12
"""
Sends Claude Code traces to Langfuse after each response.

Dual-mode script:

1. Trace mode (default, no arguments) — Stop hook that parses the session
   transcript and sends turn traces to Langfuse.
   Opt-in: Only runs when TRACE_TO_LANGFUSE=true is set in project settings.

2. Wrap mode (`wrap <hook-name> -- <command...>`) — transparent wrapper
   around OTHER hooks (e.g. test-gate). Logs start/end events with exit
   code and duration to ~/.claude/logs/hook-events.jsonl, which trace mode
   reads to emit `Hook: <name>` spans inside the turn's trace. Passes the
   stdin payload through to the wrapped command and preserves its exit
   code, so blocking behavior is unaffected. Uses only the stdlib (no
   langfuse import), so it runs on bare python3. This script itself is
   never wrapped — the langfuse hook does not appear in its own traces.

Scope: Reads session_id/transcript_path from the hook's stdin payload and
traces ONLY the current session's new turns (no cross-project scanning).
When a turn spawned subagents (Agent/Task tool calls), their transcripts
(<transcript_dir>/<session_id>/subagents/agent-<id>.jsonl) are parsed and
nested as child spans under the `Tool: Agent` span — a `Subagent: <type>`
generation plus one span per tool call the subagent made (recursive for
agents spawning agents, depth-capped).

Timestamps: All spans carry REAL start/end times taken from transcript
message timestamps and hook event logs (via timed_span, which reaches into
the SDK's OTel tracer), so ordering, latency bars, and durations in the
Langfuse UI reflect what actually happened — not when the tracer ran.

Hook span placement: SubagentStop hook runs whose time window falls inside
a Tool: Agent span nest under that agent; other hooks (Stop, PreCompact,
SessionStart, ...) sit at turn level. Unmatched SubagentStop events come
from Claude Code's invisible background agents (summarizer etc.) and are
dropped as noise (debug-logged).

Resilience: If Langfuse is unavailable, traces are queued locally and
automatically drained on the next successful connection.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def import_langfuse():
    """Import and return the Langfuse class, or None if unavailable.

    Deferred so wrap mode never pays the import (or needs the package).
    Prevents local directories named "langfuse" (e.g., Docker Compose
    project dirs) from shadowing the real langfuse SDK via namespace
    package resolution by removing CWD and '' from sys.path during import.
    """
    original_path = sys.path[:]
    sys.path = [
        p
        for p in sys.path
        if p not in ("", ".") and Path(p).resolve() != Path.cwd().resolve()
    ]
    try:
        from langfuse import Langfuse

        return Langfuse
    except ImportError:
        print(
            "Error: langfuse package not installed. Run: pip install langfuse",
            file=sys.stderr,
        )
        return None
    finally:
        sys.path = original_path

# Configuration
LOG_FILE = Path.home() / ".claude" / "state" / "langfuse_hook.log"
STATE_FILE = Path.home() / ".claude" / "state" / "langfuse_state.json"
QUEUE_FILE = Path.home() / ".claude" / "state" / "pending_traces.jsonl"
DEBUG = os.environ.get("CC_LANGFUSE_DEBUG", "").lower() == "true"
HEALTH_CHECK_TIMEOUT = 2  # seconds
PERMISSION_EVENTS_FILE = Path.home() / ".claude" / "logs" / "permission-events.jsonl"
HOOK_EVENTS_FILE = Path.home() / ".claude" / "logs" / "hook-events.jsonl"


def log(level: str, message: str) -> None:
    """Log a message to the log file."""
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"{timestamp} [{level}] {message}\n")


def debug(message: str) -> None:
    """Log a debug message (only if DEBUG is enabled)."""
    if DEBUG:
        log("DEBUG", message)


def check_langfuse_health(host: str) -> bool:
    """Quick health check to see if Langfuse is reachable.

    Uses socket connection to avoid slow HTTP timeouts.
    """
    try:
        # Parse host to get hostname and port
        if host.startswith("http://"):
            host_part = host[7:]
            default_port = 80
        elif host.startswith("https://"):
            host_part = host[8:]
            default_port = 443
        else:
            host_part = host
            default_port = 443

        if ":" in host_part:
            hostname, port_str = host_part.split(":", 1)
            port = int(port_str.rstrip("/"))
        else:
            hostname = host_part.rstrip("/")
            port = default_port

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(HEALTH_CHECK_TIMEOUT)
        result = sock.connect_ex((hostname, port))
        sock.close()

        is_healthy = result == 0
        debug(
            f"Health check for {hostname}:{port} - {'OK' if is_healthy else 'FAILED'}"
        )
        return is_healthy
    except Exception as e:
        debug(f"Health check error: {e}")
        return False


def queue_trace(trace_data: dict) -> None:
    """Append a trace to the local queue file."""
    QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)
    trace_data["queued_at"] = datetime.now(timezone.utc).isoformat()
    with open(QUEUE_FILE, "a") as f:
        f.write(json.dumps(trace_data) + "\n")
    log(
        "INFO",
        f"Queued trace for session {trace_data.get('session_id', 'unknown')}, turn {trace_data.get('turn_num', '?')}",
    )


def load_queued_traces() -> list[dict]:
    """Load all pending traces from the queue file."""
    if not QUEUE_FILE.exists():
        return []

    traces = []
    try:
        with open(QUEUE_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    traces.append(json.loads(line))
    except (json.JSONDecodeError, IOError) as e:
        log("ERROR", f"Failed to load queue: {e}")
        return []

    return traces


def clear_queue() -> None:
    """Clear the queue file after successful drain."""
    if QUEUE_FILE.exists():
        QUEUE_FILE.unlink()
        debug("Queue cleared")


def drain_queue(langfuse: Langfuse) -> int:
    """Drain all queued traces to Langfuse. Returns count of drained traces."""
    traces = load_queued_traces()
    if not traces:
        return 0

    log("INFO", f"Draining {len(traces)} queued traces to Langfuse")

    drained = 0
    for trace_data in traces:
        try:
            create_trace(
                langfuse=langfuse,
                session_id=trace_data["session_id"],
                turn_num=trace_data["turn_num"],
                user_msg=trace_data["user_msg"],
                assistant_msgs=trace_data["assistant_msgs"],
                tool_results=trace_data["tool_results"],
                project_name=trace_data.get("project_name", ""),
                subagents_dir=Path(trace_data["subagents_dir"])
                if trace_data.get("subagents_dir")
                else None,
            )
            drained += 1
        except Exception as e:
            log("ERROR", f"Failed to drain trace: {e}")
            # If we fail mid-drain, rewrite remaining traces and exit
            remaining = traces[drained:]
            clear_queue()
            for remaining_trace in remaining:
                queue_trace(remaining_trace)
            return drained

    clear_queue()
    log("INFO", f"Successfully drained {drained} traces")
    return drained


def load_state() -> dict:
    """Load the state file containing session tracking info."""
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text())
    except (json.JSONDecodeError, IOError):
        return {}


def save_state(state: dict) -> None:
    """Save the state file."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def get_content(msg: dict) -> Any:
    """Extract content from a message."""
    if isinstance(msg, dict):
        if "message" in msg:
            return msg["message"].get("content")
        return msg.get("content")
    return None


def is_tool_result(msg: dict) -> bool:
    """Check if a message contains tool results."""
    content = get_content(msg)
    if isinstance(content, list):
        return any(
            isinstance(item, dict) and item.get("type") == "tool_result"
            for item in content
        )
    return False


def get_tool_calls(msg: dict) -> list:
    """Extract tool use blocks from a message."""
    content = get_content(msg)
    if isinstance(content, list):
        return [
            item
            for item in content
            if isinstance(item, dict) and item.get("type") == "tool_use"
        ]
    return []


def get_text_content(msg: dict) -> str:
    """Extract text content from a message."""
    content = get_content(msg)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(item.get("text", ""))
            elif isinstance(item, str):
                text_parts.append(item)
        return "\n".join(text_parts)
    return ""


def merge_assistant_parts(parts: list) -> dict:
    """Merge multiple assistant message parts into one."""
    if not parts:
        return {}

    merged_content = []
    for part in parts:
        content = get_content(part)
        if isinstance(content, list):
            merged_content.extend(content)
        elif content:
            merged_content.append({"type": "text", "text": str(content)})

    # Use the structure from the first part
    result = parts[0].copy()
    if "message" in result:
        result["message"] = result["message"].copy()
        result["message"]["content"] = merged_content
    else:
        result["content"] = merged_content

    return result


def extract_project_name(project_dir: Path) -> str:
    """Extract a human-readable project name from the Claude projects directory name.

    Directory names look like: -Users-doneyli-djg-family-office
    We extract the last segment as the project name.
    """
    dir_name = project_dir.name
    # Split on the path-encoded dashes and take the last non-empty segment
    parts = dir_name.split("-")
    # Rebuild: find the last meaningful project name
    # Pattern: -Users-<user>-<project-name> or -Users-<user>-<path>-<project-name>
    # Take everything after the username (3rd segment onward)
    if len(parts) > 3:
        # parts[0] is empty (leading dash), parts[1] is "Users", parts[2] is username
        project_parts = parts[3:]
        return "-".join(project_parts)
    return dir_name


def read_hook_input() -> tuple[str, Path, str] | None:
    """Read the Stop hook payload from stdin and resolve the current session.

    Claude Code passes JSON on stdin including session_id and transcript_path.
    Only the current session's transcript is processed — subagent transcripts
    and other projects/sessions are never touched.

    Returns: (session_id, transcript_path, project_name) or None
    """
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, IOError) as e:
        log("ERROR", f"Failed to read hook input from stdin: {e}")
        return None

    session_id = payload.get("session_id")
    transcript_path = payload.get("transcript_path")

    if not session_id or not transcript_path:
        log("ERROR", f"Hook input missing session_id/transcript_path: {payload}")
        return None

    transcript_file = Path(transcript_path).expanduser()
    if not transcript_file.exists():
        log("ERROR", f"Transcript not found: {transcript_file}")
        return None

    project_name = extract_project_name(transcript_file.parent)
    debug(
        f"Hook input: session {session_id}, transcript {transcript_file}, project {project_name}"
    )
    return (session_id, transcript_file, project_name)


def queue_turns_from_messages(
    messages: list,
    session_id: str,
    turn_count: int,
    project_name: str,
    subagents_dir: Path | None = None,
) -> int:
    """Parse messages into turns and queue them locally. Returns number of turns queued."""
    turns = 0
    current_user = None
    current_assistants = []
    current_assistant_parts = []
    current_msg_id = None
    current_tool_results = []

    for msg in messages:
        role = msg.get("type") or (msg.get("message", {}).get("role"))

        if role == "user":
            if is_tool_result(msg):
                current_tool_results.append(msg)
                continue

            # New user message - finalize previous turn
            if current_msg_id and current_assistant_parts:
                merged = merge_assistant_parts(current_assistant_parts)
                current_assistants.append(merged)
                current_assistant_parts = []
                current_msg_id = None

            if current_user and current_assistants:
                turns += 1
                turn_num = turn_count + turns
                queue_trace(
                    {
                        "session_id": session_id,
                        "turn_num": turn_num,
                        "user_msg": current_user,
                        "assistant_msgs": current_assistants,
                        "tool_results": current_tool_results,
                        "project_name": project_name,
                        "subagents_dir": str(subagents_dir) if subagents_dir else None,
                    }
                )

            current_user = msg
            current_assistants = []
            current_assistant_parts = []
            current_msg_id = None
            current_tool_results = []

        elif role == "assistant":
            msg_id = None
            if isinstance(msg, dict) and "message" in msg:
                msg_id = msg["message"].get("id")

            if not msg_id:
                current_assistant_parts.append(msg)
            elif msg_id == current_msg_id:
                current_assistant_parts.append(msg)
            else:
                if current_msg_id and current_assistant_parts:
                    merged = merge_assistant_parts(current_assistant_parts)
                    current_assistants.append(merged)
                current_msg_id = msg_id
                current_assistant_parts = [msg]

    # Process final turn
    if current_msg_id and current_assistant_parts:
        merged = merge_assistant_parts(current_assistant_parts)
        current_assistants.append(merged)

    if current_user and current_assistants:
        turns += 1
        turn_num = turn_count + turns
        queue_trace(
            {
                "session_id": session_id,
                "turn_num": turn_num,
                "user_msg": current_user,
                "assistant_msgs": current_assistants,
                "tool_results": current_tool_results,
                "project_name": project_name,
                "subagents_dir": str(subagents_dir) if subagents_dir else None,
            }
        )

    return turns


def get_permission_flags(session_id: str) -> list[dict]:
    """Read flagged permission events for the current session."""
    if not PERMISSION_EVENTS_FILE.exists():
        return []
    events = []
    try:
        for line in PERMISSION_EVENTS_FILE.read_text().strip().split("\n"):
            if not line:
                continue
            event = json.loads(line)
            if event.get("session_id") == session_id:
                events.append(event)
    except (json.JSONDecodeError, OSError):
        pass
    return events


def get_hook_events(session_id: str, last_line: int) -> tuple[list[dict], int]:
    """Read new hook events for this session beyond the stored line offset.

    Returns (events, total_line_count). The caller persists total_line_count
    as the new offset only after the events are attached to a trace, so
    nothing is lost if no trace is created this pass.
    """
    if not HOOK_EVENTS_FILE.exists():
        return [], last_line
    try:
        lines = HOOK_EVENTS_FILE.read_text().strip().split("\n")
    except OSError:
        return [], last_line
    total = len(lines)
    events = []
    for line in lines[last_line:]:
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("session_id") == session_id:
            events.append(event)
    return events, total


def pair_hook_events(events: list[dict]) -> list[dict]:
    """Collapse start/end pairs into end events; keep unmatched ones.

    An unmatched start means the hook is still running (e.g. test-gate runs
    in parallel with this tracer on Stop) — its end event attaches to the
    next turn's trace. An unmatched end pairs with a start consumed earlier.
    """
    collapsed = []
    pending_starts: dict = {}
    for evt in events:
        key = (evt.get("hook"), evt.get("hook_event"))
        if evt.get("phase") == "start":
            pending_starts[key] = evt
        else:
            pending_starts.pop(key, None)
            collapsed.append(evt)
    collapsed.extend(pending_starts.values())
    return collapsed


def get_subagent_hook_events(session_id: str) -> list[dict]:
    """Read and pair all hook events logged under a subagent's own session id.

    Stop hooks registered in agent frontmatter fire with the subagent's session
    id, not the main session's. This is used by emit_subagent_spans to collect
    those events and nest them under the correct subagent span.
    """
    if not session_id or not HOOK_EVENTS_FILE.exists():
        return []
    try:
        lines = HOOK_EVENTS_FILE.read_text().strip().split("\n")
    except OSError:
        return []
    events = []
    for line in lines:
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("session_id") == session_id:
            events.append(event)
    return pair_hook_events(events)


def wrap_mode(hook_name: str, command: list[str]) -> None:
    """Run a wrapped hook command, logging start/end events.

    Reads the hook payload from stdin, logs a start event, pipes the payload
    to the real hook (stdout/stderr inherited so hook output and blocking
    messages pass through untouched), logs an end event with exit code and
    duration, and exits with the wrapped hook's exit code.
    """
    payload_raw = sys.stdin.buffer.read()
    session_id = ""
    hook_event = ""
    try:
        payload = json.loads(payload_raw)
        session_id = payload.get("session_id", "")
        hook_event = payload.get("hook_event_name", "")
    except (json.JSONDecodeError, AttributeError):
        pass

    def emit(event: dict) -> None:
        # Never let event logging break the wrapped hook.
        try:
            HOOK_EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(HOOK_EVENTS_FILE, "a") as f:
                f.write(json.dumps(event) + "\n")
        except OSError as _emit_err:
            print(f"langfuse_hook wrap emit failed: {_emit_err} path={HOOK_EVENTS_FILE}", file=sys.stderr)

    start = datetime.now(timezone.utc)
    emit(
        {
            "session_id": session_id,
            "hook": hook_name,
            "hook_event": hook_event,
            "phase": "start",
            "ts": start.isoformat(),
        }
    )

    stdout_text = ""
    stderr_text = ""
    try:
        result = subprocess.run(command, input=payload_raw, capture_output=True)
        exit_code = result.returncode
        stdout_text = result.stdout.decode("utf-8", errors="replace").strip()
        stderr_text = result.stderr.decode("utf-8", errors="replace").strip()
        # Pass through so blocking messages still reach the agent/terminal.
        if stdout_text:
            sys.stdout.write(result.stdout.decode("utf-8", errors="replace"))
            sys.stdout.flush()
        if stderr_text:
            sys.stderr.write(result.stderr.decode("utf-8", errors="replace"))
            sys.stderr.flush()
    except OSError as e:
        print(f"langfuse_hook wrap: failed to run {command}: {e}", file=sys.stderr)
        exit_code = 1
        stderr_text = str(e)

    end = datetime.now(timezone.utc)
    end_event: dict = {
        "session_id": session_id,
        "hook": hook_name,
        "hook_event": hook_event,
        "phase": "end",
        "exit_code": exit_code,
        "duration_ms": int((end - start).total_seconds() * 1000),
        "ts": end.isoformat(),
    }
    if stdout_text:
        end_event["stdout"] = stdout_text
    if stderr_text:
        end_event["stderr"] = stderr_text
    emit(end_event)
    sys.exit(exit_code)


MAX_SUBAGENT_DEPTH = 3  # agents spawning agents: cap recursion


def parse_ts_ns(ts: str | None) -> int | None:
    """Parse an ISO timestamp (transcript `timestamp` / hook event `ts`)
    to epoch nanoseconds for OTel span times. Returns None if unparseable."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1_000_000_000)
    except (ValueError, TypeError):
        return None


@contextmanager
def timed_span(
    langfuse: Langfuse,
    name: str,
    start_ns: int | None = None,
    end_ns: int | None = None,
    as_type: str = "span",
    **kwargs,
):
    """Create a span/generation with REAL start/end times from the transcript.

    The Langfuse v3 SDK stamps spans with the wall clock at creation, but this
    tracer replays a finished turn after the fact — every span would get the
    same timestamp (shuffled ordering, 0s durations). This helper reaches one
    level into the SDK (`_otel_tracer` / `_create_observation_from_otel_span`)
    to pass explicit OTel timestamps, and falls back to the public API (wall
    clock) if those internals change. Children created inside the `with`
    block nest under this span via the OTel context.
    """
    if end_ns is not None and start_ns is not None and end_ns < start_ns:
        end_ns = start_ns
    try:
        otel_span = langfuse._otel_tracer.start_span(name=name, start_time=start_ns)
        obs = langfuse._create_observation_from_otel_span(
            otel_span=otel_span, as_type=as_type, **kwargs
        )
    except AttributeError:
        # SDK internals changed — degrade to wall-clock spans
        with langfuse.start_as_current_observation(
            name=name, as_type=as_type, **kwargs
        ) as obs:
            yield obs
        return
    from opentelemetry import trace as otel_trace_api

    try:
        with otel_trace_api.use_span(otel_span, end_on_exit=False):
            yield obs
    finally:
        obs.end(end_time=end_ns)


def parse_subagent_transcript(path: Path) -> dict | None:
    """Parse an agent-<id>.jsonl into model, prompt, final text, and tool calls.

    Subagent transcripts share the main transcript's message format: one
    initial user prompt, then assistant messages with tool_use blocks and
    user-typed tool_result messages. Returns None if unreadable.
    """
    try:
        lines = path.read_text().strip().split("\n")
    except OSError:
        return None

    prompt = ""
    model = "claude"
    final_text = ""
    first_ts = None
    last_ts = None
    session_id = ""
    assistant_msgs: list[dict] = []
    # tool_use_id -> (result content, toolUseResult metadata, result timestamp)
    results_by_id: dict[str, tuple] = {}

    for line in lines:
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = msg.get("timestamp")
        if ts:
            first_ts = first_ts or ts
            last_ts = ts
        if not session_id:
            session_id = msg.get("session_id", "")
        role = msg.get("type") or (msg.get("message", {}).get("role"))
        if role == "user":
            if is_tool_result(msg):
                content = get_content(msg)
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "tool_result":
                        results_by_id[item.get("tool_use_id", "")] = (
                            item.get("content"),
                            msg.get("toolUseResult"),
                            ts,
                        )
            elif not prompt:
                prompt = get_text_content(msg)
        elif role == "assistant":
            assistant_msgs.append(msg)
            if isinstance(msg.get("message"), dict) and msg["message"].get("model"):
                model = msg["message"]["model"]
            text = get_text_content(msg)
            if text:
                final_text = text

    tool_calls = []
    for amsg in assistant_msgs:
        for tc in get_tool_calls(amsg):
            tool_id = tc.get("id", "")
            output, tool_use_result, result_ts = results_by_id.get(
                tool_id, (None, None, None)
            )
            entry = {
                "name": tc.get("name", "unknown"),
                "input": tc.get("input", {}),
                "output": output,
                "id": tool_id,
                "start_ts": amsg.get("timestamp"),
                "end_ts": result_ts,
            }
            if isinstance(tool_use_result, dict) and tool_use_result.get("agentId"):
                entry["agent_id"] = tool_use_result["agentId"]
                entry["agent_type"] = tool_use_result.get("agentType")
            tool_calls.append(entry)

    return {
        "model": model,
        "prompt": prompt,
        "final_text": final_text,
        "tool_calls": tool_calls,
        "start_ts": first_ts,
        "end_ts": last_ts,
        "session_id": session_id,
    }


def emit_subagent_spans(
    langfuse: Langfuse,
    subagents_dir: Path | None,
    agent_id: str,
    agent_type: str | None = None,
    depth: int = 0,
) -> None:
    """Emit a subagent's activity as child spans of the current span.

    Must be called inside an open `Tool: Agent` span context so the
    generation and tool spans nest under it. Recurses for agents that
    spawned their own agents (depth-capped).
    """
    if not subagents_dir or depth >= MAX_SUBAGENT_DEPTH:
        return
    path = subagents_dir / f"agent-{agent_id}.jsonl"
    if not path.exists():
        debug(f"Subagent transcript not found: {path}")
        return
    parsed = parse_subagent_transcript(path)
    if not parsed:
        return

    with timed_span(
        langfuse,
        f"Subagent: {agent_type or 'agent'}",
        start_ns=parse_ts_ns(parsed["start_ts"]),
        end_ns=parse_ts_ns(parsed["end_ts"]),
        as_type="generation",
        model=parsed["model"],
        input={"role": "user", "content": parsed["prompt"]},
        output={"role": "assistant", "content": parsed["final_text"]},
        metadata={
            "source": "claude-subagent",
            "agent_id": agent_id,
            "agent_type": agent_type,
            "tool_count": len(parsed["tool_calls"]),
        },
    ):
        pass

    for tc in parsed["tool_calls"]:
        with timed_span(
            langfuse,
            f"Tool: {tc['name']}",
            start_ns=parse_ts_ns(tc.get("start_ts")),
            end_ns=parse_ts_ns(tc.get("end_ts")),
            input=tc["input"],
            metadata={
                "tool_name": tc["name"],
                "tool_id": tc["id"],
                "agent_id": agent_id,
            },
        ) as tool_span:
            tool_span.update(output=tc["output"])
            if tc.get("agent_id"):
                emit_subagent_spans(
                    langfuse,
                    subagents_dir,
                    tc["agent_id"],
                    tc.get("agent_type"),
                    depth + 1,
                )
    # Emit Stop hook spans from the subagent's own frontmatter Stop hooks
    # (e.g. unit-gate, component-gate, ui-mock-gate, e2e-gate). These were
    # logged by wrap_mode with the subagent's session_id — invisible to the
    # main session's get_hook_events — so we collect and nest them here.
    subagent_session_id = parsed.get("session_id", "")
    for evt in get_subagent_hook_events(subagent_session_id):
        emit_hook_span(langfuse, evt)

    debug(f"Created subagent spans for agent {agent_id} ({len(parsed['tool_calls'])} tools)")


def hook_event_window(evt: dict) -> tuple[int | None, int | None]:
    """Compute a hook event's real (start_ns, end_ns) span window."""
    evt_ns = parse_ts_ns(evt.get("ts"))
    if evt.get("phase") == "start" or evt_ns is None:
        return evt_ns, evt_ns
    # end event: ts marks completion, walk back by duration
    return evt_ns - int(evt.get("duration_ms", 0)) * 1_000_000, evt_ns


def emit_hook_span(langfuse: Langfuse, evt: dict) -> None:
    """Emit one hook execution as a span under the current OTel context."""
    start_ns, end_ns = hook_event_window(evt)
    with timed_span(
        langfuse,
        f"Hook: {evt.get('hook', 'unknown')}",
        start_ns=start_ns,
        end_ns=end_ns,
        input={
            "hook": evt.get("hook"),
            "hook_event": evt.get("hook_event"),
        },
        metadata={"source": "claude-hooks"},
    ) as hook_span:
        if evt.get("phase") == "start":
            hook_span.update(output={"status": "running"})
        else:
            output: dict = {
                "exit_code": evt.get("exit_code"),
                "duration_ms": evt.get("duration_ms"),
            }
            if evt.get("stdout"):
                output["stdout"] = evt["stdout"]
            if evt.get("stderr"):
                output["stderr"] = evt["stderr"]
            hook_span.update(output=output)
    debug(f"Created span for hook: {evt.get('hook')}")


def create_trace(
    langfuse: Langfuse,
    session_id: str,
    turn_num: int,
    user_msg: dict,
    assistant_msgs: list,
    tool_results: list,
    project_name: str = "",
    hook_events: list | None = None,
    subagents_dir: Path | None = None,
) -> None:
    """Create a Langfuse trace for a single turn using the new SDK API."""
    # Extract user text
    user_text = get_text_content(user_msg)

    # Extract final assistant text
    final_output = ""
    if assistant_msgs:
        final_output = get_text_content(assistant_msgs[-1])

    # Get model info from first assistant message
    model = "claude"
    if (
        assistant_msgs
        and isinstance(assistant_msgs[0], dict)
        and "message" in assistant_msgs[0]
    ):
        model = assistant_msgs[0]["message"].get("model", "claude")

    # Collect all tool calls and results
    all_tool_calls = []
    for assistant_msg in assistant_msgs:
        tool_calls = get_tool_calls(assistant_msg)
        for tool_call in tool_calls:
            tool_name = tool_call.get("name", "unknown")
            tool_input = tool_call.get("input", {})
            tool_id = tool_call.get("id", "")

            # Find matching tool result (and subagent linkage if any)
            tool_output = None
            tool_use_result = None
            result_ts = None
            for tr in tool_results:
                tr_content = get_content(tr)
                if isinstance(tr_content, list):
                    for item in tr_content:
                        if (
                            isinstance(item, dict)
                            and item.get("tool_use_id") == tool_id
                        ):
                            tool_output = item.get("content")
                            tool_use_result = tr.get("toolUseResult")
                            result_ts = tr.get("timestamp")
                            break

            entry = {
                "name": tool_name,
                "input": tool_input,
                "output": tool_output,
                "id": tool_id,
                "start_ts": assistant_msg.get("timestamp"),
                "end_ts": result_ts,
            }
            if isinstance(tool_use_result, dict) and tool_use_result.get("agentId"):
                entry["agent_id"] = tool_use_result["agentId"]
                entry["agent_type"] = tool_use_result.get("agentType")
                entry["agent_stats"] = {
                    "total_tokens": tool_use_result.get("totalTokens"),
                    "total_duration_ms": tool_use_result.get("totalDurationMs"),
                    "total_tool_use_count": tool_use_result.get("totalToolUseCount"),
                }
            all_tool_calls.append(entry)

    # Build tags list
    tags = ["claude-code"]
    if project_name:
        tags.append(project_name)

    # Real turn boundaries from transcript timestamps
    turn_start_ns = parse_ts_ns(user_msg.get("timestamp"))
    ts_candidates = [
        parse_ts_ns(m.get("timestamp")) for m in assistant_msgs + tool_results
    ]
    ts_candidates = [t for t in ts_candidates if t]
    turn_end_ns = max(ts_candidates) if ts_candidates else None

    # Create root span (implicitly creates a trace), then set trace-level attributes
    with timed_span(
        langfuse,
        f"Turn {turn_num}",
        start_ns=turn_start_ns,
        end_ns=turn_end_ns,
        input={"role": "user", "content": user_text},
        metadata={
            "source": "claude-code",
            "turn_number": turn_num,
            "project": project_name,
        },
    ) as trace_span:
        # Set session_id and tags on the underlying trace
        langfuse.update_current_trace(
            session_id=session_id,
            tags=tags,
            metadata={
                "source": "claude-code",
                "turn_number": turn_num,
                "session_id": session_id,
                "project": project_name,
            },
        )

        # Create generation for the LLM response
        with timed_span(
            langfuse,
            "Claude Response",
            start_ns=turn_start_ns,
            end_ns=turn_end_ns,
            as_type="generation",
            model=model,
            input={"role": "user", "content": user_text},
            output={"role": "assistant", "content": final_output},
            metadata={
                "tool_count": len(all_tool_calls),
            },
        ):
            pass

        # Create spans for tool calls; subagent calls get their transcript
        # nested underneath (generation + per-tool child spans).
        # SubagentStop hook runs that fired inside an agent's time window
        # nest under that agent's span; the rest land at turn level.
        consumed_hook_events: set[int] = set()
        for tool_call in all_tool_calls:
            metadata = {
                "tool_name": tool_call["name"],
                "tool_id": tool_call["id"],
            }
            if tool_call.get("agent_id"):
                metadata["agent_id"] = tool_call["agent_id"]
                metadata["agent_type"] = tool_call.get("agent_type")
                metadata["agent_stats"] = tool_call.get("agent_stats")
            with timed_span(
                langfuse,
                f"Tool: {tool_call['name']}",
                start_ns=parse_ts_ns(tool_call.get("start_ts")),
                end_ns=parse_ts_ns(tool_call.get("end_ts")),
                input=tool_call["input"],
                metadata=metadata,
            ) as tool_span:
                tool_span.update(output=tool_call["output"])
                if tool_call.get("agent_id"):
                    emit_subagent_spans(
                        langfuse,
                        subagents_dir,
                        tool_call["agent_id"],
                        tool_call.get("agent_type"),
                    )
                    # Nest SubagentStop hook runs that fired in this window
                    agent_start = parse_ts_ns(tool_call.get("start_ts"))
                    agent_end = parse_ts_ns(tool_call.get("end_ts"))
                    if agent_start and agent_end:
                        for evt in hook_events or []:
                            if id(evt) in consumed_hook_events:
                                continue
                            if evt.get("hook_event") != "SubagentStop":
                                continue
                            evt_start, _ = hook_event_window(evt)
                            # 5s grace: the stop hook can outlive the
                            # agent's result timestamp slightly
                            if evt_start and agent_start <= evt_start <= agent_end + 5_000_000_000:
                                emit_hook_span(langfuse, evt)
                                consumed_hook_events.add(id(evt))
            debug(f"Created span for tool: {tool_call['name']}")

        # Add remaining hook execution spans at turn level (logged by wrap
        # mode; this langfuse hook itself is never wrapped, so it never
        # appears in its own traces).
        # Unmatched SubagentStop events are dropped: a visible agent's gate
        # run always time-matches its Tool: Agent window above — what's left
        # comes from Claude Code's invisible background agents (summarizer
        # etc.), which is noise.
        for evt in hook_events or []:
            if id(evt) in consumed_hook_events:
                continue
            if evt.get("hook_event") == "SubagentStop":
                debug(
                    f"Dropped unmatched SubagentStop hook event "
                    f"(background agent): {evt.get('hook')} at {evt.get('ts')}"
                )
                continue
            emit_hook_span(langfuse, evt)

        # Add permission governance data
        perm_events = get_permission_flags(session_id)
        if perm_events:
            tags.append("has-permission-flags")
            langfuse.update_current_trace(tags=tags)
            flag_summary = {}
            for evt in perm_events:
                for flag in evt.get("flags", []):
                    flag_summary[flag] = flag_summary.get(flag, 0) + 1
            with langfuse.start_as_current_span(
                name="Permission Events",
                input={
                    "flagged_event_count": len(perm_events),
                    "flag_summary": flag_summary,
                },
                metadata={"source": "claude-governance"},
            ) as perm_span:
                perm_span.update(output={"events": perm_events})

        # Update trace with output
        trace_span.update(output={"role": "assistant", "content": final_output})

    debug(f"Created trace for turn {turn_num}")


def process_transcript(
    langfuse: Langfuse,
    session_id: str,
    transcript_file: Path,
    state: dict,
    project_name: str = "",
    hook_events: list | None = None,
    hook_events_offset: int | None = None,
    subagents_dir: Path | None = None,
) -> int:
    """Process a transcript file and create traces for new turns."""
    # Get previous state for this session
    session_state = state.get(session_id, {})
    last_line = session_state.get("last_line", 0)
    turn_count = session_state.get("turn_count", 0)

    # Read transcript
    lines = transcript_file.read_text().strip().split("\n")
    total_lines = len(lines)

    if last_line >= total_lines:
        debug(f"No new lines to process (last: {last_line}, total: {total_lines})")
        return 0

    # Parse new messages
    new_messages = []
    for i in range(last_line, total_lines):
        try:
            msg = json.loads(lines[i])
            new_messages.append(msg)
        except json.JSONDecodeError:
            continue

    if not new_messages:
        return 0

    debug(f"Processing {len(new_messages)} new messages")

    # Group messages into turns (user -> assistant(s) -> tool_results)
    completed_turns = []
    current_user = None
    current_assistants = []
    current_assistant_parts = []
    current_msg_id = None
    current_tool_results = []

    for msg in new_messages:
        role = msg.get("type") or (msg.get("message", {}).get("role"))

        if role == "user":
            # Check if this is a tool result
            if is_tool_result(msg):
                current_tool_results.append(msg)
                continue

            # New user message - finalize previous turn
            if current_msg_id and current_assistant_parts:
                merged = merge_assistant_parts(current_assistant_parts)
                current_assistants.append(merged)
                current_assistant_parts = []
                current_msg_id = None

            if current_user and current_assistants:
                completed_turns.append(
                    (current_user, current_assistants, current_tool_results)
                )

            # Start new turn
            current_user = msg
            current_assistants = []
            current_assistant_parts = []
            current_msg_id = None
            current_tool_results = []

        elif role == "assistant":
            msg_id = None
            if isinstance(msg, dict) and "message" in msg:
                msg_id = msg["message"].get("id")

            if not msg_id:
                # No message ID, treat as continuation
                current_assistant_parts.append(msg)
            elif msg_id == current_msg_id:
                # Same message ID, add to current parts
                current_assistant_parts.append(msg)
            else:
                # New message ID - finalize previous message
                if current_msg_id and current_assistant_parts:
                    merged = merge_assistant_parts(current_assistant_parts)
                    current_assistants.append(merged)

                # Start new assistant message
                current_msg_id = msg_id
                current_assistant_parts = [msg]

    # Process final turn
    if current_msg_id and current_assistant_parts:
        merged = merge_assistant_parts(current_assistant_parts)
        current_assistants.append(merged)

    if current_user and current_assistants:
        completed_turns.append(
            (current_user, current_assistants, current_tool_results)
        )

    # Create traces; hook events attach to the most recent turn
    turns = len(completed_turns)
    for idx, (user, assistants, tool_results) in enumerate(completed_turns):
        create_trace(
            langfuse,
            session_id,
            turn_count + idx + 1,
            user,
            assistants,
            tool_results,
            project_name,
            hook_events=hook_events if idx == turns - 1 else None,
            subagents_dir=subagents_dir,
        )

    # Update state
    session_state = state.get(session_id, {})
    new_session_state = {
        "last_line": total_lines,
        "turn_count": turn_count + turns,
        "updated": datetime.now(timezone.utc).isoformat(),
    }
    if turns > 0 and hook_events_offset is not None:
        # Hook events were attached (or none existed) — consume them
        new_session_state["hook_last_line"] = hook_events_offset
    else:
        # No trace created this pass — keep events for the next one
        new_session_state["hook_last_line"] = session_state.get("hook_last_line", 0)
    state[session_id] = new_session_state
    save_state(state)

    return turns


def trace_mode():
    script_start = datetime.now()
    debug("Hook started")

    # Check if tracing is enabled
    if os.environ.get("TRACE_TO_LANGFUSE", "").lower() != "true":
        debug("Tracing disabled (TRACE_TO_LANGFUSE != true)")
        sys.exit(0)

    # Check for required environment variables
    public_key = os.environ.get("CC_LANGFUSE_PUBLIC_KEY") or os.environ.get(
        "LANGFUSE_PUBLIC_KEY"
    )
    secret_key = os.environ.get("CC_LANGFUSE_SECRET_KEY") or os.environ.get(
        "LANGFUSE_SECRET_KEY"
    )
    host = os.environ.get("CC_LANGFUSE_HOST") or os.environ.get(
        "LANGFUSE_HOST", "https://cloud.langfuse.com"
    )

    if not public_key or not secret_key:
        log(
            "ERROR",
            "Langfuse API keys not set (CC_LANGFUSE_PUBLIC_KEY / CC_LANGFUSE_SECRET_KEY)",
        )
        sys.exit(0)

    # Load state
    state = load_state()

    # Resolve the current session from the hook's stdin payload
    hook_input = read_hook_input()
    if not hook_input:
        sys.exit(0)
    session_id, transcript_file, project_name = hook_input

    # Check if Langfuse is reachable
    langfuse_available = check_langfuse_health(host)

    if not langfuse_available:
        # Queue the current session's new turns locally
        log("WARN", f"Langfuse unavailable at {host}, queuing traces locally")

        session_state = state.get(session_id, {})
        last_line = session_state.get("last_line", 0)
        turn_count = session_state.get("turn_count", 0)

        total_turns_queued = 0
        try:
            lines = transcript_file.read_text().strip().split("\n")
            total_lines = len(lines)

            if last_line < total_lines:
                # Parse new messages and queue turns
                new_messages = []
                for i in range(last_line, total_lines):
                    try:
                        msg = json.loads(lines[i])
                        new_messages.append(msg)
                    except json.JSONDecodeError:
                        continue

                if new_messages:
                    total_turns_queued = queue_turns_from_messages(
                        new_messages,
                        session_id,
                        turn_count,
                        project_name,
                        subagents_dir=transcript_file.parent / session_id / "subagents",
                    )

                    # Update state even when queuing (preserve the hook
                    # events offset — they attach once Langfuse is back)
                    state[session_id] = {
                        "last_line": total_lines,
                        "turn_count": turn_count + total_turns_queued,
                        "updated": datetime.now(timezone.utc).isoformat(),
                        "hook_last_line": session_state.get("hook_last_line", 0),
                    }
        except Exception as e:
            debug(f"Error queuing session {session_id}: {e}")

        save_state(state)
        duration = (datetime.now() - script_start).total_seconds()
        log(
            "INFO",
            f"Queued {total_turns_queued} turns from session {session_id} in {duration:.1f}s",
        )
        sys.exit(0)

    # Langfuse is available - import SDK and initialize client
    Langfuse = import_langfuse()
    if Langfuse is None:
        sys.exit(0)

    try:
        langfuse = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
        )
    except Exception as e:
        log("ERROR", f"Failed to initialize Langfuse client: {e}")
        sys.exit(0)

    try:
        # First, drain any queued traces
        drained = drain_queue(langfuse)
        if drained > 0:
            langfuse.flush()

        # Collect hook events logged by wrap mode for this session
        session_state = state.get(session_id, {})
        hook_events, hook_events_offset = get_hook_events(
            session_id, session_state.get("hook_last_line", 0)
        )
        hook_events = pair_hook_events(hook_events)

        # Process the current session's transcript only
        total_turns = 0
        try:
            total_turns = process_transcript(
                langfuse,
                session_id,
                transcript_file,
                state,
                project_name,
                hook_events=hook_events,
                hook_events_offset=hook_events_offset,
                subagents_dir=transcript_file.parent / session_id / "subagents",
            )
            debug(f"Processed {total_turns} turns from session {session_id}")
        except Exception as e:
            log("ERROR", f"Failed to process session {session_id}: {e}")
            import traceback

            debug(traceback.format_exc())

        # Flush to ensure all data is sent
        langfuse.flush()

        # Log execution time
        duration = (datetime.now() - script_start).total_seconds()
        log(
            "INFO",
            f"Processed {total_turns} turns from session {session_id} (drained {drained} from queue) in {duration:.1f}s",
        )

        if duration > 180:
            log("WARN", f"Hook took {duration:.1f}s (>3min), consider optimizing")

    except Exception as e:
        log("ERROR", f"Failed to process transcripts: {e}")
        import traceback

        debug(traceback.format_exc())
    finally:
        langfuse.shutdown()

    sys.exit(0)


def main():
    # Dispatch: `wrap <hook-name> -- <command...>` instruments another hook;
    # no arguments runs the Langfuse tracer (Stop hook default).
    if len(sys.argv) > 1 and sys.argv[1] == "wrap":
        args = sys.argv[2:]
        if len(args) < 3 or args[1] != "--":
            print(
                "Usage: langfuse_hook.py wrap <hook-name> -- <command...>",
                file=sys.stderr,
            )
            sys.exit(1)
        wrap_mode(args[0], args[2:])
        return
    trace_mode()


if __name__ == "__main__":
    main()
