#!/bin/bash
# Saves a human-readable pipeline state snapshot before any context transition.
# Written to pipeline-state.md at project root — visible to the user.

SNAPSHOT="pipeline-state.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# --- Epic info ---
EPIC_NAME="(unknown)"
EPIC_GOAL=""
BUILD_ORDER=""
if [ -f "epic.md" ]; then
  EPIC_NAME=$(grep -m1 '^# ' epic.md | sed 's/^# //' | xargs)
  EPIC_GOAL=$(grep -m1 '^Goal:' epic.md | sed 's/^Goal:[[:space:]]*//' | xargs)
  BUILD_ORDER=$(awk '/^Build Order:/{ found=1; next } found && /^[[:space:]]*$/ && NR>1 { exit } found { print }' epic.md | head -10)
fi

# --- Current feature and stage from checklist ---
CURRENT_FEATURE=""
LAST_DONE="(none)"
NEXT_STAGE="(none)"
if [ -f "checklist.md" ]; then
  CURRENT_FEATURE=$(grep -m1 '## F-[0-9]*: .* · In Progress' checklist.md \
    | sed 's/## F-[0-9]*: \(.*\) · In Progress.*/\1/' | xargs)
  if [ -n "$CURRENT_FEATURE" ]; then
    LAST_DONE=$(grep '\[x\]' checklist.md | tail -1 | sed 's/.*\[x\][[:space:]]*//' | xargs)
    NEXT_STAGE=$(grep -m1 '\[ \]' checklist.md | sed 's/.*\[ \][[:space:]]*//' | xargs)
  fi
fi

# --- Feature status from checklist.md (one line per feature header) ---
STATUS_TABLE=""
if [ -f "checklist.md" ]; then
  STATUS_TABLE=$(grep '^## F-' checklist.md | sed 's/^## /- /')
fi

# --- Write snapshot ---
{
  echo "# Pipeline State Snapshot"
  echo "> Auto-saved: $TIMESTAMP"
  echo ""
  echo "## Project"
  echo "**$EPIC_NAME** — $EPIC_GOAL"
  echo ""
  echo "## Current State"
  if [ -n "$CURRENT_FEATURE" ]; then
    echo "- **Feature in progress**: \`$CURRENT_FEATURE\`"
    echo "- **Last completed stage**: $LAST_DONE"
    echo "- **Next stage**: $NEXT_STAGE"
  else
    echo "_No feature currently in progress._"
  fi
  echo ""
  echo "## Feature Status"
  if [ -n "$STATUS_TABLE" ]; then
    echo "$STATUS_TABLE"
  else
    echo "_See checklist.md_"
  fi
  echo ""
  echo "## Build Order"
  if [ -n "$BUILD_ORDER" ]; then
    echo "$BUILD_ORDER"
  else
    echo "_See epic.md_"
  fi
} > "$SNAPSHOT"

echo "📸 Pipeline state saved → $SNAPSHOT"
