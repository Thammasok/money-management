---
description: Stage 20 of 28 — wire the pre-authored Stage 7.5 E2E suite to the implemented UI (compile, collect, locator cross-check; no authoring). Invoked by the frontend track agent.
user-invocable: false
---
# /project:develop-ui-tests

## Stage
20 of 28 — Wire E2E Specs (Playwright)

> The E2E specs were authored in Stage 7.5 (`/project:author-e2e-specs`) as executable acceptance criteria, before implementation. This stage does NOT write tests — it wires the pre-authored suite to the now-implemented UI and gets it to compile and collect.

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/test-pyramid.md`
- `guidelines/e2e-test-isolation.md`

## Input
Read:
- `e2e/{feature}/` — pre-authored specs, page objects, fixtures (Stage 7.5)
- `artifacts/{feature}/05-ui-test-plan.md` — authored-test inventory
- `artifacts/{feature}/02-flow.md` — the component-ID contract

## Task

### E2E Contract — CRITICAL
The specs are the acceptance contract. You may NOT change:
- **Assertions** (`expect(...)` calls, expected values, URLs)
- **Scenario structure** (test titles, Given/When/Then steps, coverage)
- **Fixture payload shapes** (response envelopes, entity fields, IDs)

You MAY fix mechanics only:
- Import paths, type errors, runner config wiring
- A page-object **locator** that does not match the implemented UI — but first check `02-flow.md`: if the implementation diverged from the flow document's component IDs, **fix the UI to match the flow doc**, not the locator. The flow doc is the contract; locators change only if the flow doc itself was updated upstream.

If you believe a spec or fixture is genuinely wrong (contract mismatch, impossible assertion), do NOT edit it — record a **Contract Dispute** in `artifacts/{feature}/track-handoffs.md` with the spec name, the disagreement, and your evidence. The orchestrator resolves it.

### Steps
1. **Verify config**: `playwright.config.ts` follows `templates/playwright.config.ts` (run-via-`run-e2e.sh` header, dev-mode webServer). Replace stale comments with the template header if needed.
2. **Compile**: run the project's typecheck; fix import/type mechanics in `e2e/{feature}/` only.
3. **Collect**: `npx playwright test e2e/{feature}/ --list` — every authored spec must be discovered. Do not execute the suite here; execution is Stage 21 (mock) and Stage 25 (integration).
   - ⚠️ `--list` only ENUMERATES specs — it never runs them, so it proves **discovery, not correctness**. "N specs collected" is NOT "N specs passing". Never cite a collection count as evidence the suite passes, and never tick a downstream stage `[x]` on the strength of `--list`. The suite is green only once Stage 25 actually EXECUTES it and every spec reports ✓.
4. **Cross-check locators** against the implemented pages — divergences are UI bugs (fix UI) unless the flow doc changed.

## Output
- Compiling, collectable `e2e/{feature}/` suite — unmodified assertions/scenarios/fixtures
- Update `artifacts/{feature}/07-development-plan.md` — mark this task done
- Any Contract Disputes recorded in `track-handoffs.md`

## Done
Summarize:
- Specs collected vs authored
- Mechanical fixes applied (imports/types/locators)
- UI fixes applied to match the flow contract
- Contract disputes raised (if any)

After summary, **reviewer reviews**. Ask developer to double-check and open PR if approved.
