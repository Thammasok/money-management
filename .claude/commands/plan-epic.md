---
description: Plan (or extend) the epic from a raw product idea — spawns the plan-epic agent to draft features/build-order/entities/domain-language/service-architecture, then grills you round by round until nothing is silently assumed. Planning only; does not implement.
argument-hint: "[product idea]"
disable-model-invocation: true
---
# /project:plan-epic

## Stage
Planning entry point — drafts the epic plan in an isolated agent, then grills the user through everything the agent could not settle by reading. **It never starts implementation.** Building the confirmed plan is a separate workflow (`/project:vibe`).

## Guard
Read the user's input first. If it describes a fix, rename, removal, refactor, or change to existing behavior — stop and respond:

> "This looks like a fix or refactor, not a new project. Use `/project:task` — it classifies the work (bugfix/chore/research) and runs the right-sized pipeline — or `/develop` for new features."

Proceed for a raw product/project idea, or a new user-facing capability to add to an existing epic (Epic Extension — the agent handles it; brownfield rules apply).

## Bash Rules — CRITICAL
Bash discipline rules load automatically from `.claude/rules/bash-discipline.md`.

## Execution Model — draft in an agent, grill in this session
The heavy decomposition runs in its own context window; the interview stays interactive here so you keep control of the plan. The agent answers everything it can by reading and hands back what it couldn't — the design tree — and this session grills you through it in rounds until nothing is left assumed.

### Step 1 — Spawn the drafting agent
Invoke the **`plan-epic` agent** (`.claude/agents/plan-epic.md`) via the Agent tool, passing the user's product idea (and noting it's an extension if `epic.md` already exists). Wait for it to finish. The agent reads the brief / `CLAUDE.md` / `.claude/company/architecture.md` / `.claude/tech-stack-profile.md`, decomposes the epic, and writes `epic.md` + `checklist.md` + `docs/ERD.md` (entity relationships) + `docs/sequence.md` (the principal flows across the architecture's modules — both authored with the `mermaid-diagrams` skill) and the `CLAUDE.md` epic line, then returns a draft summary ending in `DRAFT READY — awaiting user review`. Its return carries the **design tree** — everything it could not settle by reading, already shaped as rounds of numbered questions with recommended answers. It does not confirm anything — that's your job in Step 2.

If the agent returns the fix/refactor rejection instead of a draft, relay it and stop.

### Step 2 — Grill the plan WITH the user (human-in-the-loop)
Read `.claude/guidelines/design-grilling.md` — it is the single source for this loop, and its question banks are what you ask. Do NOT implement anything here.

**No bare internal identifier in a question you ask the user** — the "Asking the developer" rule in `.claude/agents/plan-epic.md` binds this session too, because this is where the questions are actually read. Write `Checkout Payment (F-3)`, not `F-3`; name the decision behind an `AD-n`; spell out harness jargon (walking skeleton, surface, seam) once in the question. Reports and files are unaffected — the recap and `epic.md`/`checklist.md` keep the bare IDs, which later stages read.

**Open with the draft.** Summarize from the agent's return + the written `epic.md`: epic name, goal and out-of-scope; the feature list in build order (F-1 = walking skeleton); shared entities and their relationships (from `docs/ERD.md`); the canonical domain terms; the module/seam map with the acceptance seam, and how the walking-skeleton flow runs across it (from `docs/sequence.md`); any `AD-n` recorded. Keep it short — the questions are the point, not the recap.

**Then work the design tree in rounds.** Each round:

1. **Ask the whole frontier at once** — every question whose prerequisites are already settled — numbered, each with your recommended answer:
   ```
   ❓ **Q1** — **{short title}**: {question, with the options when there are options}

   ➡️ {your recommendation, one line of reasoning}
   ```
   A question whose answer depends on another still open in this round belongs to the *next* round.
2. **Stop and wait.** A recommendation is an offer, not a decision.
3. **Write the answers into `epic.md` immediately** — before asking the next round. This is the half that silently goes missing when a grilling loop runs inside a pipeline: the interview happens, the file never changes. Each round ends with an edit to `epic.md`, or the round is not finished. Keep `checklist.md`, `docs/ERD.md` and `docs/sequence.md` in sync too: add/remove feature stage-blocks whenever the Features table changes; reflect every entity, relationship, or rename the round settled in the ERD; and reflect every settled **ordering, owner, or added participant** in the sequence diagrams — including resolving any `{TODO: unclear from requirements}` the answer just cleared in either file. An answer that moves a seam or renames a module changes both diagrams, not just `epic.md`.
4. **Recompute the frontier** and go again. Done when it is empty.

**Cover these banks before the frontier can be empty** (full question lists in the guideline): Epic Statement · Domain Language · Service Architecture · Decomposition and Delivery Risk. The agent will have answered many already — ask only what survives.

**Facts are yours, decisions are theirs.** Anything the repo, the brief, or `.claude/tech-stack-profile.md` answers, you look up — dispatch a subagent for it and keep asking the rest of the frontier while it runs. Never spend a question on something you could read.

**Two things always reach the user, even if the agent was confident:**
- Every domain term the agent invented that the user never said — an unreviewed glossary becomes lore the whole build trusts.
- Every seam proposed *on top of* the mandated layer interfaces that only one adapter would ever satisfy — it is indirection until something varies across it.

**When a question needs a runnable answer** (a real throughput number, how a library actually behaves, a state model that must be driven), don't guess and don't stall: leave it as `Q-n` in Open Questions & Assumptions marked for `/project:develop-research`, and carry on with the rest of the round.

**Closing the loop.** When the frontier is empty, confirm explicitly that Open Questions & Assumptions holds nothing the user hasn't seen — an assumption written there is one they can still overturn; an unwritten one is a silent bet the pipeline will build on.

### Step 3 — Recheck the edited plan before /vibe
Step 2 writes to `epic.md` every round, so the plan reaching this step has been edited — spawn the **`plan-epic` agent in RECHECK mode** to validate integrity. It reads the edited `epic.md` + `checklist.md` + `docs/ERD.md` + `docs/sequence.md` and checks features↔checklist sync, dependency resolution, build-order validity, shared-entity consistency, ERD consistency, sequence consistency, conventions, domain-language soundness, architecture coherence, decisions intact, and that nothing is left silently assumed. It returns `RECHECK PASS` or a list of issues.
- If issues are returned, surface them to the user, apply the fixes (with their direction), and recheck again — loop until `RECHECK PASS`.
- Recheck is skippable only in the rare case where Step 2 produced no edits at all (the draft was already self-consistent and the frontier was empty on arrival).
Only a plan that passes recheck (or was confirmed unedited) is "ready for /vibe."

## Done
Once the user confirms and the plan passes recheck (or was confirmed unedited):

> "Epic plan confirmed and saved to `epic.md` (checklist in `checklist.md`, entity relationships in `docs/ERD.md`, flows in `docs/sequence.md`). To build it autonomously, run `/project:vibe` — it reads this plan and implements every feature end-to-end. To plan more features later, run `/project:plan-epic` again."

Do not invoke `/project:vibe` or `/project:vibe-continue` yourself — starting implementation is the user's call.
