import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createPool } from '../../src/database/create-pool';

/**
 * The docker-compose.backing-service.yml database with the Liquibase `test` context applied (`npm run db:up`).
 * Published on host port 15432 by default. Override with TEST_DATABASE_URL only — never DATABASE_URL, so an
 * integration run can never be pointed at a real database by a stray variable in the shell.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@localhost:15432/money_management_test';

/** A small Pool built the production way (`createPool`), so tests read Postgres exactly as the app does. */
export function createTestPool(): Pool {
  return createPool(TEST_DATABASE_URL, { max: 2 });
}

/**
 * Moves a Wallet's `created_at` and `updated_at` an hour into the past, so that a change made afterwards is provably
 * later. JavaScript dates only carry milliseconds, and two fast statements can land in the same one — a test that
 * asserts "updatedAt moved on" without this would be flaky.
 */
export async function backdateWallet(pool: Pool, walletId: string): Promise<void> {
  await pool.query(
    `UPDATE wallets
     SET created_at = created_at - interval '1 hour', updated_at = updated_at - interval '1 hour'
     WHERE id = $1`,
    [walletId],
  );
}

/**
 * Resolves once some statement whose text contains `statementFragment` is waiting for a lock held by another
 * transaction, so a test can prove that a statement really started (and blocked) before it lets the lock go.
 * Rejects after about 5 seconds if it never blocks — which is how a missing lock shows up.
 */
export async function waitUntilWaitingForALock(
  pool: Pool,
  statementFragment: string,
): Promise<void> {
  const attempts = 250;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_stat_activity
       WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid() AND query LIKE '%' || $1 || '%'`,
      [statementFragment],
    );
    if (rows.length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`no statement containing "${statementFragment}" ever waited for a lock`);
}

/**
 * Stores one failed sign-in for `email`, `secondsAgo` seconds before the database's now(). Time is Postgres time
 * (there is no clock port), so this is how tests put an email at any point of its 15-minute window.
 */
export async function storeFailedSignIn(
  pool: Pool,
  email: string,
  secondsAgo: number,
): Promise<void> {
  await pool.query(
    'INSERT INTO sign_in_attempts (email, attempted_at) VALUES ($1, now() - make_interval(secs => $2))',
    [email, secondsAgo],
  );
}

/** A fresh lower-case email: every test owns its data, so tests never depend on each other or on earlier runs. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
}

/**
 * Stores a User directly and returns its id — for tests that need a Wallet owner. Inserted with SQL because the
 * Ledger never creates Users (Identity owns them); the hash is a placeholder nobody signs in with.
 */
export async function insertUser(pool: Pool, prefix = 'owner'): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [uniqueEmail(prefix), '$argon2id$placeholder-hash-nobody-signs-in-with'],
  );
  return rows[0].id;
}
