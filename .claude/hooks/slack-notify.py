#!/usr/bin/env python3
"""Slack notifier hook — pings Slack when an unattended run needs attention.

Wired in settings.json to four events; branches on hook_event_name so one
script covers all. No .md / agent-instruction changes needed — detection is
entirely hook-driven.

  - PreToolUse : (matcher * — every tool) records the attempted tool call
    (tool_name + tool_input) to a per-session temp state file, then exits 0.
    Pure recorder — never blocks, never posts. Needed because the Notification
    payload carries no tool info and the transcript flushes the pending
    tool_use entry too late to read it at notification time.

  - Notification : Claude needs the user. Fires on elicitation_dialog and
    permission_prompt (AskUserQuestion surfaces as permission_prompt in current
    harness versions). Forwards the notification's own message text plus
    detail: primarily the PreToolUse-recorded call (fresh within 120s) — for
    AskUserQuestion the full question(s) and each option, otherwise the tool +
    key input (e.g. the exact Bash command or the file being written) — with
    a pending-call transcript scan as best-effort fallback.
    idle_prompt is deliberately NOT included —
    it fires every time you pause, which is pure noise in interactive use.
    (Under dontAsk, permission_prompt won't fire — it denies.)

  - SubagentStop : a TRACK agent finished with a halt. Scoped to the four
    pipeline track agents (pre-dev/backend/frontend/deployment) — the ones that
    emit failure-protocol halt markers. epic-conformance is excluded (it sends
    its own CONFORMANT/DRIFT Slack); helper agents (Explore, claude-code-guide,
    general-purpose, Plan) are excluded so spawning them interactively never
    pings. Scans the agent's final message for Contract Dispute / fix budget /
    BLOCKED.

  - Stop : the MAIN orchestrator stopped in a halted state. ON by default
    (SLACK_NOTIFY_ON_STOP defaults to "1"). Stop fires every turn, so set
    SLACK_NOTIFY_ON_STOP=0 in a repo's settings.local.json to silence it there
    (e.g. interactive harness-dev sessions that merely discuss halts); app/vibe
    repos leave it unset → a real orchestrator halt always pings. Same halt
    markers + per-session dedup.

Per-session dedup (temp state file keyed by session_id) prevents re-pinging the
same halt across repeated Stop/SubagentStop fires. Side-effect only: always
exits 0, never blocks a turn. Posts via notify-slack.sh (no-op if
SLACK_WEBHOOK_URL unset). BLOCKED is matched case-sensitively so a casual
"blocked by sandbox" operational note does not trip it.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time

NOTIFY = ".claude/scripts/notify-slack.sh"
# Ping on ANY Notification except known interactive noise. Allow-listing specific
# attention types (permission_prompt/elicitation_dialog) silently dropped questions
# whenever the harness renamed the type — so a question fired no Slack. Inverting the
# filter pings on permission_prompt, elicitation_dialog, AskUserQuestion, and any new/
# renamed attention type, suppressing only idle_prompt (fires on every pause = noise).
IGNORE_NOTIFICATION_TYPES = {"idle_prompt"}
TRACK_AGENTS = {"pre-dev", "backend", "frontend", "deployment"}
HALT = re.compile(r"Contract Dispute|fix budget|\bBLOCKED\b")


def slack(message):
    try:
        subprocess.run(["bash", NOTIFY, message], timeout=15)
    except Exception:
        pass  # notifications must never break a run


def last_assistant_text(path):
    """Text of the final assistant message in a transcript jsonl."""
    text = ""
    if not path:
        return text
    try:
        with open(path) as fh:
            for line in fh:
                try:
                    entry = json.loads(line)
                except Exception:
                    continue
                if entry.get("type") == "assistant" or entry.get("role") == "assistant":
                    msg = entry.get("message", entry)
                    content = msg.get("content")
                    if isinstance(content, list):
                        parts = [
                            c.get("text", "")
                            for c in content
                            if isinstance(c, dict) and c.get("type") == "text"
                        ]
                        if any(parts):
                            text = "\n".join(p for p in parts if p)
                    elif isinstance(content, str):
                        text = content
    except Exception:
        return ""
    return text


def format_questions(questions, limit=2800):
    """Numbered question list with every option, capped for the webhook payload."""
    if not questions:
        return ""
    lines = []
    for i, q in enumerate(questions, 1):
        if not isinstance(q, dict):
            continue
        suffix = " (multi-select)" if q.get("multiSelect") else ""
        lines.append("%d. %s%s" % (i, (q.get("question") or "").strip(), suffix))
        for opt in q.get("options", []):
            if not isinstance(opt, dict):
                continue
            label = (opt.get("label") or "").strip()
            desc = (opt.get("description") or "").strip()
            lines.append("    • %s — %s" % (label, desc) if desc else "    • %s" % label)
    block = "\n".join(lines)
    if len(block) > limit:
        block = block[:limit] + "…"
    return block


def fmt_tool_use(block, limit=400):
    """One-line summary of a tool_use block: tool name + its key input."""
    name = block.get("name", "tool")
    inp = block.get("input") or {}
    if name == "Bash":
        desc = (inp.get("description") or "").strip()
        cmd = (inp.get("command") or "").strip()
        line = "Bash: `%s`" % cmd
        if desc:
            line += " — %s" % desc
    elif name in ("Write", "Edit", "MultiEdit", "Read"):
        line = "%s: %s" % (name, inp.get("file_path", ""))
    elif name == "NotebookEdit":
        line = "%s: %s" % (name, inp.get("notebook_path", ""))
    else:
        try:
            args = json.dumps(inp, ensure_ascii=False)
        except Exception:
            args = str(inp)
        line = "%s: %s" % (name, args)
    if len(line) > limit:
        line = line[:limit] + "…"
    return line


def pending_tool_block(path, max_tools=4):
    """Format the pending tool call(s) — tool_use blocks with no tool_result yet.

    Best-effort fallback only: the transcript usually flushes the pending
    tool_use too late to appear here, so this mostly returns "". It can still
    catch an already-flushed long-running call (e.g. an Agent spawn).
    """
    if not path:
        return ""
    calls = []  # (tool_use_id, block) in transcript order
    resolved = set()
    try:
        with open(path) as fh:
            for line in fh:
                try:
                    entry = json.loads(line)
                except Exception:
                    continue
                msg = entry.get("message", entry)
                content = msg.get("content")
                if not isinstance(content, list):
                    continue
                for c in content:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") == "tool_use":
                        calls.append((c.get("id"), c))
                    elif c.get("type") == "tool_result":
                        resolved.add(c.get("tool_use_id"))
    except Exception:
        return ""
    pending = [b for cid, b in calls if cid not in resolved]
    if not pending:
        return ""
    lines = ["• " + fmt_tool_use(b) for b in pending[-max_tools:]]
    return "\n".join(lines)


def lasttool_path(session_id):
    return os.path.join(tempfile.gettempdir(), "slack-notify-lasttool-%s.json" % session_id)


def record_tool_request(session_id, tool_name, tool_input):
    """PreToolUse recorder: remember the call so a permission ping can show it."""
    if not session_id or not tool_name:
        return
    try:
        with open(lasttool_path(session_id), "w") as fh:
            json.dump({"tool_name": tool_name, "tool_input": tool_input or {}}, fh)
    except Exception:
        pass


def last_tool_request(session_id, max_age=120):
    """Detail line(s) for the PreToolUse-recorded call, if fresh enough.

    The permission prompt fires right after its PreToolUse, so a stale file
    (e.g. from an earlier turn) means we don't know the pending call — return
    "" and let the caller fall back rather than show a wrong command.
    """
    if not session_id:
        return ""
    path = lasttool_path(session_id)
    try:
        if time.time() - os.path.getmtime(path) > max_age:
            return ""
        with open(path) as fh:
            rec = json.load(fh)
    except Exception:
        return ""
    name = rec.get("tool_name") or ""
    inp = rec.get("tool_input") or {}
    if not name:
        return ""
    if name == "AskUserQuestion":
        return format_questions(inp.get("questions") or [])
    return "• " + fmt_tool_use({"name": name, "input": inp})


def already_notified(session_id, signature):
    """Per-session dedup so the same halt isn't pinged on repeated fires."""
    if not session_id:
        return False
    state = os.path.join(tempfile.gettempdir(), "slack-notify-%s.seen" % session_id)
    try:
        seen = set(open(state).read().splitlines()) if os.path.exists(state) else set()
    except Exception:
        seen = set()
    if signature in seen:
        return True
    try:
        with open(state, "a") as fh:
            fh.write(signature + "\n")
    except Exception:
        pass
    return False


def first_line(text):
    return next((ln for ln in text.strip().splitlines() if ln.strip()), "")[:300]


def main():
    try:
        data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)

    event = data.get("hook_event_name")
    sid = data.get("session_id", "")

    # Opt-in payload capture for diagnosing missed pings: set SLACK_NOTIFY_DEBUG=1
    # in settings.local.json env, trigger the action, then read the log file to see
    # the exact event + notification_type the harness sent. Value-gated (not mere
    # presence) so "0"/""/absent stays OFF — the example file can ship the key as a
    # documented-but-disabled knob without turning logging on for every clone.
    if os.environ.get("SLACK_NOTIFY_DEBUG", "").strip().lower() in ("1", "true", "yes", "on"):
        try:
            with open(os.path.join(tempfile.gettempdir(), "slack-notify-debug.log"), "a") as fh:
                fh.write(json.dumps({
                    "event": event,
                    "notification_type": data.get("notification_type"),
                    "type": data.get("type"),
                    "message": data.get("message"),
                }) + "\n")
        except Exception:
            pass

    if event == "PreToolUse":
        record_tool_request(sid, data.get("tool_name"), data.get("tool_input"))
        sys.exit(0)

    if event == "Notification":
        ntype = data.get("notification_type") or data.get("type") or ""
        if ntype not in IGNORE_NOTIFICATION_TYPES:
            msg = data.get("message") or "Claude Code is waiting for your input."
            detail = last_tool_request(sid)
            if not detail:  # fallback: transcript scan (usually lags behind live state)
                detail = pending_tool_block(data.get("transcript_path", ""))
            if detail:
                msg += "\n" + detail
            slack("\U0001F514 " + msg)
        sys.exit(0)

    if event == "SubagentStop":
        if data.get("agent_type") not in TRACK_AGENTS:
            sys.exit(0)
        text = last_assistant_text(data.get("transcript_path", ""))
        if text and HALT.search(text):
            sig = "sub:" + hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()
            if not already_notified(sid, sig):
                slack(
                    "⛔ Autonomous run HALTED — %s reported a blocker, needs review.\n%s"
                    % (data.get("agent_type", "agent"), first_line(text))
                )
        sys.exit(0)

    if event == "Stop":
        # On by default (SLACK_NOTIFY_ON_STOP defaults to "1"). Set it to "0" in a
        # repo's settings.local.json to silence that repo — e.g. an interactive
        # harness-dev session that merely discusses halts. App/vibe repos leave it
        # unset, so a real orchestrator halt always pings.
        if os.environ.get("SLACK_NOTIFY_ON_STOP", "1").strip().lower() in ("0", "false", "no", ""):
            sys.exit(0)
        text = last_assistant_text(data.get("transcript_path", ""))
        if text and HALT.search(text):
            sig = "main:" + hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()
            if not already_notified(sid, sig):
                slack("\U0001F6D1 Autonomous run stopped — needs review.\n%s" % first_line(text))
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
