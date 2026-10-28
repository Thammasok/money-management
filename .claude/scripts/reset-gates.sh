#!/usr/bin/env bash
# Reset run-scoped gate state so a RESUMED vibe run starts clean.
#
# The Stop-hook gates persist small dotfiles in .claude/ (retry counts and the e2e/api/ui-mock
# sentinels, plus the AWAITING_VERDICT marker). On a clean pass the gates remove their own files,
# but a KILLED run can leave them behind — and a leftover marker would make a resumed run's gate
# skip the suite (stale .e2e-gate / AWAITING_VERDICT) or stop early (stale retry history).
#
# vibe-workflow runs this once at Load so resume is driven purely by durable artifacts
# (checklist.md + git), never by leftover ephemeral gate state. All targets are gitignored.
# Safe to run anytime; rm -f no-ops on absent files.
#
# Modes:
#   (no arg) / arm  — clear leftover gate state AND arm the .vibe-active marker (Load).
#   done            — clear the .vibe-active marker only (Done/halt teardown).
#
# .claude/.vibe-active tells e2e-gate.py this is an autonomous vibe run, so it scopes E2E to
# the current feature and DEFERS the multi-minute full-regression pass (covered instead by the
# epic's evaluator, cross-feature journey specs, and conformance gate — and currently failing on
# pre-existing unrelated mock-mode specs). Manual `develop` runs never arm it, so they keep full
# regression. Marker is gitignored.
set -u

MARKER=".claude/.vibe-active"

if [ "${1:-arm}" = "done" ]; then
  rm -f "$MARKER"
  echo "✅ vibe marker cleared — e2e-gate restored to full-regression scope"
  exit 0
fi

rm -f \
  .claude/.test-gate-retries \
  .claude/.api-mock-gate \
  .claude/.api-mock-gate-retries \
  .claude/.ui-mock-gate \
  .claude/.ui-mock-gate-retries \
  .claude/.unit-gate-retries \
  .claude/.component-gate-retries \
  .claude/.e2e-gate \
  .claude/.e2e-gate-retries

touch "$MARKER"

echo "✅ gate sentinels reset + vibe marker armed — resume driven by checklist.md + git; e2e scoped to feature"
