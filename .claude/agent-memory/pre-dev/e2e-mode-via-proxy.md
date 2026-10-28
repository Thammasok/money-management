---
name: e2e-mode-via-proxy
description: How this repo's E2E mock vs integration mode works (Vite proxy target, no page.route) and the shared test-data conventions set at F-1
metadata:
  type: project
---

Set at F-1 pre-dev (2026-10-28): E2E specs never install `page.route`. `playwright.config.ts` maps `E2E_MODE=mock` → `API_PROXY_TARGET=http://localhost:4545` (stateful Mountebank impostor of our own `/api/v1`), default integration → `http://localhost:3000`; the frontend's Vite proxy reads `API_PROXY_TARGET`. Every spec/Bruno test creates its own User with a unique email (`uniqueEmail(prefix)` / `{{runId}}`); one seeded User `seed.user@example.test` (id `0f100000-0000-4000-8000-000000000001`, `Seed-Pass-1`, Liquibase context `test`) exists in both the seed and the impostor. Reusable helpers: `e2e/F-1/fixtures/auth-api.ts` (`signUpViaApi` etc. via `page.request`).

**Why:** a single stateful double serves Bruno (Stage 7) and Playwright (Stage 21), so mock mode can't diverge between them and Stage 25 can never test a mock.
**How to apply:** later features extend `mocks/identity-api.inject.js`-style injections on port 4545, reuse F-1 page objects in `journeys/`, and list `test` + their own contexts in `db-reset.ts`. Never point throttle tests at the seeded User. See [[bruno-mountebank-quirks]].
