#!/usr/bin/env python3
"""PreToolUse Write/Edit guard — keeps track agents out of shared harness internals.

Registered as a PreToolUse hook on Write|Edit|MultiEdit in each TRACK AGENT's
frontmatter (never in settings.json — the main/orchestrator session must stay
free to maintain the harness).

Track agents legitimately write only two things under `.claude/`:
  - `.claude/tech-stack-profile.md`   (the create-tech-stack-profile stage)
  - `.claude/agent-memory/<name>/…`   (each agent's persistent memory)
Everything else under `.claude/` is shared harness territory (scripts, hooks,
agents, rules, commands, skills, guidelines, roles, company, settings*). An app
agent must not mutate it — especially dangerous here because app repos symlink
`.claude/` into the harness, so one app's edit would leak to every app.

On a blocked write it exits 2 with the reason, so the agent stops trying to
"fix" an approval prompt by inventing a wrapper script (run-bruno.sh, etc.) and
instead raises the real need (allow-list the tool, or use run-with-env.sh).
"""

import json
import re
import sys

# Paths under .claude/ that track agents ARE allowed to write.
ALLOWED = (
    re.compile(r"^tech-stack-profile\.md$"),
    re.compile(r"^agent-memory/"),
    # Transient pipeline gate sentinels (e.g. .api-mock-gate, .ui-mock-gate,
    # .e2e-gate, .api-mock-gate-retries). Top-level dotfiles only — this does
    # NOT match `hooks/<name>-gate.py`, so the gate LOGIC stays protected while
    # agents may arm/clear the run-state the gates check.
    re.compile(r"^\.[a-z0-9-]+-gate(-retries)?$"),
)


def main():
    try:
        data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)  # unparseable → never block

    ti = data.get("tool_input") or {}
    path = ti.get("file_path") or ti.get("notebook_path") or ti.get("path") or ""
    if not path:
        sys.exit(0)

    # Match a `.claude/<rest>` segment anywhere in the path (handles relative,
    # absolute, and the app→harness symlink — the string carries `.claude/`
    # regardless of where the symlink points).
    m = re.search(r"(?:^|/)\.claude/(.+)$", path)
    if not m:
        sys.exit(0)  # not a .claude path → allow

    rest = m.group(1)
    if any(p.match(rest) for p in ALLOWED):
        sys.exit(0)  # app-owned file → allow

    sys.stderr.write(
        "BLOCKED: track agents may not modify shared harness internals "
        "(.claude/%s). Only .claude/tech-stack-profile.md and "
        ".claude/agent-memory/ are writable here.\n\n"
        "Do NOT invent a wrapper script to get a command past the approval "
        "gate. Instead:\n"
        "  - if a tool prompts, it must be allow-listed in settings.json — "
        "record it as a Blocker in track-handoffs.md for the user to add;\n"
        "  - for env vars / background servers, use the existing wrapper: "
        "bash .claude/scripts/run-with-env.sh KEY=VAL … -- <command>.\n"
        % rest
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
