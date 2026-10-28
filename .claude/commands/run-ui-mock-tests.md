---
description: Stage 21 of 28 — run Playwright against the mock API server. Invoked by the frontend track agent.
user-invocable: false
---
# /project:run-ui-mock-tests

## Stage
21 of 28 — Run UI Mock Tests (Playwright + Mock API)

## Setup
**Role**: `roles/qa.md`
**Guidelines**:
- `guidelines/test-pyramid.md`
- `guidelines/mockist-testing.md`
- `guidelines/e2e-test-isolation.md`

## Consideration Skills
Invoke these during this stage if guidance is needed:
- `/project:test-pyramid` — when deciding what type of test to write
- `/project:mockist-testing` — when deciding what to mock vs keep real

## Input
- Playwright test files from Stage 20
- Mountebank impostor configuration from Stage 6
- Frontend application code

## Task
Run Playwright tests against the frontend with a mock API server (Mountebank).

### Environment
```
Real frontend application
  + Mock API server (Mountebank — simulates backend)
  + No real backend, no real database
```

### Pre-Flight Checklist
Before starting tests, verify:

1. **Proxy configuration**: If the frontend uses relative API URLs (e.g., `fetch('/api/v1/...')`), configure the dev server proxy to forward to Mountebank:
   ```
   // Dev server config (e.g., vite.config, webpack devServer, etc.)
   proxy:
     "/api/v1" -> target: "http://localhost:3000", changeOrigin: true
   ```
2. **Port conflicts**: If docker-compose is running Mountebank for other purposes (e.g., FeatBit), either stop it and run Mountebank locally with combined imposters, or add the API imposter via the Mountebank REST API
3. **WebSocket tests**: Mountebank does not support WebSocket. Tag WebSocket-dependent tests with `test.skip()` and a comment explaining they require a real backend (Stage 25)
4. **Playwright browsers**: Ensure browsers are installed (run `playwright install chromium` via your package manager)
5. **Static mock awareness**: Verify that container components use optimistic state updates (from Stage 19), not re-fetch after mutations — static Mountebank stubs always return the same data

### Execution Steps

1. **Start Mountebank** with API impostors (combine with other imposters if needed):
   ```bash
   mb start --configfile mocks/imposters.json --allowInjection
   ```

2. **Verify impostors** are responding:
   ```bash
   curl http://localhost:2525/imposters
   curl http://localhost:3000/api/v1/floor  # mock API endpoint
   ```

3. **Verify proxy** works end-to-end:
   ```bash
   curl http://localhost:5173/api/v1/floor  # through dev server proxy
   ```

4. **Start the frontend** dev server:
   ```bash
   # Use your package manager's dev command, e.g.:
   # npm run dev / yarn dev / pnpm dev
   ```

5. **Run Playwright tests in parallel** (mock mode — no shared state):
   ```bash
   # Mock mode uses parallel workers for speed.
   # Ensure playwright.config has: fullyParallel: true
   # Each spec file runs in its own worker process.
   bash .claude/scripts/run-e2e.sh {feature}
   ```

   **Note**: If tests were written for sequential execution with shared state
   between spec files, they will fail in parallel. Fix by making each spec file
   self-contained (see `guidelines/e2e-test-isolation.md`).

6. **Analyze results**:
   - ALL tests should pass against mock API
   - If tests fail:
     - UI rendering issue → fix component
     - Mock response mismatch → fix impostor config
     - Test selector issue → fix page object or test
   - Review Playwright HTML report and trace files for failures

7. **Cleanup**:
   ```bash
   mb stop
   ```

### Failure Protocol
If tests fail:
1. Open Playwright HTML report: `playwright show-report` (via your package manager)
2. Check trace for failing test (screenshots, network, console)
3. Categorize failure:
   - **Component bug** → fix component, re-run component test + Playwright
   - **Mock mismatch** → fix Mountebank impostor, re-run
   - **Test bug** → fix Playwright test, re-run
4. Re-run ALL tests after fix

### Success Criteria
- [ ] All Playwright tests pass against mock API
- [ ] Walking skeleton E2E flow works
- [ ] All scenarios pass
- [ ] No flaky tests (run twice to confirm)

## Output
Playwright test results and report. Update `artifacts/{feature}/07-development-plan.md`.

## Done
Summarize:
- Tests passed / failed / total
- Any fixes applied
- Playwright report location

Ask: "All UI mock tests passed. Type **continue** to proceed to Stage 22: Beautify UI."
