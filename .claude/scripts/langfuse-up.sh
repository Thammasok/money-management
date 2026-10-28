#!/usr/bin/env bash
# Bring up the local Langfuse stack and print the env vars to paste into
# .claude/settings.local.json. The keys are FIXED via LANGFUSE_INIT_* in
# docker-compose.langfuse.yml, so this output is always correct.
#
# Usage:  bash .claude/scripts/langfuse-up.sh   (from any directory)
# Stop:   docker compose -f <harness-root>/docker-compose.langfuse.yml down
set -euo pipefail

# Resolve the compose file relative to this script's REAL location, so the
# script works from any CWD — including an app repo whose
# .claude/ is a symlink into the nested harness clone. The compose file
# lives at the harness root, not the app root.
SCRIPT_PATH="$(readlink -f "$0" 2>/dev/null || echo "$0")"
HARNESS_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"
COMPOSE_FILE="$HARNESS_ROOT/docker-compose.langfuse.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ $COMPOSE_FILE not found — pull the latest harness (saas-factory) first."
  exit 1
fi

# Must match LANGFUSE_INIT_* in docker-compose.langfuse.yml.
LANGFUSE_HOST="http://localhost:3050"
LANGFUSE_PUBLIC_KEY="pk-lf-local-claude-code"
LANGFUSE_SECRET_KEY="sk-lf-local-3fe41d43d5384f16a19c8c2662e59671"

echo "🪼 Starting Langfuse (docker compose -f $COMPOSE_FILE up -d)…"
docker compose -f "$COMPOSE_FILE" up -d

echo "⏳ Waiting for Langfuse web at ${LANGFUSE_HOST} (first boot runs migrations, ~1–2 min)…"
UP=""
for _ in $(seq 1 90); do
  if curl -sf "${LANGFUSE_HOST}/api/public/health" >/dev/null 2>&1; then
    UP="yes"
    break
  fi
  sleep 2
done

if [ -z "$UP" ]; then
  echo "⚠️  Langfuse did not answer health yet. It may still be migrating — re-run this script, or check: docker compose -f $COMPOSE_FILE logs -f langfuse-web"
else
  echo "✅ Langfuse is up at ${LANGFUSE_HOST}"
fi

printf '\n──────────────────────────────────────────────\n'
printf 'Add to .claude/settings.local.json under "env" (git-ignored — never commit):\n\n'
printf '  "TRACE_TO_LANGFUSE": "true",\n'
printf '  "LANGFUSE_PUBLIC_KEY": "%s",\n' "$LANGFUSE_PUBLIC_KEY"
printf '  "LANGFUSE_SECRET_KEY": "%s",\n' "$LANGFUSE_SECRET_KEY"
printf '  "LANGFUSE_HOST": "%s"\n' "$LANGFUSE_HOST"
printf '\nUI: %s   login: local@claude-code.dev / localpassword123\n' "$LANGFUSE_HOST"
printf '──────────────────────────────────────────────\n'
