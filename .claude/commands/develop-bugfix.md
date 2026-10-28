---
description: Bugfix pipeline (Stages B1–B7) — reproduce, diagnose scientifically, fix root cause with a regression test first, verify the blast radius, and close out. For non-trivial bugs; trivial fixes use the develop-chore trivial tier.
argument-hint: "[task-name]"
---
# /project:develop-bugfix

## Type
Kind pipeline — the right-sized alternative to the 28-stage feature pipeline for **restoring correct behavior**. Diagnosis-first, regression-test-first, bounded by the Fix Budget. Runs inline in the current session (single track — no track agents).

Grounding: scientific debugging (Zeller, *Why Programs Fail*), Agans' 9 debugging rules, regression-test-first (TDD), 5 Whys (Atlassian), blameless postmortems (Google SRE / Etsy), and the debug-mantra/scrutinize discipline from thananon/9arm-skills.

## Usage
```
/project:develop-bugfix {task-name}
```

## When NOT to use
- Trivial fix (≤ 3 files, obvious cause, no record needed) → the **trivial tier** of `/project:develop-chore`.
- The "bug" is a missing capability (never-supported ≠ broken) → it's a feature; `/project:develop`.

## Setup
1. Read `.claude/tech-stack-profile.md`.
2. Create branch `fix/{task-name}` (skip if already on it). Verify a clean worktree first.
3. Create `artifacts/{task-name}/`.

## Artifacts
| # | File | Template | When |
|---|---|---|---|
| 01 | `01-root-cause-analysis.md` | `templates/root-cause-analysis.md` | always |
| 02 | `02-verification-report.md` | `templates/bugfix-verification-report.md` | always |
| 03 | `03-postmortem.md` | `templates/postmortem.md` | only when the postmortem criteria in B7 are met |

Artifacts are **gitignored** and sync to Outline automatically (`outline-sync.py` on Stop) — Outline is the canonical record; never sync manually, never commit artifacts.

## Budgets — CRITICAL
The Fix Budget and Stop-on-Blocker rules in `.claude/rules/failure-protocol.md` bind this pipeline even though it runs in the main session: max 3 fix→retry cycles per failing file, max 5 retry runs per stage, same-failure-twice → STOP and record a Blocker in `01-root-cause-analysis.md`. Diagnosis is bounded too: count hypothesis→experiment cycles in your reasoning; when the stage budget is spent without a surviving root cause, record a Blocker with the full hypothesis ledger and return to the user — never thrash.

---

## Stage B1 — Understand, Reproduce & Triage
**Never propose a fix before this stage is done.**
1. **Understand the system first** (Agans rule 1): read the affected subsystem, its interfaces/contracts, and recent git history on the affected paths (`git log` suspects — what changed near when the bug appeared).
2. Capture the symptom precisely: observed vs expected, exact failing output verbatim, environment, severity and user impact.
3. Build a **reliable, deterministic repro** — a single command or test that fails every time. For flaky/timing bugs, record the failure rate and the forcing conditions (seed, clock, ordering) that make it deterministic.
4. **Check the plug** (Agans rule 7): rule out non-code causes — stale build, wrong version deployed, misconfiguration, broken environment. An environment failure is a **Blocker** per the failure protocol, not a bug to code around.

**Gate**: repro command exists and fails reliably, with output captured in `01-root-cause-analysis.md`. No repro within budget → Blocker, stop.

## Stage B2 — Diagnose (scientific debugging)
Follow the debug mantra **in order** — never out of turn:
1. **Narrow the fail path**: debugger → trace + enumerate the knobs (config, flags, inputs) → targeted instrumentation, each only after the prior fails. "Quit thinking and look" — inspect actual state before theorizing. Minimize the repro to the smallest input/state that still fails.
2. **Falsify before committing**: 3–5 ranked hypotheses; for each, the **simplest experiment that would disprove it**, run that first. Change one thing at a time.
3. **Cross-reference**: keep the experiment ledger; the accepted root cause must be consistent with **every** row, including rejected hypotheses.
4. Run a **5 Whys chain** from the mechanism to a systemic cause. A person is never an acceptable root cause.

**Gate**: root cause survived an honest attempt to disprove it; defective `file:line` identified; ledger complete in `01-root-cause-analysis.md`.

## Stage B3 — Fix Plan
1. Choose the **minimal, story-scoped fix** for the root cause (not the symptom). No opportunistic refactoring in the plan.
2. Map the **blast radius**: changed symbols, direct and transitive callers, seams touched, and suspected **sibling occurrences** of the same defective pattern (grep for them now).
3. Note **why the existing tests missed it**, and pick the regression-test level — the lowest sensible level of the pyramid (unit if the defect lives in one unit; integration/E2E only if it lives in a seam).
4. **Feature-flag decision** (brownfield rule): flag the fix with FeatBit if it is risky or behavior-changing; record the rationale either way, plus the rollback path.

Complete `01-root-cause-analysis.md`. **→ PAUSE: the user reviews and approves the fix approach before any source edit.**

## Stage B4 — Regression Test First (RED)
Write the automated test that reproduces the bug **before any production-code change**. Run it and confirm it **fails for the right reason** — the assertion failure must match the diagnosed defect, not a setup error. Follow suite conventions (3A, independence, boundary-only). Capture the RED output.

**Gate**: new test red for the diagnosed reason; zero production code modified.

## Stage B5 — Minimal Fix (GREEN), then Refactor
1. Make the smallest change that closes the root cause and turns the regression test green. Wrap in the feature flag if B3 mandated one (verify both on and off states).
2. If the fix drifted from the plan (bigger, riskier, more seams), record the drift and **re-evaluate the flag decision** — a fix that grew must not ship unflagged just because the plan said so.
3. Red → green → **refactor**: story-scoped cleanup is allowed now, under the new test cover only (repo Refactor rule). Discovered unrelated issues become new `/project:task` items.

**Gate**: regression test green; diff limited to plan scope (drift recorded); flag verified both states if present.

## Stage B6 — Verify Beyond the Test (blast radius)
"If you didn't fix it, it ain't fixed" (Agans rule 9) — one green test proves one path:
1. Re-run the **original repro from B1** — it must pass.
2. Run the **full affected suites**, not just the new test.
3. Walk the **blast-radius list** from B3: exercise or trace every caller of the changed code; note the method per caller (test / trace / manual drive). Drive the real user flow end-to-end for user-facing bugs.
4. Disposition every **sibling-pattern hit**: fixed (in scope) / filed as a new task / not applicable.
5. **Then delete all diagnostic debris** — probes, console logs, scratch specs, instrumentation. This is the single debris gate; nothing diagnostic survives into the commit.

Write `02-verification-report.md`. **Gate**: any surviving anomaly is a Blocker, not a footnote.

## Stage B7 — Closeout & Postmortem Decision
1. Apply the **postmortem criteria** (pre-agreed, objective): user-visible outage or data loss · security issue · found by a user instead of tests/alerts · a recurring class of defect · stakeholder request. Any met → write `03-postmortem.md` (blameless; at least one systemic action item). None met → a postmortem is overkill; record the decision and the 5-Whys outcome in `02-verification-report.md` instead. Either way, record the one-line answer to "why did no test catch this" and what now guards it.
2. If the fixed behavior is documented elsewhere (feature scenarios, E2E acceptance specs, app `CLAUDE.md` feature memory), update those in-scope files so they don't go stale.
3. Commit (`fix({task-name}): {one-line root cause → fix}`), push, then **merge into `develop`** (= dev deploy) with the sequence in `.claude/rules/git-flow.md` — one command per call, finish back on `fix/{task-name}`; a conflict → `git merge --abort`, Slack ping, report it at the PAUSE, never resolve it. Then open the PR to the **release branch** (`main`/`master`, never `develop`) through the **GitHub MCP** (`create_pull_request`) — the `gh` CLI's PR commands are deny-listed in this repo. Title: `fix({task-name}): {description}`. Body: "Root cause, fix, and verification in Outline: long-horizon-agent/non-epic/{task-name}/ (artifacts are gitignored)" plus a `- Dev:` line (merged into develop / merge pending a human). If the MCP is unavailable, hand PR creation to the user at the PAUSE below.

**→ PAUSE: final review with the user.**

## Rules
- NEVER fix before a reliable repro exists; never test hypotheses before the fail path is located; never commit to a cause without trying to disprove it.
- A test that has never been seen failing proves nothing — RED before GREEN, always.
- Symptom-patching (null check / retry / try-catch at the crash site) is not a fix.
- Bash discipline (`.claude/rules/bash-discipline.md`) binds every command here.
- Never force-push; never commit on `develop` or `main`/`master`; never merge `develop` into the release branch or into the working branch (`.claude/rules/git-flow.md`).
