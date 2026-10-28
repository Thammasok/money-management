import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.tokens';
import { SESSION_LIFETIME_DAYS, SIGN_IN_PAUSE_MINUTES } from './identity.constants';
import type {
  IIdentityRepository,
  SignInAttemptWindow,
} from './interfaces/identity-repository.interface';
import type { NewSession, Session } from './session.entity';
import type { NewUser, User } from './user.entity';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
}

interface SignInAttemptWindowRow {
  latest_attempt_at: Date | null;
  recent_count: number;
  database_now: Date;
}

const USER_COLUMNS = 'id, email, password_hash, created_at, updated_at';
const SESSION_COLUMNS = 'id, user_id, expires_at, created_at';

/** Postgres error code for a violated unique constraint. */
const UNIQUE_VIOLATION = '23505';
const USERS_EMAIL_KEY = 'users_email_key';

/**
 * Data Access for Users, Sessions and Sign-in Attempts. Parameterised SQL only; every time — session expiry, the
 * sign-in window, "now" — is Postgres `now()`, so no decision depends on the application server's clock.
 */
@Injectable()
export class IdentityRepository implements IIdentityRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertUser(newUser: NewUser): Promise<User | null> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING ${USER_COLUMNS}`,
        [newUser.email, newUser.passwordHash],
      );
      return toUser(rows[0]);
    } catch (error) {
      if (isUniqueViolation(error, USERS_EMAIL_KEY)) {
        return null;
      }
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email],
    );
    return rows.length === 0 ? null : toUser(rows[0]);
  }

  async findUserById(id: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    return rows.length === 0 ? null : toUser(rows[0]);
  }

  async insertSession(newSession: NewSession): Promise<Session> {
    const { rows } = await this.pool.query<SessionRow>(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, now() + make_interval(days => $3))
       RETURNING ${SESSION_COLUMNS}`,
      [newSession.id, newSession.userId, SESSION_LIFETIME_DAYS],
    );
    return toSession(rows[0]);
  }

  async slideSession(id: string): Promise<Session | null> {
    // One statement: only a still-valid Session is found, and it is moved in the same step.
    const { rows } = await this.pool.query<SessionRow>(
      `UPDATE sessions SET expires_at = now() + make_interval(days => $2)
       WHERE id = $1 AND expires_at > now()
       RETURNING ${SESSION_COLUMNS}`,
      [id, SESSION_LIFETIME_DAYS],
    );
    return rows.length === 0 ? null : toSession(rows[0]);
  }

  async deleteSession(id: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  async getSignInAttemptWindow(email: string): Promise<SignInAttemptWindow> {
    const { rows } = await this.pool.query<SignInAttemptWindowRow>(
      `WITH latest AS (
         SELECT max(attempted_at) AS attempted_at FROM sign_in_attempts WHERE email = $1
       )
       SELECT latest.attempted_at AS latest_attempt_at,
              (SELECT count(*)::int FROM sign_in_attempts
                WHERE email = $1
                  AND attempted_at > latest.attempted_at - make_interval(mins => $2)) AS recent_count,
              now() AS database_now
       FROM latest`,
      [email, SIGN_IN_PAUSE_MINUTES],
    );
    const row = rows[0];
    return {
      latestAttemptAt: row.latest_attempt_at,
      recentCount: row.recent_count,
      now: row.database_now,
    };
  }

  async insertSignInAttempt(email: string): Promise<void> {
    await this.pool.query('INSERT INTO sign_in_attempts (email) VALUES ($1)', [email]);
  }

  async deleteSignInAttempts(email: string): Promise<void> {
    await this.pool.query('DELETE FROM sign_in_attempts WHERE email = $1', [email]);
  }
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { code, constraint: violated } = error as { code?: unknown; constraint?: unknown };
  return code === UNIQUE_VIOLATION && violated === constraint;
}
