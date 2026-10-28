// Canonical E2E config (adapted from saas-factory/templates/playwright.config.ts to
// .claude/tech-stack-profile.md → Playwright Config).
//
// ── HOW TO RUN E2E ──────────────────────────────────────────────────────────────
//   Integration (default, Stage 25 and the e2e-gate):
//     bash .claude/scripts/run-e2e.sh F-1 list      → one feature
//     bash .claude/scripts/run-e2e.sh "" list       → full suite
//   Mock (Stage 21/23) needs E2E_MODE=mock, and the only sanctioned way to pass env is the run-with-env wrapper:
//     bash .claude/scripts/run-with-env.sh E2E_MODE=mock -- bash .claude/scripts/run-e2e.sh F-1 list
//   ⚠ That wrapper is NOT in the sandbox's excludedCommands, so Chromium dies with "MachPortRendezvousServer:
//     Permission denied" when it runs sandboxed. Run THAT command with the Bash tool's dangerouslyDisableSandbox
//     (start the impostor first: `npm run mocks:start`, in the background). Never prefix with env vars; never run
//     against a production-mode server.
//
// ── MODES ───────────────────────────────────────────────────────────────────────
// The specs install NO network interception. The mode is decided by where the Vite dev server's
// `/api` proxy points, so an integration run can never silently test a mock:
//   E2E_MODE=integration (default, Stage 25): /api → NestJS http://localhost:3000 → Postgres
//       Self-provisioning: e2e/global-setup.ts brings Postgres (+ Liquibase `test` context) up and removes it again if
//       this run started it; the backend is built and started below. An already-running backend/Postgres is reused.
//   E2E_MODE=mock        (Stage 21/23):       /api → Mountebank impostor http://localhost:4545
//                                             (mocks/imposters.json, started with --allowInjection)
// The frontend's vite.config.ts reads API_PROXY_TARGET for its `/api` proxy target.
// ────────────────────────────────────────────────────────────────────────────────
import { defineConfig, devices } from '@playwright/test';

const mode = process.env.E2E_MODE === 'mock' ? 'mock' : 'integration';
const apiProxyTarget = mode === 'mock' ? 'http://localhost:4545' : 'http://localhost:3000';
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
// Same host port docker-compose.backing-service.yml publishes (POSTGRES_PORT overrides it there too).
const postgresPort = process.env.POSTGRES_PORT ?? '15432';

const frontendServer = {
  command: 'npm --prefix frontend run dev', // development mode — never production
  url: baseURL,
  reuseExistingServer: true,
  timeout: 120_000,
  env: { API_PROXY_TARGET: apiProxyTarget, PORT: '5173' },
};

// Built fresh so the server under test is always the current source. NODE_ENV stays unset on purpose: production mode
// would mark the session cookie `Secure`, and a browser drops that on plain http. 401 from /me means "up" to Playwright.
const backendServer = {
  command: 'npm --prefix backend run build && npm --prefix backend run start:prod',
  url: 'http://localhost:3000/api/v1/me',
  reuseExistingServer: true,
  timeout: 180_000,
  env: {
    DATABASE_URL: `postgresql://test:test@localhost:${postgresPort}/money_management_test`,
    PORT: '3000',
  },
};

export default defineConfig({
  testDir: './e2e',
  // One shared, seeded database in integration mode (tech-stack profile). Every spec creates its own
  // Users with unique emails, so they are order-independent; parallelism can be raised once
  // per-worker isolation exists (guidelines/parallel-test-infrastructure.md).
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html', // run-e2e.sh overrides with --reporter=list
  globalSetup: process.env.SKIP_WEBSERVER ? undefined : './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : mode === 'mock'
      ? [frontendServer]
      : [frontendServer, backendServer],
});
