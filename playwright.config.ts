// Canonical E2E config (adapted from saas-factory/templates/playwright.config.ts to
// .claude/tech-stack-profile.md → Playwright Config).
//
// ── HOW TO RUN E2E ──────────────────────────────────────────────────────────────
//   bash .claude/scripts/run-e2e.sh F-1 list     → one feature
//   bash .claude/scripts/run-e2e.sh "" list      → full suite
// Never prefix with env vars; never run against a production-mode server.
//
// ── MODES ───────────────────────────────────────────────────────────────────────
// The specs install NO network interception. The mode is decided by where the Vite dev server's
// `/api` proxy points, so an integration run can never silently test a mock:
//   E2E_MODE=integration (default, Stage 25): /api → NestJS http://localhost:3000 → Postgres
//   E2E_MODE=mock        (Stage 21/23):       /api → Mountebank impostor http://localhost:4545
//                                             (mocks/imposters.json, started with --allowInjection)
// The frontend's vite.config.ts MUST read API_PROXY_TARGET for its `/api` proxy target.
// Pass E2E_MODE through `bash .claude/scripts/run-with-env.sh E2E_MODE=mock -- …` when needed.
// ────────────────────────────────────────────────────────────────────────────────
import { defineConfig, devices } from '@playwright/test';

const mode = process.env.E2E_MODE === 'mock' ? 'mock' : 'integration';
const apiProxyTarget = mode === 'mock' ? 'http://localhost:4545' : 'http://localhost:3000';
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';

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
    : {
        command: 'npm --prefix frontend run dev', // development mode — never production
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { API_PROXY_TARGET: apiProxyTarget, PORT: '5173' },
      },
});
