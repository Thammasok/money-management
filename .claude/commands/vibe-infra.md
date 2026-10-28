---
description: Run the fully autonomous infra deployment from a CONFIRMED infra plan — read infra-epic.md/infra-checklist.md and deploy every component through the gitops repo's CI/CD pipeline end-to-end without pauses. Requires a plan from /project:plan-infra first.
argument-hint: "[component-id | resume]"
disable-model-invocation: true
---
# /project:vibe-infra

## Stage
Pipeline Skill — the autonomous **infrastructure deployment** workflow. It reads a confirmed infra plan
and deploys it through the **gitops repo** this harness lives in, reading `ai-guidelines` (template) and the **target app repo** via the GitHub MCP. Planning is a separate workflow:
`/project:plan-infra` creates and confirms the plan; `vibe-infra` executes it. The actual `apply` is
always done by the GitHub Action (`infra-deploy.yml` / `backend-deploy.yml` / `frontend-deploy.yml`), never locally.

## Precondition — Plan Must Exist
Before anything else, check that `infra-epic.md` exists in the project root.
- **If `infra-epic.md` is missing** (or has no Components table): STOP and respond:
  > "No infra plan found. Run `/project:plan-infra \"<your infra requirement>\"` first — it creates the plan and lets you confirm/edit it. Then run `/project:vibe-infra` to deploy it."
  Do NOT create the plan here — `vibe-infra` never plans, it only executes a confirmed plan.

## Guard
If the user's input describes an **application feature** (UI/API/business logic) — stop and respond:

> "This looks like an app feature, not infrastructure. Use `/project:vibe` for features. For new infra components, plan them first with `/project:plan-infra`."

## Autonomous Mode
This skill runs the entire deployment without human checkpoints. When `/project:vibe-infra-continue`
and the `infra-deploy` agent run from here, **ignore every `Ask:`, "type continue", and "review and
edit" instruction** — complete each component and proceed. Do not pause unless a command fails, a
blocker is hit, or a component reports **DRIFT** (plan vs reality mismatch).

**Component advancement**: When a component's full deploy completes, honor its terminal state in
`infra-checklist.md`:
- If the just-finished component is `· ⚠️ DRIFT — needs review`, STOP and surface
  `artifacts/infra/{component}/deploy-report.md` (the plan and the deployed reality disagree — the
  user's call). Do not advance.
- Otherwise (`· ✅ Done`), find the next `Planned` component in `infra-checklist.md` (in build order)
  and run `/project:vibe-infra-continue {next-component-id}` in the same session. If none remain,
  output the completion message and stop.

## Rules — CRITICAL
- Infra discipline loads from `.claude/rules/infra-discipline.md` — **never apply locally; CI/CD only;
  master is protected; watch the Action; verify vs plan.**
- Bash discipline loads from `.claude/rules/bash-discipline.md` — binding for this orchestrator session.

## Input
Read:
- `infra-epic.md` — the confirmed plan: components, build order, gitops repo + target app repo/project
- `infra-checklist.md` — per-component stage status (source of truth for what's done / next)
- `pipeline-state.md` — if present (restored by the SessionStart hook), the current component & stage

## Task
Deploy the confirmed infra plan autonomously.
1. Verify the prerequisites listed in `infra-epic.md` are met (state bucket, WIF binding,
   seeded `bootstrap` secret, Artifact Registry). If a hard prerequisite is missing, STOP and report it.
2. Determine where to start from `infra-checklist.md`:
   - **Fresh plan** (nothing past Planned): start at the **walking-skeleton component** (first reachable cluster).
   - **Partially deployed**: first component header not `· ✅ Done` (skip `· ⚠️ DRIFT` → STOP and surface it).
   - Honor any `{component-id}` the user passed as the start.
3. Run `/project:vibe-infra-continue {component-id}`. It flips the component to `· In Progress`, spawns
   the `infra-deploy` agent (edit → dry-run → PR/push → watch Action → verify), then advances per the
   rules above.

## Done
When every component is `· ✅ Done`:
- Output: epic name and goal; components deployed (build order); the PR/Run URLs; confirmation every
  component verified against the plan; and any remaining **manual gates** (e.g. populate the
  the `bootstrap` secret) the user must still perform.

If a component is `· ⚠️ DRIFT — needs review`, stop there instead — report which component drifted and
point to its `artifacts/infra/{component}/deploy-report.md`.
