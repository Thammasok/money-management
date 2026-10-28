---
description: Epic-free entry point — classify a task as feature, bugfix, chore, or research, then run the right-sized pipeline for it. Features route to /project:develop unchanged.
argument-hint: "[task-name] \"description\""
disable-model-invocation: true
---
# /project:task

## Type
Orchestrator — the alternative entry to `/project:develop` for work that arrives as a raw task instead of a planned epic feature. It classifies the task kind, then hands off to the kind's pipeline. It never implements anything itself.

## Usage
```
/project:task {task-name} "{description}"
/project:task "{description}"            ← derive a kebab-case task-name from the description
```

`{task-name}` is kebab-case and names the artifact folder: `artifacts/{task-name}/`. Artifacts persist to Outline automatically via the `outline-sync.py` hooks (direct tasks under `non-epic/{task-name}`, epic features under `epic/epic-{epic_name}/F-{n}-{feature-name}`) — no pipeline ever syncs manually. The whole `artifacts/` tree (plus `epic.md`, `checklist.md`, `.claude/tech-stack-profile.md`) is **gitignored**: Outline is the canonical record, git carries only code, and the session-start hook restores missing copies from Outline.

## What this skips
For the **bugfix / chore / research** kinds: no `epic.md` entry, no `checklist.md` feature header, no epic-conformance gate — a direct task stands alone: its pipeline, its artifacts, its PR.

A **feature** is the exception: `/project:develop` runs with its full epic machinery unchanged (checklist stages, respawn-once check, epic-conformance gate against `epic.md`), so the feature route below ensures that machinery exists before invoking it.

---

## Step 1 — Classify the kind

Apply these rules **in order** — the first match wins. Explicit defect/investigation keywords outrank inferred semantics (ordered rules classify more reliably than parallel definitions — arXiv 2605.02033).

### 1. Bugfix — an expectation of correctness is violated
Signals: *fix, broken, crash, error, fails, wrong, incorrect, hang, leak, regression, "used to work", "since version X"* · a repro, stack trace, or failing environment is given · security vulnerability / CVE (violates the implicit security contract even with no user report) · data corruption.
Operational test: a test reproducing the reported behavior would **fail today and pass after** the change.
Counter-signals: "would be nice" / "add support for" (never-supported ≠ broken → feature) · behavior matches spec ("working as designed" → feature or won't-fix) · unconfirmed cause with open questions → research.

### 2. Research — the deliverable is knowledge, not shipped code
Signals: *investigate, explore, evaluate, compare, benchmark, feasibility, spike, prototype, PoC, "try X and see", "figure out whether", "which library should we…"* · question-shaped description · multiple candidates with a decision required · the real work can't be estimated yet.
Counter-signals: solution already known → feature/bugfix · confirmed defect with reproducible symptom → **bugfix** (diagnosis is stage 1 of the bugfix path, not a spike) · prototype explicitly meant to ship → feature.

### 3. Feature — new promised behavior
Signals: *add, implement, support, enable, allow, create, build, introduce, expose* · names a capability/screen/endpoint that doesn't exist yet · user-value framing · new integration, API contract, or persisted data · intentional removal/change of user-visible behavior.
Size never changes the kind — "add a sort button" is a feature even as a one-liner ("never supported before" is the feature test).

### 4. Chore — no observable product behavior change
Signals: *bump, upgrade, pin, rename, move, reorganize, clean up, remove dead code, refactor* (behavior-preserving) · tooling/infra-only surface (CI, build, lint, format, Dockerfile) · docs-only or tests-only · success criterion is "everything still works exactly as before".
Counter-signals: any intended user-visible change → feature/bugfix · motivated by a defect ("refactor the parser because it mangles unicode" → bugfix) · unknown approach ("try migrating to X and see") → research.

### Edge cases (resolved)
| Case | Kind | Why |
|---|---|---|
| Performance: used to be fast / violates an SLO / unusably slow | bugfix | correctness expectation violated; a benchmark test can fail-then-pass |
| Performance: always been this speed, want it faster | feature | aspirational value; needs a target metric, not a repro |
| Refactor that fixes a bug along the way | bugfix | the behavior change dominates; the refactor is the fix's implementation detail |
| Dependency bump, behavior-preserving (patch/minor) | chore | success = nothing changed |
| Dependency bump to fix a defect/CVE | bugfix | classify by WHY the bump is wanted |
| Dependency bump to unlock new APIs you'll use | feature | same rule |
| UI copy change, current copy merely stale/ugly | chore | no logic, contract unchanged |
| UI copy that is WRONG (misleading price, wrong error text) | bugfix | displayed information violates correctness |
| Adding tests only | chore | no production change; if a test exposes a real defect, spawn a separate bugfix task |
| "Try X and see if it works" | research | canonical spike trigger; if the answer is "build it", that spawns a feature task |
| Security patch | bugfix | first-class defect category; severity is a separate axis from kind |
| Removing a truly dead feature (zero traffic, flag never on) | chore | verification = usage evidence + regression suite |
| Removing a feature users still see | feature | the behavior contract changes, even though code is only deleted |
| "Investigate why checkout is slow" (symptom reproducible) | bugfix | reproducible symptom → bugfix; open option-comparison → research |

**If still ambiguous** after the rules and edge cases: ask the user with `AskUserQuestion` — one question, recommended kind first with your reasoning.

## Step 2 — Report the classification

Before routing, state in one line: the kind, the winning signal, and the pipeline about to run. If the user disagrees, they correct it here — cheap now, expensive later.

## Step 3 — Route to the kind's pipeline

| Kind | Route | Artifacts |
|---|---|---|
| feature | If `epic.md` + `checklist.md` already list this feature → `/project:develop {task-name}` directly. Otherwise run `/project:plan-epic "{description}"` first — it creates or extends `epic.md`/`checklist.md` and confirms the entry with the user — then `/project:develop {task-name}`. The 28-stage pipeline and its epic-conformance gate run **exactly as-is**. | per `/project:develop` |
| bugfix | Trivial (≤ 3 files, obvious cause, no record needed) → `/project:develop-chore {task-name}` **trivial tier** (the merged lightweight fix flow). Otherwise invoke `/project:develop-bugfix {task-name}`. | trivial: none · else `artifacts/{task-name}/01…03` |
| chore | Invoke `/project:develop-chore {task-name}` — it tiers itself: trivial (no artifacts), low, or standard. | trivial: none · else `artifacts/{task-name}/01-change-plan.md` |
| research | Invoke `/project:develop-research {task-name}`. | `artifacts/{task-name}/01…03` |

## Rules
- This command classifies and routes — it never implements, diagnoses, or prototypes.
- Never modify `/project:develop` behavior for features; it runs unchanged.
- One task = one kind. A task that spans kinds ("upgrade the framework AND add retry support") is split into separate `/project:task` runs; the feature part wins its own task.
- Bash discipline rules (`.claude/rules/bash-discipline.md`) bind here and in every kind pipeline.
