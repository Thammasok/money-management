#!/usr/bin/env bash
# Post a message to Slack via an Incoming Webhook.
#
# Usage: bash .claude/scripts/notify-slack.sh "message text"
#
# Reads the webhook URL from SLACK_WEBHOOK_URL (set it in .claude/settings.local.json
# under "env", which is gitignored — never commit the URL).
#
# Graceful no-op: if SLACK_WEBHOOK_URL is unset, the script prints a notice and exits 0,
# so a clone without Slack configured still runs the pipeline end-to-end.
set -euo pipefail

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  echo "notify-slack: no message provided — nothing to send" >&2
  exit 0
fi

if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
  echo "notify-slack: SLACK_WEBHOOK_URL not set — skipping Slack notification (not an error)"
  exit 0
fi

# Build the JSON payload safely (handles quotes/newlines in the message) via python3.
export SLACK_MSG="$MESSAGE"
PAYLOAD="$(python3 -c 'import json,os; print(json.dumps({"text": os.environ["SLACK_MSG"]}))')"

HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-type: application/json' --data "$PAYLOAD" "$SLACK_WEBHOOK_URL")"

if [ "$HTTP_CODE" = "200" ]; then
  echo "notify-slack: sent (HTTP 200)"
else
  echo "notify-slack: Slack returned HTTP $HTTP_CODE" >&2
  # Do not fail the pipeline over a notification problem.
  exit 0
fi
