import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/**
 * The docker-compose.backing-service.yml database with the Liquibase `test` context applied (`npm run db:up`).
 * Published on host port 15432 by default. Override with TEST_DATABASE_URL only — never DATABASE_URL, so an
 * integration run can never be pointed at a real database by a stray variable in the shell.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@localhost:15432/money_management_test';

export function createTestPool(): Pool {
  return new Pool({ connectionString: TEST_DATABASE_URL, max: 2 });
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
