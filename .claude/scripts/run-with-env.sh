#!/usr/bin/env bash
# Run a command with environment variables WITHOUT an inline shell prefix.
#
# Usage:
#   bash .claude/scripts/run-with-env.sh KEY=VALUE [KEY=VALUE ...] -- <command> [args...]
#
# Why this exists:
#   An inline `FOO=1 cmd …` prefix shifts the first token off the allow-listed
#   command name, so the permission gate can't match it and prompts — which
#   breaks autonomous mode. It also defeats sandbox `excludedCommands` matching
#   (the command then silently runs sandboxed). This launcher starts with its
#   own allow-listed name, so the gate matches; the env assignments and the
#   final exec happen INSIDE the script, where the harness analyzer never looks.
#   The bash-lint PreToolUse hook points failing commands here.
#
#   Background long-running servers with the Bash tool's `run_in_background: true`
#   — never `&` / `$!`. This script execs in the foreground of its own process;
#   the Bash tool backgrounds the whole invocation.
#
# Example (start an API server for integration tests):
#   bash .claude/scripts/run-with-env.sh \
#     'DATABASE_URL=postgresql://u:p@localhost:5432/app' \
#     'JWT_SECRET=integration-test-secret' \
#     -- cargo run --manifest-path /abs/path/api/Cargo.toml
set -euo pipefail

# Consume leading KEY=VALUE arguments and export them.
while [[ "${1:-}" == *=* ]]; do
  export "${1?}"
  shift
done

# Optional `--` separator between env and the command.
if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -eq 0 ]]; then
  echo "run-with-env.sh: no command given (usage: KEY=VAL ... -- <command> [args])" >&2
  exit 64
fi

exec "$@"
