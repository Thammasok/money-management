---
paths:
  - "e2e/**"
---

# E2E Contract

The Playwright suite under `e2e/{feature-name}/` is authored in Pre-Dev (Stage 7.5, `/author-e2e-specs`) as the feature's acceptance contract — failing by design until the implementation satisfies it. Implementation makes it pass; implementation does NOT own it.

Never edit in these files:
- **Assertions** (`expect(...)` calls, expected values, URLs)
- **Scenario structure** (test titles, steps, coverage)
- **Fixture payload shapes** (response envelopes, entity fields, IDs)

Mechanics fixes are allowed only for the frontend track at Stage 20 (imports, type errors, runner wiring). A locator that doesn't match the implemented UI means the UI diverged from `02-flow.md` — fix the UI, not the locator. The backend track never touches anything under `e2e/`.

If a spec or fixture seems genuinely wrong, record a **Contract Dispute** in `artifacts/{feature-name}/track-handoffs.md` (spec name, disagreement, evidence) and let the orchestrator resolve it — do not edit the contract.

## Test-double fidelity — CRITICAL

A double that answers more permissively than the real service turns mock mode into a rubber stamp:
the suite goes green, integration fails, and the defect is attributed to the integration environment
rather than to the code. **This epic produced four instances before the rule was written** — a
Mountebank impostor that never checked the `Authorization` header (so five unauthenticated GitHub
calls passed), a fixture expecting `202` from an endpoint that ships `200` **which the mock also
returned**, a park sweep whose retry left a Run parked when the real one resumes it, and a dedupe
answering with a synthesised id instead of the original row's. Every one was an ERROR path, and in
every one mock mode passed while integration failed.

Three rules, applied when a spec or a double is AUTHORED (Stage 6 / Stage 7.5) — not at review, by
which point the green suite is the evidence:

1. **A double must be able to fail the way the real service fails.** If the code handles a 401, 409
   or 422, the double must be able to produce it. A double that can only succeed proves only that
   the happy path compiles.
2. **An assertion must be unsatisfiable by a double that knows nothing.** Ask literally: *could this
   pass if the double just returned a plausible shape?* Prefer creating state **in-test** over
   seeding it, then assert an identifier the double could not have invented — a server-generated id
   from an earlier call in the same test is the strongest form. A pre-seeded fixture whose expected
   value is also a constant proves nothing about the mechanism.
3. **Grep the double for values it synthesises.** A literal the real service would never emit — a
   `…DUP` suffix, a `fake-` prefix, a hard-coded id — is where a wrong answer hides.

**Where a double and the real service disagree, the real service is right** and the double is the
defect — including when the double agrees with the spec. Nothing in this pipeline compares impostor
behaviour against the live service, so these rules are the only thing standing in for that check.

## Seed contexts and fixture IDs — CRITICAL

Two failure modes, one cause: a fixture verified against a database that is missing a context.

**1. A feature's reset must load every context its `epic.md` dependencies imply — transitively.**
`e2e/{feature}/fixtures/db-reset.ts` names a Liquibase context list. If that list is shorter than
the feature's declared `Depends On` closure, the suite tests a tree that will never be deployed.
F-2 declared `F-1, F-5, F-7` and reset with `test,f3,f5,f2` — four of the five — for its whole
build. Check the list against the Features table when authoring the fixture, and again after any
merge that brings a dependency into the tree.

**2. A "fresh" fixture ID is only free if checked against ALL of those contexts at once.**
Fresh IDs — an issue number a delivery *creates*, so it must match no seeded row — are the
recurring trap, because a collision does not fail loudly. The Start decision refuses
`run_already_live` **before** reaching the branch under test, which reads as the feature being
broken. F-2's fresh-issue range moved three times (132 → 140-147 → 170-177 → 178-185), each move
"verified empirically free" against a database that did not yet hold the next feature's seed.

So: load the full context list, then `SELECT` the occupied set once and take a range above its
maximum, leaving a gap. And when a range moves, move **every** file that names it in the same
change — the generator (`tools/gen-*-api-tests.mjs`, which owns the Bruno collection and the
impostors) and the Playwright fixture (`e2e/{feature}/fixtures/test-data.ts`) are two halves of one
feature. R32 moved one half and not the other, and the halves disagreed about which issues were
free until integration mode finally ran.

**Only integration mode can catch either.** A canned mock response neither reads nor writes real
Postgres, so mock mode never meets another feature's rows and stays green throughout.
