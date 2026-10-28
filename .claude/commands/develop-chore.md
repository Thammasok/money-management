---
description: Chore pipeline — maintenance and small changes. Three tiers; the trivial tier (no artifacts, no pauses) absorbs the old /fix flow for small fixes and tweaks. Behavior-preservation is the contract for low/standard; micro-steps with green tests between each.
argument-hint: "[task-name]"
---
# /project:develop-chore

## Type
Kind pipeline — the right-sized alternative to the 28-stage feature pipeline for **maintenance and small changes**. Runs inline in the current session (single track — no track agents). The **trivial tier** replaces the retired `/project:fix` command: same lightweight flow, now with an explicit escalation path into the tiered pipeline.

Grounding: Fowler's refactoring workflow (small behavior-preserving steps, tests green between each, Two Hats), characterization tests (Feathers, *Working Effectively with Legacy Code*), safe dependency-upgrade practice (Renovate/Dependabot guidance), and Google SRE on config changes as a leading outage cause.

## Usage
```
/project:develop-chore {task-name}
```

## When NOT to use
- Any intended user-visible behavior change beyond a stated trivial delta → feature (`/project:develop`) or bugfix (`/project:develop-bugfix`).
- A **non-trivial** defect (unclear root cause, >3 files, design decisions) → `/project:develop-bugfix`. Trivial defect fixes are in scope — that's the trivial tier.
- Unknown approach or outcome ("try migrating to X and see") → research (`/project:develop-research`).

## Tiers — pick before anything else

| Tier | When | Artifacts | Gates |
|---|---|---|---|
| **trivial** | ≤ 3 files, no design decisions, obvious change with an obvious verification. Covers small **defect fixes** (obvious root cause) AND small **tweaks** (copy, style, config, small logic). No record needed beyond the commit + PR. | **none** | none — plan stated in one paragraph in-chat |
| **low** | Behavior-preserving but deserves a record: devDependency bumps, lint config, wider tidying | `01-change-plan.md` (short — collapsed C2/C3) | one PAUSE (plan approval) |
| **standard** | Refactors, runtime deps, prod config, anything with real blast radius | `01-change-plan.md` (full) | PAUSE (plan) + final PAUSE |

Tier picks are provisional: the moment a trivial change reveals design decisions, more files, or an unclear root cause, **stop and escalate** — to `/project:develop-bugfix` if it's a defect, to the low/standard tier otherwise. Never let a trivial change silently grow.

---

## Trivial tier (the merged /fix flow)

No artifacts, no pauses, no stages — five steps, all in-session:

1. **Diagnose / understand.** For a defect: find the root cause, not the symptom — which files/lines, what's the blast radius, and is there a test that should have caught it (if yes, why didn't it)? If the root cause is unclear after reading the code and tracing the call path, it is not trivial — escalate to `/project:develop-bugfix`. For a tweak: state the intended delta in one line ("only the button label changes"); everything else is behavior-invariant.
2. **Plan in one paragraph (no file).** What changes and where, what does NOT change, how it's verified. If the plan reveals a bigger change, stop and escalate.
3. **Implement.** Minimum viable change; no unrelated edits; follow existing style. Defect fix: if a test should have caught the bug and doesn't exist, write it now — **red → green**.
4. **Verify.** Run the tests directly related to the change, then the affected package suite, then the type check. Fix root causes, not tests.
5. **Ship.** Branch `fix/{task-name}` for defect fixes, `chore/{task-name}` for tweaks, off the release branch (verify a clean worktree first). Commit (`fix: …` or `chore: …` — one line, what was broken/changed and how). Push, **merge into `develop`** (= dev deploy; the sequence in `.claude/rules/git-flow.md`, finish back on the working branch, a conflict → abort + Slack + tell the user, never resolve), then open the PR to the **release branch** (`main`/`master`, never `develop`) through the **GitHub MCP** (`create_pull_request`) — the `gh` CLI's PR commands are deny-listed. PR body: problem, root cause (defects), what changed, verified by, `- Dev:` merged / pending.

The Fix Budget still binds (max 3 fix→retry cycles; same-failure-twice → stop and report to the user).

---

## Tiered pipeline (low / standard) — Stages C1–C5

### Setup
1. Read `.claude/tech-stack-profile.md`.
2. Verify a **clean worktree**, then create branch `chore/{task-name}` (skip if already on it). This pipeline commits per micro-step — never start it with unrelated changes staged.
3. Create `artifacts/{task-name}/`.

### Artifacts
One artifact: `artifacts/{task-name}/01-change-plan.md` (template `templates/change-plan.md`) — plan first, execution log and verification evidence appended as the pipeline runs. Right-sized on purpose: a chore that needs six artifacts is not a chore. Artifacts are **gitignored** and sync to Outline automatically (`outline-sync.py` on Stop) — Outline is the canonical record; never sync manually, never commit artifacts. (The trivial tier writes no artifacts, so nothing syncs — the commit + PR are its record.)

### Budgets — CRITICAL
The Fix Budget and Stop-on-Blocker rules in `.claude/rules/failure-protocol.md` bind this pipeline: max 3 fix→retry cycles per failing step, revert-first on failure, same-failure-twice → Blocker. Record Blockers in the execution log of `artifacts/{task-name}/01-change-plan.md` and return to the user — there is no `track-handoffs.md` or `checklist.md` in task-kind pipelines. **Never start a chore on a red baseline** — a red suite before you begin is a Blocker, not something to fix in passing.

### Stage C1 — Scope & Classify
1. Classify the chore type: `refactor | bump dependencies | change config | add logging | CI/tooling | tidy`.
2. State the **behavior-invariant contract**: "no observable product behavior change" — or the precise, narrow allowed exception (e.g. "new log lines only"), enumerated explicitly.
3. Set the **YAGNI scope fence**: in-scope files/packages/deps listed; everything else is out. "While I'm here" cleanups outside the fence are the top source of chore-induced regressions.
4. Record the tier (low → collapse C2–C3 into a short plan — pinned baseline only where suites already cover the touched paths, a one-table micro-step list; standard → full C2 and C3).

Start `01-change-plan.md` (Type / What changes / Why / Scope / Risk sections).

### Stage C2 — Baseline & Safety Net
Prove the pre-change state is green and pin current behavior so "unchanged" is provable by diff, not by feeling:
1. Run the affected suites once — **green before any change**; red baseline → Blocker, stop.
2. Any to-be-touched code path without coverage gets a **characterization test** first: assert what the code *actually does now* (even if odd), not what it should do.
3. Type-specific baseline:
   - **Deps** — read the changelog between current and target versions; list breaking changes and every usage site of changed APIs; record lockfile state; **security/supply-chain check**: run the ecosystem audit (e.g. `npm audit`), prefer releases old enough to have survived scrutiny, and eye new install scripts/postinstall hooks on major bumps.
   - **Config** — capture the current effective/rendered config and identify a *semantic* validation command (not just a parse check).
   - **Logging / CI** — a concrete before-state check proportional to risk (a reference passing pipeline run; the current log shape only when the change is risky enough to warrant it).

**Gate**: baseline recorded in the artifact; every touched path covered by an existing test, a new pinning test, or an explicit written risk waiver.

### Stage C3 — Plan Micro-Steps
Decompose into an ordered list of **small, individually revertible, behavior-preserving steps** (Fowler: each "almost too small to be worth doing"):
- Refactor → one named refactoring move per step (extract, rename, inline…).
- Deps → patch/minor bumps before majors; one dependency (or one coherent group) per step, its changelog notes attached.
- Config / logging / CI → one change per step, each paired with its verification command.

Every step gets a named verification command. If the plan touches paths the C2 safety net missed, loop back and pin them first.

Complete the plan in `01-change-plan.md`. **→ PAUSE: the user reviews and approves the change plan before any source edit.** On approval, commit the safety net (`chore({task-name}): baseline` — the characterization tests from C2). The plan artifact itself is gitignored — it reaches reviewers through Outline, not git.

### Stage C4 — Execute Micro-Steps
Wear only the **refactoring hat** — never mix behavior change into a chore step. A discovered bug or feature need becomes a new `/project:task` item, never in-flight scope growth.
1. Apply one step; run that step's verification command; **commit per green step** (`chore({task-name}): step N — {move}`) so any failure bisects to one small diff.
2. On failure: **revert the step first**, then retry within the fix budget. A failing test after a tiny step means the step was wrong — revert beats debugging.
3. Append each step's outcome (and attempt count) to the execution log in the artifact.

**Gate**: all steps applied, suite green after each, log within budget; abandoned steps reverted cleanly and recorded, never hand-patched around.

### Stage C5 — Verify Behavior Unchanged & Release
1. Run the complete affected suites **plus the characterization tests unmodified** — any pinning-test diff is a behavior change: justify it against the C1 contract or revert it.
2. Type-specific: deps → clean install from the lockfile + re-run the security audit; config → semantic validation + diff of effective config vs baseline; logging → only the intended lines appear, correct levels, no PII; CI → a full pipeline run passes.
3. **Audit the final diff against the C1 scope fence** — nothing outside it ships.
4. Disposition each characterization test: promote to the permanent suite (documents real behavior) or remove (pure scaffolding).
5. For production-affecting config or runtime deps only: add a staged-rollout/observation note to the artifact (SRE: config changes are production changes). Not needed for devDependencies, lint config, or CI tweaks.
6. Delete diagnostic debris and disposition the characterization tests, then make the **closing commit** (`chore({task-name}): test disposition + cleanup`) — code-side C5 work that isn't committed never reaches the PR. Fill the Verification evidence section; the artifact is gitignored, so the evidence reaches reviewers through Outline, not the PR diff.
7. Push, then **merge into `develop`** (= dev deploy) with the sequence in `.claude/rules/git-flow.md` — one command per call, finish back on `chore/{task-name}`; a conflict → `git merge --abort`, Slack ping, report it at the PAUSE, never resolve it. Then open the PR to the **release branch** (`main`/`master`, never `develop`) through the **GitHub MCP** (`create_pull_request`) — the `gh` CLI's PR commands are deny-listed in this repo. Title: `chore({task-name}): {description}`. Body: "Behavior-preserving change — plan + evidence in Outline: long-horizon-agent/non-epic/{task-name}/01-change-plan. Rollback: git revert per step commit." plus a `- Dev:` line (merged into develop / merge pending a human). If the MCP is unavailable, hand PR creation to the user at the PAUSE below.

**→ PAUSE: final review with the user.**

## Rules
- Two Hats: a chore never changes behavior and structure at once. The trivial tier's only sanctioned behavior changes are its stated intended delta — a defect fix's delta (guarded by its red→green test) or a tweak's one-line delta from step 1; everything else is behavior-invariant.
- Low/standard: zero unexplained behavioral diffs vs baseline; every observable delta maps to an allowed exception written in C1.
- Escalation is one-way and immediate: trivial work that grows never continues as trivial.
- Bash discipline (`.claude/rules/bash-discipline.md`) binds every command here.
- Never force-push; never commit on `develop` or `main`/`master`; never merge `develop` into the release branch or into the working branch (`.claude/rules/git-flow.md`).
