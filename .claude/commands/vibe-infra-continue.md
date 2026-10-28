---
description: Resume the autonomous infra deployment mid-plan for the given component — invoked by /vibe-infra between components, never manually.
user-invocable: false
---
# /project:vibe-infra-continue

## Type
Pipeline Skill — invoked automatically between components in `/project:vibe-infra` autonomous mode.
Do not invoke manually.

## Autonomous Mode
You are resuming the infra deployment mid-plan. All autonomous-mode rules apply:

**Ignore every `Ask:`, "type continue", and "review and edit" instruction** — complete the component
and proceed. Do not pause unless a command fails, a blocker is hit, or the component reports DRIFT.

**Component advancement**: When the `infra-deploy` agent finishes this component, honor its terminal
state in `infra-checklist.md`:
- If the component header is `· ⚠️ DRIFT — needs review`, the deployed reality diverged from
  `infra-epic.md`. **STOP the autonomous run.** Do NOT advance and do NOT override the header. Surface
  `artifacts/infra/{component}/deploy-report.md` and wait for the user.
- Only if `· ✅ Done`: find the next `Planned` component in `infra-checklist.md` (in build order) and
  run `/project:vibe-infra-continue {next-component-id}`. If none remain, output the completion message
  (including any remaining manual gates) and stop.

## Rules — CRITICAL
- Infra discipline loads from `.claude/rules/infra-discipline.md` — never apply locally; CI/CD only.
- Bash discipline loads from `.claude/rules/bash-discipline.md` — binding for this session.

## Context Restore
The `SessionStart` hook injects `pipeline-state.md` into this session. Read it — it has the current
component, last completed stage, and next stage. If missing, fall back to `infra-checklist.md` — find
the first component header not `· ✅ Done`.

## Task
Update `infra-checklist.md`:
- Find the `{component-id}` header and change it to `· In Progress`.
- Do NOT mark the previous component `· ✅ Done` here — the `infra-deploy` agent owns each component's
  terminal state (`· ✅ Done` if verification passed, `· ⚠️ DRIFT — needs review` if it diverged).
  Never flip a `· ⚠️ DRIFT` header to Done.

Then spawn the **`infra-deploy` agent** (`.claude/agents/infra-deploy.md`) via the Agent tool for this
component. It resumes from the first unchecked stage in `infra-checklist.md` — do not restart from
Stage 1 if work is already done. The agent runs edit → dry-run → PR/push → watch Action → verify →
report, then returns its handoff.

When the agent completes this component, honor its verdict and advance (or halt) per **Component
advancement** above.
