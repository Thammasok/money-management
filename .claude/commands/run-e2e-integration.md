---
description: Stage 25 of 28 — run the full Playwright E2E suite against real API + DB with mocked third parties. Invoked by the frontend track agent.
user-invocable: false
---
# /project:run-e2e-integration

## Stage
25 of 28 — Run Full E2E Integration Tests

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/test-pyramid.md`
- `guidelines/walking-skeleton.md`
- `guidelines/sequential-test-data.md`
- `guidelines/e2e-test-isolation.md`
- `guidelines/parallel-test-infrastructure.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:walking-skeleton` — when identifying or implementing the skeleton scenario
- `/project:diagnose-integration-failures` — when a test fails in integration but passed in mock mode
- `/project:parallel-test-infrastructure` — when setting up per-worker DB isolation
- `/project:e2e-test-isolation` — when deciding isolation strategy

## Input
- Playwright test files
- All backend and frontend source code
- docker-compose.backing-service.yml
- Mountebank impostor configuration (for 3rd party mocks only)

## Task
Run ALL Playwright E2E tests against the full integrated stack: real frontend + real backend API + real database + mock 3rd party only.

> **Verify-then-tick — applies to EVERY step below.** Only mark a stage `[x]` in `checklist.md` after that step has actually EXECUTED and reported success this run. Two traps that produce a falsely-checked stage:
> - **`run-e2e.sh {feature} list` is the list REPORTER — it RUNS the specs** (it is NOT `--list`, which only enumerates). Read the per-spec result: a `✓`/`passed` on every spec is the only pass signal. A spec being *discovered/collected* — including a green count from Stage 20's `--list` — is NOT a pass.
> - A `✘`/`failed` spec is a REAL defect (e.g. missing `data-testid`s on the route under test). Open that spec, run it, fix the **app** (never edit or skip the spec), and re-run until green. Do not advance or tick the stage on an unverified assumption.

### Environment (Full Integration)
```
Per worker:
  Real frontend (Vite dev server)
    + Real backend API server
    + Real database (per-worker clone)
    + Mock 3rd party ONLY (Mountebank — shared, read-only)
```

This is the final verification — everything is real except external 3rd party services.

### Execution Steps

1. **Start backing services** (DB + Liquibase migrations + Mountebank):
   ```bash
   docker compose -f docker-compose.backing-service.yml up -d
   ```
   The `migrations` service runs Liquibase with `--contexts=test` automatically (schema + seed data), then exits. No manual Liquibase CLI needed.

2. **Wait for services to be ready**:
   ```bash
   docker compose -f docker-compose.backing-service.yml ps
   # db and mountebank should show "healthy"
   # migrations should show "exited (0)"
   ```

4. **Ensure per-worker infrastructure is configured**:
   Verify these files exist and are correctly implemented:
   - `e2e/global-setup.ts` — creates per-worker databases via `CREATE DATABASE ... TEMPLATE`
   - `e2e/global-teardown.ts` — drops per-worker databases
   - `e2e/worker-isolation.ts` — worker-scoped fixtures (per-worker backend + Vite + DB reset)
   - `playwright.config.ts` — `fullyParallel: true`, dynamic workers, globalSetup/Teardown. Must follow `templates/playwright.config.ts` — especially its run-via-`run-e2e.sh` header. If the project's config carries stale advice (e.g. recommending env-var prefixes like `USE_PROD_SERVER=1` or `SKIP_WEBSERVER=1` as manual prefixes), replace the comments with the template's header — agents follow in-repo comments at face value.
   - `vite.config.ts` — `VITE_API_PROXY_TARGET` env-based proxy target
   
   If not configured, see `guidelines/parallel-test-infrastructure.md` for the full pattern.

5. **Build the backend** (workers spawn `node dist/main.js`):
   ```bash
   cd backend && npm run build
   ```

6. **Run current feature E2E tests first** (fast feedback):
   ```bash
   bash .claude/scripts/run-e2e.sh {feature} list
   ```

   Run only the current feature's tests first for fast feedback. If any fail, fix them
   before proceeding to the full regression run. This avoids wasting time on a full
   suite run when the feature itself is broken.

   If ALL feature tests pass, proceed to step 7.
   If ANY feature test fails → fix and re-run step 6 until green.

7. **Run ALL Playwright tests across the entire project** (full regression):
   ```bash
   bash .claude/scripts/run-e2e.sh "" list
   ```

   Run EVERY E2E test in the project — not just tests for this feature. This ensures
   the current feature has not broken any existing functionality. All test suites must
   pass, including those outside the current feature scope.

   Tests run fully parallel. Each worker spawns its own backend and Vite dev server,
   pointing to its own cloned database. Per-test `resetDb()` in `beforeEach` resets
   each worker's DB to clean seed state.

   Override workers with `PLAYWRIGHT_WORKERS=1` for sequential fallback.

8. **Run ALL backend API tests** (Bruno) — reset DB first:
   ```bash
   # Reset canonical DB before Bruno (Playwright worker DBs are separate)
   docker exec -i <db-container> psql -U <user> -d <db> < db/seed-reset.sql
   bruno run collection/{feature} --env integration
   ```

9. **Run ALL unit tests** (both frontend and backend):
   ```bash
   # These don't depend on DB state, but verify nothing is broken
   <frontend-test-runner>
   <backend-test-runner>
   ```

10. **Analyze results**:
   - ALL Playwright E2E tests must pass
   - ALL Bruno API tests must pass
   - ALL unit tests must pass
   - Zero failures allowed

11. **Teardown** (only when completely done):
    ```bash
    docker-compose -f docker-compose.backing-service.yml down -v
    ```

### Per-Worker Isolation Architecture

Each Playwright worker gets a fully isolated stack:
```
Worker i:
  Vite :15100+i  →  Backend :13100+i  →  DB {feature}_test_w{i}
```

**Global setup** creates N databases by:
1. Dumping schema from canonical DB (`pg_dump --schema-only`)
2. Creating a template DB with schema + seed data
3. Cloning per-worker DBs via `CREATE DATABASE ... TEMPLATE` (near-instant)

**Worker fixtures** spawn per-worker backend + Vite dev server with worker-specific ports and DB.

**Per-test reset** runs `seed-reset.sql` against the worker's own DB via `resetDb()` fixture.

**Global teardown** drops all worker databases and the template.

See `guidelines/parallel-test-infrastructure.md` for full implementation details.

### Common Integration Issues

When a test passes in mock mode (Stage 21) but fails in integration:

1. **API contract mismatch** — frontend expects different response shape than backend returns
2. **Authentication/session handling** — auth tokens lost on page navigation (use sessionStorage persistence)
3. **Timezone mismatch** — DB stores timestamps differently than JavaScript (use consistent local-time extraction)
4. **Dynamic test data** — hardcoded dates become stale (use computed getters with `Date.now()`)
5. **Missing query parameters** — frontend API calls may need params the mock didn't require
6. **CORS configuration** — real backend may block cross-origin requests the mock allowed

Fix the root cause — do NOT modify tests to work around integration issues.

### Success Criteria
- [ ] Current feature E2E tests pass first (step 6)
- [ ] ALL Playwright E2E tests pass with real backend (full regression, step 7) — entire project, not just current feature
- [ ] All Bruno API tests pass with real backend
- [ ] All unit/component tests still pass
- [ ] Walking skeleton flow works end-to-end through real stack
- [ ] All scenarios work end-to-end through real stack
- [ ] Cross-feature journey specs (`e2e/*/journeys/`) pass against the real backend — these assert the seams between dependent features and are the layer most likely to expose an integration break a feature's own suite missed
- [ ] No test skipped or ignored
- [ ] No regressions in tests outside the current feature scope

## Output
Full test execution results. Update `artifacts/{feature}/07-development-plan.md`.

## Done
Summarize:
- E2E tests: passed / failed / total
- API tests: passed / failed / total
- Unit tests: passed / failed / total
- Workers used / execution time
- Full stack integration verified

Ask: "Full E2E integration tests passed. Type **continue** to proceed to Stage 26: Plan Deployment."
