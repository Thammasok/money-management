---
description: Research pipeline (Stages R1–R4) — timeboxed spike whose output is knowledge, not shipped code: frame questions, research with cited sources, optionally prototype/benchmark, conclude with a proposed decision record.
argument-hint: "[task-name]"
---
# /project:develop-research

## Type
Kind pipeline — the right-sized alternative to the 28-stage feature pipeline for **investigation**: answer questions, evaluate options, de-risk future work. The deliverable is the markdown, never the code. Runs inline in the current session (single track — no track agents).

Grounding: XP spike solutions (Beck/Wells), timeboxing (Mountain Goat/SAFe — spikes must be estimable, demonstrable, acceptable), Microsoft Engineering Fundamentals Playbook technical-spike template ("fact-finding, not decision-making"), and MADR decision records (adr.github.io/madr).

## Usage
```
/project:develop-research {task-name}
```

## When NOT to use
- A confirmed defect with a reproducible symptom → `/project:develop-bugfix` (diagnosis is stage B1–B2 there, not a spike).
- The solution and approach are already known → just build it (`/project:develop` or `/project:develop-chore`).
- A prototype explicitly meant to ship → feature, with feature-level verification.

## Setup
1. No branch needed — a spike changes no tracked files: artifacts are **gitignored** (Outline is their canonical home, synced by the hooks) and prototype code lives outside the repo (below).
2. Create `artifacts/{task-name}/`.
3. **Prototype code never lives on this branch**: throwaway code goes in the session scratchpad or a separate `spike/{task-name}` branch that is never merged. It is exempt from TDD, feature flags, and layer architecture by design — and it never graduates; anything production-bound becomes a new `/project:task` item built properly.

## Artifacts
| # | File | Template | When |
|---|---|---|---|
| 01 | `01-spike.md` | `templates/spike.md` | always |
| 02 | `02-evaluation-results.md` | `templates/evaluation-results.md` | when 2+ candidates are compared or any quantitative claim is made |
| 03 | `03-decision-record.md` | `templates/decision-record.md` | when the spike resolves an architecturally significant choice — written at **status: Proposed** |

Artifacts sync to Outline automatically (`outline-sync.py` on Stop) — never sync manually.

## Budgets — CRITICAL
The **timebox is the budget** and it is hard: state it in the charter as a turn/attempt budget, and when it expires, jump to R4 and conclude with what you have — UNANSWERED markers and a proposed follow-up spike, never a silent extension. Inside prototypes, the failure protocol applies: same-error-twice or budget exhaustion ends that experiment with a Blocker note in the spike doc, not an endless debugging loop.

---

## Stage R1 — Frame & Timebox the Spike
Draft the charter in `01-spike.md`:
1. **Goal** — the questions, numbered, each concrete and answerable (falsifiable where possible), and what decision or work is blocked on each answer.
2. **Timebox & done-when** — the effort budget and the acceptance criteria ("questions answered with evidence", even if the answer is "not feasible").
3. **Method per question** — desk research / prototype / benchmark; candidates + evaluation criteria when comparing options.
4. **Out of scope** — questions this spike will NOT chase.
5. **Provisional artifact flags** — whether `02`/`03` are expected. Provisional only: the real triggers (candidate count, architectural significance) are usually only knowable after R2, so re-evaluate them there rather than locking in now.

**→ PAUSE: the user reviews and approves the charter (goal + timebox + method) before investigation starts.**

## Stage R2 — Desk Research (survey existing knowledge)
1. Research each question across **multiple independent sources** — docs, changelogs, issues, engineering write-ups. Enumerate candidate options with versions and license/maintenance status.
2. **Cite decision-relevant claims** with URL + retrieval date. Load-bearing claims — the ones a conclusion or the decision record will rest on — need **≥ 2 independent sources or local reproduction**; single-source claims are marked as such.
3. Vendor-published performance numbers are recorded but flagged **unverified provenance** — treat as claims until reproduced.
4. Mark each charter question **ANSWERED** as evidence closes it; map each remaining one to a specific hands-on experiment. Re-evaluate the provisional artifact flags against what the survey actually found.

**Early-exit gate**: all questions ANSWERED from desk research → skip R3 entirely, note the skip in `01-spike.md`, go to R4.

## Stage R3 — Prototype & Evaluate (conditional)
Only for questions R2 could not close:
1. Build the **minimal throwaway prototype** that demonstrates each answer — in the scratchpad or `spike/{task-name}` branch, never on this branch. No gold-plating: no tests, flags, or layer ceremony on code that exists only to answer a question.
2. Record exact reproduction steps in the spike's Evidence as you go (versions, config, commands) — a half-finished spike must be resumable in a fresh session.
3. When comparing candidates or making quantitative claims, write `02-evaluation-results.md`: same harness, pinned versions for all candidates; every figure tagged **local** (setup + command) or **online** (source + retrieval date), never mixed in one row. For timing/throughput/resource measurements: ≥ 3 runs with spread reported. Deterministic counts (API surface, bundle size, feature matrices) need one run.
4. Honor the timebox — expiry mid-experiment → conclude at R4 with UNANSWERED markers.

## Stage R4 — Conclude, Record & Hand Off
1. Finalize `01-spike.md` Conclusions: every charter question **ANSWERED** (with an evidence pointer) or **UNANSWERED** (reason + what it would take). A reader must be able to re-derive each conclusion from the Evidence without trusting the author.
2. Separate **facts from recommendation**: observed findings first; then a clearly-marked Recommendation subsection. (Deliberate adaptation: the Microsoft playbook keeps spikes recommendation-free; an autonomous pipeline surfaces one — labeled — so the user can decide from evidence.)
3. If the spike resolved an architecturally significant choice (business risk, cross-cutting, external dependency, first-of-a-kind, past troublemaker), write `03-decision-record.md` at **status: Proposed**. **Never mark it Accepted — only the user does that**, at the review below.
4. **Next steps**: graduate every finding that implies work into a typed follow-up item — feature / bugfix / chore, each a future `/project:task` (or `/project:plan-epic` entry) with the finding that justifies it.
5. There is normally **no commit and no PR** — artifacts are gitignored and publish to Outline via the sync hooks (`non-epic/{task-name}`, or the epic dir for epic-listed work); the review handoff is the final PAUSE over those docs. Only if the spike changed tracked repo files (rare) do you commit and open a PR through the GitHub MCP for that part.
6. **Quarantine, don't delete, the prototype** until review — the reviewer may want to re-run it; repeatability is the point.

**→ PAUSE: final review — the user accepts or rejects the proposed decision. After acceptance: flip the decision record to Accepted, then delete the spike code / branch.**

## Rules
- Output is knowledge: spike code never merges, never ships, never gets "cleaned up later" into production.
- No recommendation-first spikes: conclusions are back-filled from evidence, never the reverse.
- Scope discipline: new questions discovered mid-spike are logged as follow-up work, not silently chased.
- Bash discipline (`.claude/rules/bash-discipline.md`) binds every command here.
- Never force-push; never commit on `develop` or `main`/`master` (`.claude/rules/git-flow.md`). A `spike/` branch is never merged anywhere — not into `develop` either.
