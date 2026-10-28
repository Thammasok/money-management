# Failure Protocol — CRITICAL

Applies to pipeline track agents (pre-dev, backend, frontend, deployment) whenever a test, build, or server command fails.

## Stop on Blocker
If a test, build, or server command fails **the same way twice**, STOP. Do NOT:
- Edit build artifacts (anything under `dist/`, `dist-dev/`, `build/`)
- Create symlinks outside the project directory
- Hand-patch `node_modules/` or pnpm internals

Instead, record the failure in `artifacts/{feature-name}/track-handoffs.md` under a **Blockers** heading and return control to the lead. A broken environment is not yours to fix from inside — report it.

The test gates (`unit-gate`, `component-gate`, `e2e-gate`) **enforce this automatically**: they fingerprint each failure (ignoring volatile timing/line numbers) and keep the set of fingerprints seen this streak. If a failure **reappears** — the same error back-to-back *or* an `A→B→A` oscillation/regression — they release early with a Stop-on-Blocker note instead of burning the full 5-attempt budget. A genuinely *different* error each attempt counts as progress and keeps retrying up to the 5-attempt cap, which is the final backstop.

## Fix Budget
Stop on Blocker covers environment failures. For legitimate test failures (assertion errors, flaky specs) a debugging loop is allowed but **bounded**:
- **Max 3 fix→retry cycles per failing test file.** A cycle = one code/test change + one re-run.
- **Max 5 retry runs total per stage**, across all files.
- Count attempts explicitly in your reasoning (e.g. "attempt 2/3 for admin-users.spec.ts") so the budget is visible.

When the budget is exhausted:
1. Record a **Blocker** in `track-handoffs.md`: failing test file, latest error, every hypothesis tried and its result.
2. Mark the stage `[x]` in `checklist.md` with a `_(BLOCKED — see track-handoffs)_` note.
3. Move on — continue with stages that don't depend on the failing test; otherwise end the track.

Before finishing any stage, **delete every diagnostic artifact** created while debugging (throwaway specs, console-log probes, scratch files). Nothing diagnostic may survive into the track commit.
