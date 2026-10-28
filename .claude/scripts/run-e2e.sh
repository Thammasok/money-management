#!/bin/bash
# Run Playwright E2E tests, scoped to a feature and with a configurable reporter.
#
# Usage: bash .claude/scripts/run-e2e.sh [feature] [reporter]
#   feature   e2e subdirectory to scope to; omit (or "") to run the whole project.
#             In a monorepo where two sub-projects own the same feature id, qualify it:
#             `services/tag-to-pr:F-1`
#   reporter  playwright reporter; defaults to html
#
#   bash .claude/scripts/run-e2e.sh checkout               → npx playwright test e2e/checkout/ --reporter=html
#   bash .claude/scripts/run-e2e.sh checkout list          → npx playwright test e2e/checkout/ --reporter=list
#   bash .claude/scripts/run-e2e.sh "" list                → npx playwright test --reporter=list
#   bash .claude/scripts/run-e2e.sh services/app:F-1 list  → same, resolved in services/app/
#
# Worker count is NOT overridden here — playwright.config.ts (templates/playwright.config.ts)
# is the single source of truth for parallelism. A CLI --workers=100% override once spawned
# one Chromium per core and OOM-killed constrained machines on long autonomous runs.

set -euo pipefail

FEATURE="${1:-}"
REPORTER="${2:-html}"

# --- where should Playwright run from? -------------------------------------------------------
# This script is always invoked as `bash .claude/scripts/run-e2e.sh …` from the REPO ROOT — that
# exact spelling is what the sandbox's `excludedCommands` matches, so it cannot be invoked from
# somewhere more convenient. Historically it then assumed the app also lives at the repo root
# (`./e2e/{feature}`, `./playwright.config.ts`).
#
# In a monorepo that assumption is false and fails in two different ways:
#   - `e2e/{feature}/` does not exist at the root, so Playwright matches no tests; and
#   - a repo-root `playwright.config.ts` may belong to a DIFFERENT service, in which case the run
#     silently targets the wrong suite instead of failing.
# Both were observed in `ultron-orchestrator`, where `services/tag-to-pr/` and `services/evaluator/`
# each own an e2e tree and the root config belongs to the latter. The workaround in use was a set of
# machine-local absolute symlinks at the repo root — unportable, invisible to git, and silently
# wrong once a real root config appeared.
#
# Resolution order:
#   1. `PROJECT:FEATURE` — explicit, always wins, no searching
#   2. ./e2e/{feature}   — the single-app layout, behaviour unchanged
#   3. a search of sub-projects that own BOTH e2e/{feature} and their own playwright.config.ts
#
# Requiring the config alongside the suite keeps step 3 honest: a directory that merely contains a
# matching e2e tree is not a Playwright project and is skipped. And step 3 REFUSES on more than one
# match rather than picking the first — feature ids collide across sibling services (both of the
# repo above own `e2e/F-1/`), and picking alphabetically would reintroduce exactly the silent
# wrong-suite failure this resolution exists to prevent. Found by testing it, not by reasoning.
PROJECT_DIR="."
if [ -n "$FEATURE" ] && [ "${FEATURE#*:}" != "$FEATURE" ]; then
  PROJECT_DIR="${FEATURE%%:*}"
  FEATURE="${FEATURE#*:}"
  if [ ! -d "${PROJECT_DIR}/e2e/${FEATURE}" ]; then
    echo "run-e2e.sh: ${PROJECT_DIR}/e2e/${FEATURE}/ does not exist." >&2
    exit 1
  fi
  echo "📂 ${PROJECT_DIR}"
elif [ -n "$FEATURE" ] && [ ! -d "e2e/${FEATURE}" ]; then
  MATCHES=()
  for candidate in */ */*/; do
    [ -d "${candidate}e2e/${FEATURE}" ] || continue
    [ -f "${candidate}playwright.config.ts" ] || continue
    MATCHES+=("${candidate%/}")
  done
  case "${#MATCHES[@]}" in
    0)
      echo "run-e2e.sh: no e2e/${FEATURE}/ at the repo root, and no sub-project that owns both" >&2
      echo "            e2e/${FEATURE}/ and its own playwright.config.ts." >&2
      exit 1
      ;;
    1)
      PROJECT_DIR="${MATCHES[0]}"
      echo "📂 ${PROJECT_DIR}"
      ;;
    *)
      echo "run-e2e.sh: '${FEATURE}' is ambiguous — ${#MATCHES[@]} sub-projects own it:" >&2
      for m in "${MATCHES[@]}"; do echo "              ${m}" >&2; done
      echo "            Re-run qualified, e.g.: bash .claude/scripts/run-e2e.sh ${MATCHES[0]}:${FEATURE} ${REPORTER}" >&2
      exit 1
      ;;
  esac
fi

ARGS=()
[ -n "$FEATURE" ] && ARGS+=("e2e/${FEATURE}/")
ARGS+=("--reporter=${REPORTER}")

echo "🎭 playwright ${ARGS[*]}"
cd "$PROJECT_DIR"
npx playwright test "${ARGS[@]}"
