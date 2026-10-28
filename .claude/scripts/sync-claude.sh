#!/usr/bin/env bash
# Sync the harness .claude/ into a consumer app repo as REAL files (no symlinks).
#
# Why: the app repo used to symlink .claude/* into the nested harness clone
# (app-repo/.claude/skills -> ../saas-factory/.claude/skills). On Linux the
# sandbox (bubblewrap) cannot bind-mount through a symlink-to-directory —
# every dir symlink under .claude/ aborts sandbox init with
# "bwrap: Can't create file at .../.claude/<dir>: Is a directory" — which
# silently forced the whole pipeline to run unsandboxed. Real copies fix it;
# this script keeps the copies fresh after every harness pull.
#
# Usage (from anywhere):
#   bash saas-factory/.claude/scripts/sync-claude.sh [app-root]
#
#   app-root  the app repo containing .claude/ and the nested harness clone;
#             defaults to the parent directory of the harness clone this
#             script lives in (the app-repo/saas-factory layout).
#
# App-owned paths are NEVER touched: agent-memory/, tech-stack-profile.md,
# settings.local.json.
set -euo pipefail

SCRIPT_PATH="$(readlink -f "$0" 2>/dev/null || echo "$0")"
HARNESS_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/../.." && pwd)"
APP_ROOT="${1:-$(dirname "$HARNESS_ROOT")}"

SRC="$HARNESS_ROOT/.claude"
DEST="$APP_ROOT/.claude"

if [ "$APP_ROOT" = "$HARNESS_ROOT" ] || [ ! -d "$DEST" ]; then
  echo "❌ No app .claude/ at $DEST — pass the app root explicitly:"
  echo "   bash saas-factory/.claude/scripts/sync-claude.sh /path/to/app"
  exit 1
fi

# Directories the harness owns in the app repo.
DIRS="agents commands company guidelines hooks roles rules scripts skills workflows"
# Files the harness owns in the app repo (under .claude/).
FILES="settings.json srt-settings.json"
# Files the harness owns at the app repo ROOT (alongside .claude/, not inside it).
ROOT_FILES=".mcp.json"

HAVE_RSYNC=""
command -v rsync >/dev/null && HAVE_RSYNC=1

for d in $DIRS; do
  [ -e "$SRC/$d" ] || { echo "  ⚠️  $d missing in harness — skipped"; continue; }
  # A leftover symlink must be removed first: a copy would follow it and
  # write straight back into the harness clone through the link.
  [ -L "$DEST/$d" ] && rm "$DEST/$d"
  if [ -n "$HAVE_RSYNC" ]; then
    mkdir -p "$DEST/$d"
    rsync -a --delete "$SRC/$d/" "$DEST/$d/"
  else
    # cp fallback: remove + recopy gives the same --delete semantics.
    rm -rf "$DEST/$d"
    cp -R "$SRC/$d" "$DEST/$d"
  fi
  echo "  ✓ $d"
done

for f in $FILES; do
  [ -e "$SRC/$f" ] || { echo "  ⚠️  $f missing in harness — skipped"; continue; }
  [ -L "$DEST/$f" ] && rm "$DEST/$f"
  cp "$SRC/$f" "$DEST/$f"
  echo "  ✓ $f"
done

# Root-level files: source is the harness clone root, dest is the app repo root.
for f in $ROOT_FILES; do
  [ -e "$HARNESS_ROOT/$f" ] || { echo "  ⚠️  $f missing in harness root — skipped"; continue; }
  [ -L "$APP_ROOT/$f" ] && rm "$APP_ROOT/$f"
  cp "$HARNESS_ROOT/$f" "$APP_ROOT/$f"
  echo "  ✓ $f (root)"
done

LEFT="$(find "$DEST" -maxdepth 1 -type l 2>/dev/null)"
if [ -n "$LEFT" ]; then
  echo "⚠️  Symlinks still present under $DEST (sandbox may reject them):"
  echo "$LEFT"
fi

echo "✅ Synced $SRC → $DEST (real files). Restart Claude sessions to pick up changes."
