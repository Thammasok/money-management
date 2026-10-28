---
description: Run the full 28-stage XP pipeline for one feature by spawning the track agents (pre-dev, backend, frontend, deployment) sequentially, then the epic-conformance gate.
argument-hint: "[feature-name]"
---
# /project:develop

## Type
Orchestrator — runs the full XP development pipeline by spawning one subagent per track, pausing between tracks (develop mode).

## Usage
```
/project:develop {feature-name}
```

> **Artifacts dir naming:** every `artifacts/{feature-name}/…` path below resolves to the feature's **ID** (`artifacts/F-12/…`), never its title — feature titles may contain `/` (a path separator) and would create broken nested directories. Pass the same `artifacts/F-XX/` directory explicitly to every track agent you spawn.

## Prerequisites
The only required input is the feature's problem statement, which normally lives in the feature's `epic.md` entry. You do **not** need to hand-write `01-requirements.md` first — Stage 1 (`/project:gather-requirements`) generates it from `epic.md` (plus any notes you pass) and self-validates in one pass.

Optional:
- If `artifacts/{feature-name}/01-requirements.md` already exists (e.g. you drafted it from `templates/requirements.md`), Stage 1 refines it in place instead of generating from scratch.
- Each requirements file should end up with: user stories, API endpoints (with input/output), and UI component IDs — Stage 1 produces these.

## Overview
This orchestrator drives the entire development lifecycle from requirements through deployment. It spawns the feature's track agents sequentially — all four for a `full` feature, three when the feature's `Surface` drops the backend or frontend track (see Feature Surface below); in develop mode it pauses after each track for human review and editing (vibe mode skips all pauses).

## Setup
1. Ensure `epic.md` describes this feature (or the user has passed a problem statement). `01-requirements.md` does not need to exist yet — Stage 1 generates it. If it already exists, Stage 1 refines it.
2. Verify `.claude/tech-stack-profile.md` exists. If not, run `/project:create-tech-stack-profile` first — this file is required by all pipeline skills. Use `templates/tech-stack-profile.md` as the template.
3. Read `.claude/tech-stack-profile.md` — this maps pseudocode in skills to concrete implementations for this project, including the Architecture Pattern that defines layer roles.
4. Load the pipeline configuration from this file.
5. Create and checkout a feature branch: `git checkout -b feat/{feature-name}` (skip if already on it).
6. In `checklist.md`, change the current feature's header from `· Planned` to `· In Progress`.
7. Check `checklist.md` for this feature. If any stages are already marked `[x]`, skip to the first unchecked stage. Otherwise begin at Stage 1.
8. **If ALL stages are already `[x]`** (the feature is fully implemented) and the user asked to re-test or re-verify: do NOT run any test suite in this session. Spawn the **frontend** agent in re-verification mode — see "Re-verification runs in an agent" below. This is the only correct path; running E2E inline is a rule violation.

## Git Strategy
Binding rules: `.claude/rules/git-flow.md` — two long-lived branches (`develop` = dev env, deploys on every push; `main`/`master` = prod, deploys on a human-cut tag), nobody commits on either; work flows working branch → merge into `develop` (dev testing) **and** working branch → PR → release branch, never via `develop`.
- **Branch**: `feat/{feature-name}` off the release branch — created at pipeline start, all commits go here.
- **Commit after every track completes** — the **main session** runs git, the track agents do not (see Execution Model exceptions). This assigns *which actor* commits, so two agents never race on the index; it is **not** a statement that git is unavailable. Use message: `feat({feature-name}): {track-name} track — {one-line summary}`.
- **Stage only the relevant files** for that track — never `git add .` blindly.
- **Ship after the backend, frontend, and deployment tracks** — every track that lands runnable code (pre-dev only adds the failing-by-design e2e contract; commit it, nothing to deploy). Shipping = `git push -u origin feat/{feature-name}`, then the **merge-into-develop sequence** from `git-flow.md` (`git fetch origin` → `git checkout -B develop origin/develop` → `git merge --no-ff feat/{feature-name} -m "…"` → `git push origin develop` → `git checkout feat/{feature-name}`; one command per call; a conflict → `git merge --abort`, back to the feature branch, Blocker in `track-handoffs.md`, Slack ping, continue — never resolve it).
- **PR to the release branch — opened once, after the feature's first code-bearing track**: the **backend** track (Stage 14 done) for a `full` or `backend-only` feature, or the **frontend** track (Stage 25 done) for a `frontend-only` feature, which has no backend track at all. Via the **GitHub MCP** `create_pull_request` (head `feat/{feature-name}`, base the repo default `main`/`master` — never `develop`; title `feat({feature-name})`, body per `templates/pr-body.md` with a `- Dev:` line). Later track commits land on the same branch, so the open PR picks them up — no second PR. NEVER the `gh` CLI — GitHub-side `gh` commands are deny-listed and bash-lint blocks them. If the GitHub MCP is not connected, don't retry — note the pending PR at the track PAUSE and continue.
- Never force-push. Never commit on `develop` or the release branch. Never merge `develop` into the feature branch. Never tag — a human cuts `vX.Y.Z` on the release branch after the PR merges.

## Execution Model: Subagent per Track

Spawn one subagent per pipeline track using the **Agent tool**, referencing the agent definition in `.claude/agents/`. Each agent runs all its stages autonomously and appends its section to `artifacts/{feature-name}/track-handoffs.md` when done.

**Execution order — strictly sequential. Never parallel.**
```
1. Agent(pre-dev)          for feature '{feature-name}' → wait → git commit
2. Agent(backend)          for feature '{feature-name}' → wait → git commit + merge→develop + PR
3. Agent(frontend)         for feature '{feature-name}' → wait → git commit + merge→develop
4. Agent(deployment)       for feature '{feature-name}' → wait → git commit + merge→develop
5. Agent(epic-conformance) for feature '{feature-name}' → wait → verdict gate (below)
```

Steps 2 and 3 are conditional on the feature's `Surface` (see Feature Surface below): a `backend-only` feature skips step 3, a `frontend-only` feature skips step 2. The `+ PR` rides on whichever of the two actually runs first — so on a `frontend-only` feature the PR opens after step 3, not step 2. Steps 1, 4, and 5 always run.

**Agent definitions:** `.claude/agents/pre-dev.md`, `backend.md`, `frontend.md`, `deployment.md`
**Context bridge between agents:** `artifacts/{feature-name}/track-handoffs.md` — each agent appends its section; the next agent reads all prior sections.

**Main session responsibilities (orchestrator only):**
- Invoke each agent in order, passing the feature name
- Wait for each agent to complete before invoking the next
- Run git commits, the merge into `develop` (dev deploy), and the PR between tracks
- **Respawn-once on incomplete track**: after an agent returns, check `checklist.md`. If the track's stages are not all `[x]` (e.g. the agent hit its `maxTurns` cap or was interrupted mid-debug), respawn the same agent ONCE — it gets a fresh context and resumes from the first unchecked stage. If the track is still incomplete after the respawn, record a **Blocker** in `track-handoffs.md` and stop (vibe mode: stop the epic run; develop mode: return to the user).
- **Re-verification runs in an agent, never inline**: if the user asks to re-test an already-implemented feature (all stages `[x]`), do NOT run test suites or debug failures in this session — that bypasses the Fix Budget and bloats the orchestrator's context. Spawn the **frontend** agent with the instruction: "Re-verification only for feature '{feature-name}': re-run Stage 13 (backend integration), Stage 21 (UI mock tests), and Stage 25 (full E2E integration). Fix failures within your Fix Budget; report results in track-handoffs.md under a Re-Verification heading." The main session only reads the agent's summary and reports it.
- Handle `→ PAUSE` between tracks (in `/project:develop` mode). In `/project:vibe` mode, skip all pauses and run to completion; feature-to-feature advancement is driven by `vibe-continue`, not by this orchestrator.
- **Epic-conformance verdict gate (after track 5)**: read the verdict the `epic-conformance` agent returned (also recorded in `artifacts/{feature-name}/11-conformance-report.md`).
  - **CONFORMANT** — the feature header is `· ✅ Done` and Slack was notified that F-{n} finished. Report normal completion; `vibe-continue` may advance to the next feature.
  - **DRIFT** — the feature header is `· ⚠️ DRIFT — needs review` and Slack was pinged. **STOP here.** Do NOT report the feature as complete and do NOT advance. In develop mode, return to the user with the conformance report; in vibe mode, the `· ⚠️ DRIFT` header halts `vibe-continue`. Conformance is the authority on a feature's terminal state — never override DRIFT back to Done without the user resolving it.

**Exceptions — the main session runs these inline; track agents do not.** This assigns ownership, it does not forbid the commands: git is available to the main session and it is expected to run them. Never hand them to the developer to run instead (see the git bullet in `.claude/rules/bash-discipline.md`).
- `git commit`, `git push`, and the merge-into-`develop` sequence (`git-flow.md`)
- Opening PRs — via the GitHub MCP `create_pull_request` (never the `gh` CLI)

## Bash Rules — CRITICAL
Bash discipline rules load automatically from `.claude/rules/bash-discipline.md` — they are binding and cover this orchestrator session too, not just track agents. Test suites are never run inline here (see Re-verification rule above).

---

## Pipeline Tracks

Stage definitions live in each agent file (`.claude/agents/*.md`) and the stage skills they invoke — do **not** duplicate them here. The orchestrator operates at track level only:

| Track | Stages | Agent | Gate after track (develop mode) |
|---|---|---|---|
| Pre-Development | 1–8 (incl. 6.5 Validate Test Sequencing, 7.5 Author E2E Specs) | `pre-dev` | Commit. PAUSE: review `artifacts/{feature-name}/` + authored `e2e/{feature-name}/`; **user chooses track scope: Backend / Frontend / Both** (from the Stage 8 development plan) — **unless the feature's `Surface` in `epic.md` is `backend-only` (scope is Backend) or `frontend-only` (scope is Frontend), in which case you state the scope instead of asking** (see Feature Surface below). |
| Backend | 9–14 | `backend` | Commit + push + PR (see Git Strategy). PAUSE: review `08-backend-report.md`. |
| Frontend | 15–25 | `frontend` | Commit + push + PR (see Git Strategy). PAUSE: review `09-frontend-validation-report.md`. |
| Live Evaluation | 25.5 | _(none — vibe only)_ | **develop mode: no agent.** The real-user UX/UI evaluator runs ONLY under `/vibe-workflow`. Immediately mark `Stage 25.5 · Live Evaluation Gate` as `[x] _(N/A — human pipeline)_` after the frontend track so the pipeline advances; never run an evaluator here. |
| Deployment | 26–28 (incl. 27.5 Write README) | `deployment` | Commit + push. Agent marks the feature header `· ✅ Done` in `checklist.md` at Stage 28. PAUSE: final review. |
| Epic Conformance | post-28 (gate) | `epic-conformance` | No commit. Verifies the delivered feature still matches `epic.md`; writes `11-conformance-report.md`. CONFORMANT → leaves `· ✅ Done` + Slack "F-{n} finished". DRIFT → sets `· ⚠️ DRIFT — needs review` + Slack ping + **halt** (see verdict gate above). |

### Feature Surface — when the Backend or Frontend track does not exist
Read this feature's `Surface` column in the `epic.md` Features table before the Pre-Development pause. Missing column, blank cell, or an unrecognized value = `full`; only the literal `backend-only` or `frontend-only` skips anything. The surface is **per feature** — two features of the same epic may differ.

`backend-only` means the feature has no UI at all (an API another service consumes, a worker, a scheduled job, a webhook receiver). Then:
- **Frontend track**: not run. Its Stages 15–25 are already `[x] _(N/A — backend-only)_` in `checklist.md` — leave them; do not spawn the `frontend` agent, and do not offer Frontend or Both at the scope pause.
- **Live Evaluation**: already `[x] _(N/A — backend-only)_` — same as the `_(N/A — human pipeline)_` case, nothing to run.
- **Acceptance contract**: the Bruno API suite, not Playwright E2E — Stage 7.5 authored no specs, so there is no `e2e/{feature-name}/` to review at the pause.
- **Completion listing** below: `05-ui-test-plan.md`, `09-frontend-validation-report.md`, and `e2e/{feature-name}/` are absent by design.

`frontend-only` means the feature is a UI over an API that already exists (an earlier feature's backend, another service, or a third party behind a Mountebank impostor) and makes no backend change. Then:
- **Backend track**: not run. Its Stages 9–14 are already `[x] _(N/A — frontend-only)_` in `checklist.md` — leave them; do not spawn the `backend` agent, and do not offer Backend or Both at the scope pause. The `frontend` agent reads the Pre-Dev handoff section directly.
- **Live Evaluation**: unchanged (`_(N/A — human pipeline)_` here, the evaluator under vibe).
- **Acceptance contract**: Playwright E2E as usual; `06-api-test-plan.md` describes the consumed API as the impostor contract, not a backend to build.
- **Completion listing** below: `08-backend-report.md` is absent by design; no backend diff or migration is expected.

Everything else is unchanged: pre-dev and deployment always run in full (plus whichever implementation track the surface keeps), each with its own commit/PR/PAUSE, and the epic-conformance gate still runs.

Track agents mark each stage `[x]` in `checklist.md` as they complete it — the orchestrator reads this for the respawn-once check. The epic-conformance gate has no per-stage checkboxes; its outcome is the feature header state + `11-conformance-report.md`.

---

## Completion
```
All 28 stages complete.

Feature: {feature-name}
Artifacts: artifacts/{feature-name}/
  01-requirements.md
  02-flow.md
  03-scenarios.md          ← includes Test Data section
  05-ui-test-plan.md
  06-api-test-plan.md
  07-development-plan.md
  08-backend-report.md     ← includes Implementation Notes + Validation (if backend)
  09-frontend-validation-report.md (if frontend)
  10-deployment-report.md  ← includes Deployment Plan + Validation
  11-conformance-report.md ← epic-conformance verdict (CONFORMANT / DRIFT)
  track-handoffs.md

Status: Fully developed, tested, validated, deployment-ready, and confirmed conformant with the epic plan.
```

## Failure Loops
Failure loops run INSIDE the owning track agent (Stage 13 fail → Stage 12 fixes; Stages 21/23/25 fix-and-re-run; validator findings fixed in-track), bounded by the Fix Budget in `.claude/rules/failure-protocol.md`. The orchestrator acts only when an agent reports a **Blocker** in `track-handoffs.md`: respawn once, then stop (vibe mode) or return to the user (develop mode).

## Rules
- NEVER skip a stage
- ALWAYS pause for human review after each track (develop mode; vibe mode skips all pauses)
- If human edits an artifact, subsequent stages use the edited version
- Walking skeleton scenario is implemented FIRST in every track
- Commit after every track — do not accumulate uncommitted work
- PR is opened automatically after the feature's first code-bearing track (backend, or frontend when the feature is `frontend-only`) — no need to ask
- Reviewer reviews happen inside the track agents (per stage skill); the orchestrator reviews only track summaries
- Never force-push; never commit directly to `main`
