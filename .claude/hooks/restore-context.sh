#!/bin/bash
# Injects pipeline-state.md back into Claude's context after any context reset.
# Fires on PostCompact (same-session compaction) and SessionStart (new sessions).

SNAPSHOT="pipeline-state.md"

[ -f "$SNAPSHOT" ] || exit 0

echo "## Restored Pipeline Context"
echo ""
cat "$SNAPSHOT"
echo ""
echo "> Context restored from $SNAPSHOT — resume from the next stage listed above."
