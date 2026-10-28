// Brings the integration database to the Liquibase baseline F-2 needs. No-op in mock mode (the impostor holds
// its own state).
//
// Contexts: F-2's `Depends On` closure in epic.md is F-1, whose only seed context is `test` (the seeded User).
// F-2 adds no seed data — every spec creates its own User and Wallets — so the list stays ['test'].
// Re-check this list whenever a dependency gains a context (.claude/rules/e2e-contract.md → Seed contexts).
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
