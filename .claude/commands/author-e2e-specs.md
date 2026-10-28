---
description: Stage 7.5 of 28 — author the failing-by-design Playwright acceptance suite (specs, page objects, fixtures) before any implementation. Invoked by the pre-dev track agent.
user-invocable: false
---
# /project:author-e2e-specs

## Stage
7.5 of 28 — Author E2E Specs (Playwright)

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/bdd-scenarios.md`
- `guidelines/test-pyramid.md`
- `guidelines/test-boundary-only.md`
- `guidelines/walking-skeleton.md`
- `guidelines/sequential-test-data.md`
- `guidelines/e2e-test-isolation.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:bdd-scenarios` — when writing Given/When/Then scenarios
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario

## Why this stage lives in Pre-Dev
E2E specs assert **externally specified behavior**: routes and component IDs (from `02-flow.md` / `01-requirements.md`), API contracts (from `06-api-test-plan.md` and the Mountebank impostors validated in Stage 7). All of that is fixed before implementation starts — so the specs are written here, as **executable acceptance criteria** (ATDD). The implementation tracks make them pass; they do not own them. This removes the author-judges-own-work conflict where an implementer "fixes" a failing test instead of the code.

## Input
Read:
- `artifacts/{feature}/05-ui-test-plan.md` — planned UI tests
- `artifacts/{feature}/03-scenarios.md` — BDD scenarios + test data
- `artifacts/{feature}/02-flow.md` — routes and component IDs to target
- `artifacts/{feature}/01-requirements.md` — API contracts
- Mountebank impostor config (validated in Stage 7) — canonical response shapes
- Any existing `e2e/*/fixtures/` from prior features — reuse the proven fixture/envelope pattern; do not invent a new one
- `epic.md` — this feature's **`depends-on`** list and **Shared Domain Entities** (drives the cross-feature journey specs below)
- `e2e/{dependency}/pages/` for every upstream feature this one depends on — reuse those committed page objects in journey specs; do not re-author them

## Task
Write the full Playwright suite for this feature — specs, page objects, fixtures — **before any implementation exists**.

### Failing-by-design
The app does not exist yet. The specs MUST compile (imports resolve, types check) but CANNOT pass — that is the point. Do not run them against a server; verify them with `npx playwright test e2e/{feature}/ --list` (collection only) and the project's typecheck command.

### Structure
```
e2e/
├── {feature}/
│   ├── {scenario-group}.spec.ts     # test file per independent scenario group
│   ├── journeys/                    # cross-feature journey specs (only if this feature depends-on others)
│   │   └── {dependency}-to-{feature}.spec.ts
│   ├── fixtures/
│   │   ├── test-data.ts             # entity fixtures
│   │   └── {api}-mock.ts            # network-intercept mocks (mock mode only)
│   └── pages/
│       └── {page-name}.page.ts      # Page Object Model
```

### Page Object Model
Create page objects for reusable page interactions:
```
class LoginPage:
  emailInput    = page.locator("#email")        // IDs from 02-flow.md — the contract
  passwordInput = page.locator("#password")
  submitButton  = page.locator("#login-submit")
  errorMessage  = page.locator("#login-error")

  function goto():            await page.goto("/login")
  function login(email, pw):  fill both, click submit
  function getErrorText():    return errorMessage.textContent()
```

### Spec Implementation
Map every BDD scenario to a Playwright test. Walking skeleton scenario FIRST.
```
describe "Login Feature":
  beforeEach: new LoginPage(page); goto()

  // Scenario: Successful login with valid credentials
  test "should login successfully with valid credentials":
    await loginPage.login(validUser.email, validUser.password)
    await expect(page).toHaveURL("/dashboard")
    await expect(page.locator("#welcome-message")).toBeVisible()
```

### Cross-Feature Journey Specs
Per-feature specs prove a feature works **in isolation** — they may set up preconditions by shortcut (seeded session, injected token, direct DB seed). That leaves the **seam between features untested**: a downstream feature can pass its own suite while the real handoff from an upstream feature is broken (e.g. auth passes, but the voice-clone flow breaks the moment a real logged-in user reaches it).

If this feature's `depends-on` list in `epic.md` is **non-empty**, author at least one journey spec per upstream dependency in `e2e/{feature}/journeys/{dependency}-to-{feature}.spec.ts`:

```
describe "Journey: auth → voice-clone":
  test "logged-in user can create and use a voice clone":
    // 1. Drive the REAL upstream flow via its committed page object — no shortcut
    await loginPage.goto()
    await loginPage.login(validUser.email, validUser.password)
    // 2. Continue into THIS feature, carrying the real produced state (session/token/shared entity)
    await voiceClonePage.goto()
    await voiceClonePage.create(sampleAudio)
    // 3. Assert the seam: the shared entity crosses the boundary intact
    await expect(voiceClonePage.cloneStatus()).toHaveText("ready")
```

Rules for journey specs:
- **No precondition shortcut.** The state the upstream feature produces (auth session, created entity, granted permission) MUST be produced by driving the upstream feature's real flow through its page objects — never seeded or injected. This is the one place that rule is mandatory; isolated feature specs may still shortcut for speed.
- **Reuse, don't re-author** the upstream feature's page objects from `e2e/{dependency}/pages/`.
- **Trace the Shared Domain Entity.** Pick the entity from `epic.md`'s Shared Domain Entities table that crosses the dependency edge, and assert it survives the boundary with identical field names/IDs.
- **Most meaningful in integration mode** (Stage 25, real backend). In mock mode each upstream call is stubbed from the canonical envelope; in integration mode the seam is real — that is where these specs earn their keep.
- One journey per dependency edge is the floor; add more only for genuinely distinct cross-feature flows (no speculative combinations — `simple-design`).

### Canonical Mock Fixtures — single source of truth
Mock fixtures (used in mock mode, Stage 21) MUST be derived from the same contract the real backend implements:
1. **Copy the response envelope from the Mountebank impostors** (validated in Stage 7) — exact field names, nesting, serialization envelope (e.g. tRPC + superjson: `[{ result: { data: { json: <payload>, meta: { values: {} } } } }]`). If a prior feature's fixture passes integration, reuse its envelope helper verbatim.
2. **Every entity ID** in fixtures must match an ID in the impostor/seed data.
3. **Every test action** must have a matching stub (path + method + body predicate).
4. **Mock only in mock mode** — gate network interception so integration runs (Stage 25) hit the real backend. A spec that installs mocks unconditionally is a contract violation: it makes Stage 25 test the mocks, not the system.
5. **Model state transitions, not static snapshots.** If a spec asserts a *change* — an empty list becoming populated, a count delta, a record visible only after a write — the mock MUST be **stateful**: the response to a read changes after the matching write is intercepted (e.g. `GET /clients` returns `[]` until a `POST /clients` is seen, then returns `[created]`). A static stub that returns the post-write state on the very first read makes the spec's empty-state / exact-count assertions **unreachable in mock mode** — a self-contradicting contract the mock can never satisfy. Never return a pre-populated list for a flow whose real backend starts empty (a fresh user, a clean DB). **Before finishing, walk each spec's assertions and confirm its mock can actually produce every asserted state** — an empty→1 assertion against a mock that always returns 1 is the bug, caught here, not three stages later as a Contract Dispute.

### Parallel Execution & Test Isolation
Tests must support **two execution modes** (see `guidelines/e2e-test-isolation.md`):
1. **Mock mode (parallel)**: Mountebank/intercepts, no shared state, `fullyParallel: true`.
2. **Integration mode**: real backend + DB; per-worker isolation or DB reset in `beforeEach`.

**Grouping rules**: scenarios sharing state flow → same spec file; independent groups → separate spec files; every spec file self-contained.

### DB Reset Fixture
`e2e/{feature}/fixtures/db-reset` — executes seed-reset against the test DB in integration mode; no-op in mock mode.

### Dynamic Test Data
Never hardcode dates/timestamps — use computed getters (`get startTime() { return futureTime(2); }`).

### Constraints
- Walking skeleton spec FIRST
- Page Object Model for all interactions; target elements ONLY by IDs defined in `02-flow.md`
- Map every BDD scenario to a test; tests independent; no hardcoded waits or dates
- If `epic.md` lists any `depends-on` for this feature, author the cross-feature journey spec(s) — driving the real upstream flow, no precondition shortcuts
- Specs must compile and collect (`--list`); they must NOT be run against a server in this stage

## Output
- `e2e/{feature}/` — spec files, page objects, fixtures (compiling, failing-by-design)
- `e2e/{feature}/journeys/` — one cross-feature journey spec per `depends-on` edge (if any)
- Update `artifacts/{feature}/05-ui-test-plan.md` — mark each planned test as authored, note spec file
- Record in `track-handoffs.md` (Pre-Dev section): spec inventory (incl. journey specs + the dependency edge each covers) + the canonical mock envelope used

## Done
Summarize:
- Specs authored / scenarios planned
- Journey specs authored (one per `depends-on` edge) + the seam each asserts
- Page objects and fixtures created
- Canonical envelope source (which impostor / prior feature)

Ask: "E2E specs authored (failing by design). Type **continue** to proceed to Stage 8: Plan Development."
