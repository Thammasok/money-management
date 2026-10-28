---
description: Resume the autonomous vibe pipeline mid-epic for the given feature — invoked by /vibe between features, never manually.
user-invocable: false
---
# /project:vibe-continue

## Type
Pipeline Skill — invoked automatically between features in vibe autonomous mode. Do not invoke manually.

## Autonomous Mode
You are resuming the vibe pipeline mid-epic. All autonomous mode rules apply:

**Ignore every `Ask:`, "type continue", and "review and edit" instruction** — complete each stage and immediately proceed to the next. Do not pause for any reason unless a command fails or a blocker is encountered.

**Feature advancement**: When `/project:develop` finishes this feature, do not wait for input — BUT first honor the epic-conformance verdict (the 5th track agent runs at the end of `develop`):
- If the just-finished feature's header in `checklist.md` is `· ⚠️ DRIFT — needs review`, the feature diverged from `epic.md`. **STOP the autonomous run.** Do NOT advance and do NOT override the header. Surface `artifacts/{feature-name}/11-conformance-report.md` to the user (Slack was already pinged) and wait for them to reconcile plan vs code.
- Only if the header is `· ✅ Done` (conformant): find the next `Planned` feature in `checklist.md` (in build order) and run `/project:vibe-continue {next-feature-name}`. If none remain, tear down the backing services (`docker compose -f docker-compose.backing-service.yml down` — finished stacks lingering in Docker's small VM have caused OOM kills), then output the epic completion message and stop.

## Re-Verification — CRITICAL
If the user asks to re-test an already-implemented feature (all checklist stages `[x]`), do NOT run test suites or debug failures in this session. Route it through `/project:develop`, which spawns the **frontend agent in re-verification mode** (Stages 13, 21, 25, Fix Budget enforced) — or, for a `backend-only` feature (no frontend agent exists, and Stages 21/25 are N/A), the **backend agent** re-running its Bruno suite at Stage 13. The orchestrator only relays the agent's summary. Running E2E inline bypasses the Fix Budget and bloats this session's context.

## Bash Rules — CRITICAL
Bash discipline rules load automatically from `.claude/rules/bash-discipline.md` — they are binding and cover this orchestrator session too, not just track agents (setup, git, docker, one-off checks).

## Context Restore
The `SessionStart` hook has already injected `pipeline-state.md` into this session. Read it — it contains the current feature, last completed stage, and next stage. If `pipeline-state.md` is missing, fall back to reading `checklist.md` directly — find the first feature header not marked `· ✅ Done`.

## Task
Update `checklist.md`:
- Find the `{feature-name}` header and change it to `· In Progress`
- Do NOT mark the previous feature `· ✅ Done` here — the `epic-conformance` agent at the end of `develop` owns each feature's terminal state (`· ✅ Done` if conformant, `· ⚠️ DRIFT — needs review` if it diverged). Never flip a `· ⚠️ DRIFT` header to Done.

Then run `/project:develop {feature-name}`. The pipeline will resume from the first unchecked stage in `checklist.md` — do not restart from Stage 1 if work is already done.

When `develop` completes this feature, honor the conformance verdict and advance (or halt) as described under **Feature advancement** above.
