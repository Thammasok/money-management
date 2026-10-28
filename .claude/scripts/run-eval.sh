#!/bin/bash
# Launch a dev server for the UX/UI evaluator agent, sandbox-safe.
#
# The evaluator drives a LIVE browser (Playwright + Chrome-DevTools MCP), so it
# needs the app(s) actually running. This is the ONLY sanctioned way for the
# evaluator to start a dev server -- it is allow-listed AND sandbox-excluded in
# settings.json exactly like run-e2e.sh, so Chromium / the dev server don't hit
# the macOS sandbox Mach-port error. Invoke it EXACTLY as
#   bash .claude/scripts/run-eval.sh <role> [ref-path] [ref-dev-cmd]
# from the project root -- never an absolute or ./-prefixed path (the allow-list
# and the sandbox exclusion match the literal relative string). Pass the ref
# dev command as a POSITIONAL ARG, never an env prefix -- a `FOO=bar bash ...`
# prefix is blocked by bash-lint, and routing through run-with-env.sh would
# break this script's sandbox exclusion (the launch command must START with the
# matched literal `bash .claude/scripts/run-eval.sh`).
#
# Roles:
#   target                        Start the GENERATED app's dev server (this
#                                 repo) on $EVAL_TARGET_PORT (default 3100).
#                                 Used in BOTH modes. The dev command is read
#                                 from .claude/tech-stack-profile.md (the
#                                 `EVAL_DEV_CMD:` line), so the script self-
#                                 configures per project -- the agent passes
#                                 nothing.
#   ref <ref-path> [ref-dev-cmd]  MIRROR mode only -- start the REFERENCE app
#                                 whose local directory is <ref-path> (the
#                                 `reference-frontend:` value from the feature's
#                                 epic.md entry) on $EVAL_REF_PORT (default
#                                 3101). The reference may be a DIFFERENT stack
#                                 than the target, so its launch command can't
#                                 be assumed: the evaluator explores <ref-path>
#                                 and passes its dev command as the third
#                                 positional arg, e.g.
#                                   ... ref ../design-ref-app "pnpm dev"
#                                 Reference deps are auto-installed (from the
#                                 lockfile) if node_modules is missing.
#
# The command blocks (runs the dev server in the foreground). The evaluator
# launches it with the Bash tool's run_in_background:true and waits for the
# port with the Monitor tool -- never a foreground sleep.
#
# Command-resolution order:
#   target: profile `EVAL_DEV_CMD:` line  >  `npm run dev`
#   ref:    <ref-dev-cmd> positional arg  >  profile line  >  `npm run dev`
# The chosen dev script MUST honor the $PORT env var this script exports
# (Vite: `vite --port $PORT`; Next: `next dev -p $PORT`; CRA reads PORT).
set -euo pipefail

# Read the frontend dev command from the tech-stack profile (the `EVAL_DEV_CMD:`
# line). Empty if the profile or the line is absent.
profile_dev_cmd() {
  local profile=".claude/tech-stack-profile.md"
  [ -f "$profile" ] || return 0
  sed -n 's/.*EVAL_DEV_CMD:[[:space:]]*//p' "$profile" | head -n1 | tr -d '`' | sed 's/[[:space:]]*$//'
}

# Pick an install command for a reference dir from its lockfile.
detect_install_cmd() {
  if [ -f "$1/pnpm-lock.yaml" ]; then echo "pnpm install"
  elif [ -f "$1/yarn.lock" ]; then echo "yarn install"
  else echo "npm install"; fi
}

ROLE="${1:-}"

case "$ROLE" in
  target)
    PORT="${EVAL_TARGET_PORT:-3100}"
    DEV_CMD="$(profile_dev_cmd)"
    [ -n "$DEV_CMD" ] || DEV_CMD="npm run dev"
    echo "🎯 evaluator target app → http://localhost:${PORT}  (${DEV_CMD})"
    export PORT
    # Run through a shell so a literal `$PORT` in the dev command expands (e.g. `vite --port $PORT`);
    # commands that instead read PORT from the env work too, since PORT is exported.
    exec bash -c "$DEV_CMD"
    ;;
  ref)
    REF_PATH="${2:-}"
    REF_DEV_CMD="${3:-}"
    if [ -z "$REF_PATH" ]; then
      echo "❌ role 'ref' needs a path: bash .claude/scripts/run-eval.sh ref <ref-path> [ref-dev-cmd]"
      exit 1
    fi
    if [ ! -d "$REF_PATH" ]; then
      echo "❌ reference frontend not found at: $REF_PATH"
      echo "   (check the feature's epic.md 'reference-frontend:' value)"
      exit 1
    fi
    PORT="${EVAL_REF_PORT:-3101}"
    DEV_CMD="$REF_DEV_CMD"
    [ -n "$DEV_CMD" ] || DEV_CMD="$(profile_dev_cmd)"
    [ -n "$DEV_CMD" ] || DEV_CMD="npm run dev"
    cd "$REF_PATH"
    if [ ! -d node_modules ]; then
      INSTALL_CMD="$(detect_install_cmd .)"
      echo "📦 installing reference deps (${INSTALL_CMD}) …"
      $INSTALL_CMD
    fi
    echo "🪞 evaluator reference app (${REF_PATH}) → http://localhost:${PORT}  (${DEV_CMD})"
    export PORT
    # Shell-expand a literal `$PORT` in the dev command (see the target branch).
    exec bash -c "$DEV_CMD"
    ;;
  *)
    echo "❌ usage: bash .claude/scripts/run-eval.sh <target|ref> [ref-path] [ref-dev-cmd]"
    exit 1
    ;;
esac
