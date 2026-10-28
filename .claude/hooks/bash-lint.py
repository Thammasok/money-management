#!/usr/bin/env python3
"""PreToolUse Bash linter — the ENFORCEMENT layer for bash-discipline.

`.claude/rules/bash-discipline.md` loads into every track subagent's context,
but a loaded rule is only advice: a non-compliant model can still emit a
command that trips the harness's approval gate and halts an autonomous run.
This hook makes the rule binding. It is registered as a `PreToolUse` hook in
each track agent's frontmatter (and in settings.json for the main session).

On a violation it writes the fix to stderr and exits 2 — which BLOCKS the
command and feeds the message back to the model, so the model retries with a
corrected command instead of stalling on a permission prompt. On anything
clean it exits 0 and the command runs normally.

Kept deliberately conservative: it blocks only the documented autonomous
breakers that each have a known safe alternative, to avoid false positives
that would nag legitimate commands.
"""

import json
import re
import sys


def main():
    try:
        data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)  # unparseable payload → never block

    # Only police Bash. (The matcher already scopes this, but be defensive.)
    if data.get("tool_name") not in (None, "Bash"):
        sys.exit(0)

    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not cmd.strip():
        sys.exit(0)

    s = cmd.strip()

    # Allow-listed scripts must be invoked in the EXACT relative form from the
    # project root (`bash .claude/scripts/<name>.sh …`). The allow-list (and
    # run-e2e's sandbox exclusion) match that literal string; an absolute or
    # otherwise-prefixed path won't match → approval prompt. A clean relative
    # invocation passes untouched (it legitimately carries KEY=VAL args and
    # contains sleeps/loops the analyzer never sees).
    GH_REDIRECT = (
        "BLOCKED by bash-discipline: GitHub-side `gh` commands (pr, issue, "
        "api, run, workflow, repo, release, …) are deny-listed in this repo "
        "— the call will be refused and stall the run. ALWAYS use the "
        "GitHub MCP tools instead (server `github`: `create_pull_request`, "
        "`get_pull_request`, `list_pull_requests`, `create_issue`, "
        "`list_workflow_runs`, …). If the tools aren't loaded, fetch them "
        'with ToolSearch (e.g. "+github pull request"). Only a standalone '
        "`gh auth status` is allowed as a CLI call. If the GitHub MCP is NOT "
        "connected in this session, do not retry gh — record the pending "
        "operation (e.g. the PR title/body) in the track handoff / for the "
        "next PAUSE and continue.\n"
    )

    m = re.match(r"^bash\s+(\S*/)?\.claude/scripts/(\S+\.sh)", s)
    if m:
        if m.group(1):  # a path prefix before .claude/scripts/ (absolute, ./, ../)
            script = m.group(2)
            sys.stderr.write(
                "BLOCKED by bash-discipline: invoke .claude/scripts/%s in the "
                "EXACT relative form from the project root — "
                "`bash .claude/scripts/%s …` — never an absolute or prefixed "
                "path. The allow-list matches the literal relative string; any "
                "other spelling prompts for approval (and run-e2e re-enters the "
                "sandbox). The wrapped command's own args may stay absolute.\n"
                % (script, script)
            )
            sys.exit(2)
        # run-with-env.sh wraps an arbitrary command (KEY=VAL … [--] <cmd>) and
        # is allow-listed, so it would EXECUTE a wrapped gh for real — police
        # the wrapped command before waving the wrapper through.
        if m.group(2) == "run-with-env.sh":
            rest = s.split()[2:]  # drop 'bash' + script path
            while rest and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", rest[0]):
                rest = rest[1:]
            if rest and rest[0] == "--":
                rest = rest[1:]
            if rest and rest[0] == "gh" and rest[1:3] != ["auth", "status"]:
                sys.stderr.write(GH_REDIRECT)
                sys.exit(2)
        sys.exit(0)

    # GitHub-side `gh` commands are deny-listed in settings.json: the call
    # would be refused with no useful guidance and the agent stalls ("I can't
    # open the PR"). Redirect to the GitHub MCP instead so the agent
    # self-corrects. Segment-aware like rule 3: catches gh at the start of any
    # chained (&&, ||, ;, |) or newline-separated segment, and behind an
    # env-var prefix. The only exception is a PURE standalone `gh auth status`
    # (no chaining — otherwise `gh auth status && gh pr …` sneaks through).
    gh_hit = re.search(
        r"(?m)(?:^|&&|\|\||;|\|)\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*gh\s", cmd
    )
    pure_auth_status = re.match(r"^gh\s+auth\s+status\b", s) and not re.search(
        r"(&&|\|\||;|\||\n)", s
    )
    if gh_hit and not pure_auth_status:
        sys.stderr.write(GH_REDIRECT)
        sys.exit(2)

    problems = []

    # 1) Leading env-var prefix:  FOO=bar cmd ...
    if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", s):
        problems.append(
            "Env-var prefix (`FOO=1 cmd …`): shifts the first token off the "
            "allow-listed command name → approval prompt. Pass env as ARGUMENTS "
            "to the wrapper instead:\n"
            "    bash .claude/scripts/run-with-env.sh KEY=VAL … -- <command>"
        )

    # 2) Backgrounding with `&` (at end of a line) or `$!`. A `&` mid-string
    #    (e.g. inside a quoted URL query) is intentionally NOT matched.
    if "$!" in cmd or re.search(r"(?<![&>])&[ \t]*(\n|$)", cmd):
        problems.append(
            "Backgrounding with `&` / `$!`: run long-lived processes with the "
            "Bash tool's `run_in_background: true` parameter instead — the "
            "harness tracks the PID and notifies you on exit."
        )

    # 3) Foreground sleep (top-level or chained)
    if re.search(r"(?:^|&&|\|\||;|\|)\s*sleep\s+\d", cmd):
        problems.append(
            "Foreground `sleep`: blocked in the sandbox and orphans processes. "
            "Wait on a condition with the Monitor tool (or an allow-listed poll "
            "script), never `sleep N`."
        )

    # 4) ANY `cd` — standalone or compound. The Bash tool persists the session's working
    #    directory across calls, so a stray `cd subdir/` poisons cwd: every later relative
    #    path (the hooks themselves, run-e2e.sh, `.claude/` refs, sandbox excludedCommands)
    #    then resolves from the wrong place and can hard-lock the whole session.
    if re.match(r"^cd(\s|$)", s):
        problems.append(
            "`cd` is forbidden — it persists the session's working directory, and a stray `cd` "
            "poisons cwd so later relative paths (hooks, scripts, `.claude/` refs) break and can "
            "lock the session. Use absolute paths directly; if you must change dir, do it inside "
            "an allow-listed `.claude/scripts/*.sh` (the analyzer never inspects a script's body)."
        )

    # 5) Heredoc (`<<EOF` / `<<-EOF` / `<<'EOF'`): a file-redirect the analyzer
    #    can't parse, AND it hangs forever in the sandbox waiting for a
    #    terminator that never arrives — the worst autonomous breaker.
    if re.search(r"<<-?\s*['\"]?[A-Za-z_]", cmd):
        problems.append(
            "Heredoc (`<<EOF …`): unanalyzable file-redirect that HANGS in the "
            "sandbox waiting for a terminator. Create the file with the Write "
            "tool, then run the command plain against that file (e.g. "
            "`git commit -F .git/COMMIT_MSG` after Write-ing the message)."
        )

    if problems:
        sys.stderr.write(
            "BLOCKED by bash-discipline (.claude/rules/bash-discipline.md). "
            "Fix and retry:\n\n- " + "\n- ".join(problems) + "\n"
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
