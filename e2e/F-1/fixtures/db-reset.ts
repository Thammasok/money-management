// Brings the integration database to the Liquibase baseline this feature needs. No-op in mock mode
// (the impostor holds its own state, seeded with the same User).
//
// Contexts: F-1 has no `Depends On` in epic.md, so its closure is just the shared `test` context
// (the seeded User). A later feature's db-reset must list the contexts of its whole dependency
// closure (.claude/rules/e2e-contract.md → Seed contexts and fixture IDs).
//
// Contract with the backend track (Stage 10): the repo-root script `npm run db:reset` applies the
// Liquibase changelog with the contexts in LIQUIBASE_CONTEXTS against the test database. It must be
// idempotent and safe to run while the backend is up.
import { execFileSync } from 'node:child_process';

export const E2E_MODE: 'mock' | 'integration' = process.env.E2E_MODE === 'mock' ? 'mock' : 'integration';

export const LIQUIBASE_CONTEXTS = ['test'] as const;

export function resetDb(): void {
  if (E2E_MODE === 'mock') return;
  execFileSync('npm', ['run', 'db:reset'], {
    stdio: 'inherit',
    env: { ...process.env, LIQUIBASE_CONTEXTS: LIQUIBASE_CONTEXTS.join(',') },
  });
}
