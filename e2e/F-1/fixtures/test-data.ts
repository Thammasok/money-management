// Canonical F-1 test data (artifacts/F-1/03-scenarios.md → Test Data).
// The seeded User and every message text are shared with the Liquibase `test` seed, the Mountebank
// impostor (mocks/identity-api.inject.js) and the Bruno collection (collection/F-1) — change all or none.
import { randomUUID } from 'node:crypto';

/** The one seeded User (Liquibase context `test`; mirrored in the impostor's initial state). */
export const SeedUser = {
  id: '0f100000-0000-4000-8000-000000000001',
  email: 'seed.user@example.test',
  password: 'Seed-Pass-1',
} as const;

export const Passwords = {
  valid: 'Sunny-Day-42',
  wrong: 'Not-The-Pass-1',
  minValid: 'abcdef1!',
  noSymbol: 'password1',
} as const;

export const Messages = {
  email: 'Enter a valid email address.',
  passwordRule: 'Password must be at least 8 characters and include a letter, a number, and a symbol.',
  taken: 'This email is already registered.',
  badCredentials: 'Email or password is incorrect.',
  pausedUiPrefix: 'Too many failed sign-ins. Try again at',
  notSignedIn: 'Not signed in.',
} as const;

/** Failures that pause an email (Q-42). */
export const FAILURES_TO_PAUSE = 10;

/**
 * A fresh, lower-case email no other test (or earlier run) uses — every scenario creates its own
 * User, so specs are independent of order and of what is already in the database.
 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
}
