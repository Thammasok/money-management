---
description: Run the fully autonomous XP pipeline from a CONFIRMED epic plan — read epic.md/checklist.md and build every feature end-to-end without pauses. Requires a plan from /project:plan-epic first.
argument-hint: "[feature-name | resume]"
disable-model-invocation: true
---
# /project:vibe

## Stage
Pipeline Skill — the autonomous **implementation** workflow. It reads an existing, confirmed epic plan and builds it. Planning is a separate workflow: `/project:plan-epic` creates and confirms the plan; `vibe` executes it.

## Precondition — Plan Must Exist
Before anything else, check that `epic.md` exists in the project root.
- **If `epic.md` is missing** (or has no Features table): STOP and respond:
  > "No epic plan found. Run `/project:plan-epic \"<your product idea>\"` first — it creates the plan and lets you confirm/edit it. Then run `/project:vibe` to build it."
  Do NOT create the epic here — `vibe` never plans, it only implements a confirmed plan.

## Guard
If the user's input describes a fix, rename, removal, refactor, or change to existing behavior — stop and respond:

> "This looks like a fix or refactor, not feature implementation. Use `/project:task` — it classifies the work (bugfix/chore/research) and runs the right-sized pipeline — or `/develop` for a single new feature."

To add **new capabilities** to the epic, plan them first with `/project:plan-epic` (it appends features to `epic.md`), then run `/project:vibe` to build them.

## Autonomous Mode
This skill runs the entire pipeline without human checkpoints. When `/project:develop` and all pipeline sub-skills are invoked from here, **ignore every `Ask:`, "type continue", and "review and edit" instruction** — complete each stage and immediately proceed to the next. Do not pause for any reason unless a command fails, a blocker is encountered, or the epic-conformance gate reports DRIFT.

**Feature advancement**: When a feature's full pipeline completes, do not stop — honor the epic-conformance verdict (the gate at the end of `/project:develop`):
- If the just-finished feature is marked `· ⚠️ DRIFT — needs review` in `checklist.md`, STOP and surface `artifacts/{feature}/11-conformance-report.md` to the user (the plan and the build disagree — that is the user's call). Do not advance.
- Otherwise (`· ✅ Done`), find the next `Planned` feature in `checklist.md` (in build order) and run `/project:vibe-continue {next-feature-name}` in the same session — context stays small because each track runs in its own subagent and `pipeline-state.md` is restored after any compaction. If no planned features remain, output the epic completion message and stop.

## Re-Verification — CRITICAL
If the user asks to re-test an already-implemented feature (all checklist stages `[x]`), do NOT run test suites or debug failures in this session. Route it through `/project:develop`, which spawns the **frontend agent in re-verification mode** (Stages 13, 21, 25, Fix Budget enforced). The orchestrator only relays the agent's summary. Running E2E inline bypasses the Fix Budget and bloats this session's context.

## Bash Rules — CRITICAL
Bash discipline rules load automatically from `.claude/rules/bash-discipline.md` — they are binding and cover this orchestrator session too, not just track agents (setup, git, docker, one-off checks).

## Input
Read:
- `epic.md` — the confirmed plan: features, build order, shared entities, conventions
- `checklist.md` — per-feature stage status (source of truth for what is done / next)
- `pipeline-state.md` — if present (restored by the SessionStart hook), the current feature and next stage

## Task
Implement the confirmed epic plan autonomously.

1. Verify `.claude/tech-stack-profile.md` exists. If not, run `/project:create-tech-stack-profile` first — all pipeline skills require it.
2. Determine where to start from `checklist.md`:
   - **Fresh epic** (no feature past Planned): start at **F-1** (the walking skeleton).
   - **Partially built**: find the first feature header that is not `· ✅ Done` (skip any `· ⚠️ DRIFT — needs review` → that one needs the user, so STOP and surface it).
   - Honor any `{feature-name}` the user passed as the starting feature.
3. Run `/project:vibe-continue {feature-name}` for that feature. `vibe-continue` flips the feature to `· In Progress`, runs `/project:develop` (every track this feature has + the epic-conformance gate), then advances per the rules above. A feature whose `Surface` in the `epic.md` Features table is `backend-only` has no frontend track and no live-evaluation gate; one whose `Surface` is `frontend-only` has no backend track — `develop` reads the column per feature and scopes itself; pre-dev, deployment, and the conformance gate always run; see `develop.md` § Feature Surface. Missing/blank column = `full`.

## Done
When every feature is `· ✅ Done` (epic complete):
1. **Tear down the backing services**: `docker compose -f docker-compose.backing-service.yml down` (skip if the file doesn't exist). Nothing needs them after the epic, and finished stacks lingering in Docker Desktop's small VM have OOM-killed it during long unattended runs.
2. Output:
   - Epic name and goal
   - Features delivered (build order)
   - Confirmation all features passed the epic-conformance gate

If a feature is `· ⚠️ DRIFT — needs review`, stop there instead — report which feature drifted and point to its `11-conformance-report.md`. Leave the backing services UP in this case: the user needs them to review the drift.
