import type { NestExpressApplication } from '@nestjs/platform-express';
import { Pool } from 'pg';
import request from 'supertest';
import { createTestApp } from './support/create-app';
import { createTestPool, storeFailedSignIn, uniqueEmail } from './support/database';

const PASSWORD = 'Sunny-Day-42';
const WRONG_PASSWORD = 'Not-The-Pass-1';

// The whole Identity stack — controller, guard, service, repository, real argon2id, real Postgres. Time-dependent
// rules are driven through rows' timestamps (there is no clock port): artifacts/F-1/06-api-test-plan.md IT-01..IT-06.
describe('Identity (HTTP, real Postgres)', () => {
  let app: NestExpressApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  const server = () => app.getHttpServer();

  const sessionIdFrom = (response: request.Response): string => {
    const cookies = (response.headers['set-cookie'] ?? []) as unknown as string[];
    const sid = cookies.find((cookie) => cookie.startsWith('sid='));
    if (sid === undefined) throw new Error('the response carried no sid cookie');
    return sid.slice('sid='.length).split(';')[0];
  };

  async function signUp(email: string, password = PASSWORD) {
    const response = await request(server())
      .post('/api/v1/users')
      .send({ email, password })
      .expect(201);
    return { id: response.body.id as string, sid: sessionIdFrom(response) };
  }

  const signIn = (email: string, password: string) =>
    request(server()).post('/api/v1/sessions').send({ email, password });

  const me = (sid: string) => request(server()).get('/api/v1/me').set('Cookie', `sid=${sid}`);

  /** `count` failed sign-ins stored at `latestSecondsAgo`, `latestSecondsAgo + 1`, … seconds ago. */
  async function storeFailures(
    email: string,
    count: number,
    latestSecondsAgo: number,
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      await storeFailedSignIn(pool, email, latestSecondsAgo + i);
    }
  }

  const attemptCount = async (email: string): Promise<number> =>
    (
      await pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM sign_in_attempts WHERE email = $1',
        [email],
      )
    ).rows[0].n;

  const signOut = (sid: string) =>
    request(server()).delete('/api/v1/sessions/current').set('Cookie', `sid=${sid}`);

  // The skeleton journey as three independent slices, each through every layer down to Postgres; the whole
  // journey in one go is Bruno folder 02-walking-skeleton and the Playwright walking-skeleton spec.
  describe('walking skeleton: sign up, see who is signed in, sign out, sign in again (S-1)', () => {
    it('sign-up creates the User and a Session that identifies them', async () => {
      // Arrange
      const email = uniqueEmail('skeleton-up');

      // Act
      const signedUp = await signUp(email);

      // Assert
      const whoAmI = await me(signedUp.sid);
      expect(whoAmI.status).toBe(200);
      expect(whoAmI.body).toEqual({ id: signedUp.id, email });
    });

    it('sign-out ends the Session: the cookie is expired and the Session can no longer be used', async () => {
      // Arrange
      const { sid } = await signUp(uniqueEmail('skeleton-out'));

      // Act
      const signedOut = await signOut(sid);

      // Assert
      expect(signedOut.status).toBe(204);
      expect(signedOut.headers['set-cookie']).toEqual([expect.stringMatching(/^sid=;.*Max-Age=0/)]);
      expect((await me(sid)).status).toBe(401);
    });

    it('sign-in after signing out opens a new Session for the same User', async () => {
      // Arrange
      const email = uniqueEmail('skeleton-in');
      const first = await signUp(email);
      await signOut(first.sid).expect(204);

      // Act
      const signedIn = await signIn(email, PASSWORD);

      // Assert
      expect(signedIn.status).toBe(200);
      expect(signedIn.body).toEqual({ id: first.id, email });
      expect(sessionIdFrom(signedIn)).not.toBe(first.sid);
      expect((await me(sessionIdFrom(signedIn))).status).toBe(200);
    });
  });

  describe('IT-06: what sign-up stores', () => {
    it('keeps the password only as an argon2id hash and the email trimmed and lower-cased', async () => {
      // Arrange
      const email = uniqueEmail('stored');

      // Act
      const { id } = await signUp(`  ${email.toUpperCase()}  `);

      // Assert
      const { rows } = await pool.query<{ email: string; password_hash: string }>(
        'SELECT email, password_hash FROM users WHERE id = $1',
        [id],
      );
      expect(rows[0].email).toBe(email);
      expect(rows[0].password_hash.startsWith('$argon2id$')).toBe(true);
      expect(rows[0].password_hash).not.toContain(PASSWORD);
    });
  });

  describe('the sign-in pause (Q-42)', () => {
    it('IT-01: ends 15 minutes and 1 second after the latest of 10 failures; the correct password signs in and clears the failures (S-12)', async () => {
      // Arrange
      const email = uniqueEmail('pause-ends');
      await signUp(email);
      await storeFailures(email, 10, 15 * 60 + 1);

      // Act
      const response = await signIn(email, PASSWORD);

      // Assert
      expect(response.status).toBe(200);
      expect(await attemptCount(email)).toBe(0);
    });

    it('IT-02: still refuses 14 minutes after the 10th failure, with retryAt = latest + 15 minutes, storing nothing (S-19)', async () => {
      // Arrange
      const email = uniqueEmail('paused');
      await signUp(email);
      await storeFailures(email, 10, 14 * 60);
      const { rows } = await pool.query<{ latest: Date }>(
        'SELECT max(attempted_at) AS latest FROM sign_in_attempts WHERE email = $1',
        [email],
      );
      const latest = rows[0].latest;

      // Act
      const response = await signIn(email, PASSWORD);

      // Assert
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        statusCode: 429,
        message: 'Too many failed sign-ins. Try again later.',
        error: 'Too Many Requests',
        retryAt: expect.any(String),
      });
      expect(
        Math.abs(Date.parse(response.body.retryAt) - (latest.getTime() + 15 * 60 * 1000)),
      ).toBeLessThanOrEqual(1000);
      expect(await attemptCount(email)).toBe(10);
    });

    it('IT-05: counts failures only within 15 minutes of the latest one — 10 failures spread over 20 minutes do not pause', async () => {
      // Arrange: latest 2 minutes ago, then one more a minute earlier, … : only 6 within 15 minutes of the latest
      const email = uniqueEmail('spread');
      await signUp(email);
      for (const minutesAgo of [20, 19, 18, 17, 16, 10, 8, 6, 4, 2]) {
        await storeFailures(email, 1, minutesAgo * 60);
      }

      // Act
      const response = await signIn(email, PASSWORD);

      // Assert
      expect(response.status).toBe(200);
    });

    it('the 10th failure itself is an ordinary 401, not a refusal, and is stored (S-10)', async () => {
      // Arrange
      const email = uniqueEmail('tenth');
      await signUp(email);
      await storeFailures(email, 9, 60);

      // Act
      const response = await signIn(email, WRONG_PASSWORD);

      // Assert
      expect(response.status).toBe(401);
      expect(await attemptCount(email)).toBe(10);
    });
  });

  describe('Sessions (S-13)', () => {
    it('IT-03: a Session whose expiry has passed is refused with 401 "Not signed in."', async () => {
      // Arrange
      const { sid } = await signUp(uniqueEmail('expired'));
      await pool.query(
        "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id = $1",
        [sid],
      );

      // Act
      const response = await me(sid);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Not signed in.',
        error: 'Unauthorized',
      });
    });

    it('IT-04: a Session with a day left is accepted, now expires 30 days from now, and its cookie is re-sent with Max-Age=2592000', async () => {
      // Arrange
      const { sid } = await signUp(uniqueEmail('sliding'));
      await pool.query("UPDATE sessions SET expires_at = now() + interval '1 day' WHERE id = $1", [
        sid,
      ]);

      // Act
      const response = await me(sid);

      // Assert
      expect(response.status).toBe(200);
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies[0]).toContain(`sid=${sid}`);
      expect(cookies[0]).toContain('Max-Age=2592000');
      const { rows } = await pool.query<{ drift_ms: number }>(
        `SELECT abs(extract(epoch FROM (expires_at - (now() + interval '30 days'))) * 1000)::float8 AS drift_ms
         FROM sessions WHERE id = $1`,
        [sid],
      );
      expect(rows[0].drift_ms).toBeLessThan(5000);
    });
  });

  describe('sign-up under concurrency', () => {
    it('two simultaneous sign-ups with one email yield exactly one User (201) and one 409, whichever wins the race (S-14)', async () => {
      // Arrange
      const email = uniqueEmail('race');
      const post = () =>
        request(server()).post('/api/v1/users').send({ email, password: PASSWORD });

      // Act
      const [a, b] = await Promise.all([post(), post()]);

      // Assert
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const { rows } = await pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM users WHERE email = $1',
        [email],
      );
      expect(rows[0].n).toBe(1);
    });
  });

  describe('a burst of parallel wrong guesses (the pause cannot be raced)', () => {
    it('lets exactly 10 guesses through the check and refuses the other 5 with 429, however they interleave', async () => {
      // Arrange
      const email = uniqueEmail('burst');
      await signUp(email);

      // Act
      const outcomes = await Promise.all(
        Array.from({ length: 15 }, () => signIn(email, WRONG_PASSWORD)),
      );

      // Assert
      const statuses = outcomes.map((outcome) => outcome.status);
      expect(statuses.filter((status) => status === 401)).toHaveLength(10);
      expect(statuses.filter((status) => status === 429)).toHaveLength(5);
      expect(await attemptCount(email)).toBe(10);
    });
  });

  describe('HTTP hardening', () => {
    it('refuses a form post to sign in (cross-site login CSRF) with 415, issuing no Session', async () => {
      // Arrange
      const email = uniqueEmail('csrf');
      const { id } = await signUp(email);
      const sessionsBefore = await pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM sessions WHERE user_id = $1',
        [id],
      );

      // Act
      const response = await request(server())
        .post('/api/v1/sessions')
        .type('form')
        .send({ email, password: PASSWORD });

      // Assert
      expect(response.status).toBe(415);
      expect(response.headers['set-cookie']).toBeUndefined();
      const sessionsAfter = await pool.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM sessions WHERE user_id = $1',
        [id],
      );
      expect(sessionsAfter.rows[0].n).toBe(sessionsBefore.rows[0].n);
    });

    it('sends security headers on every response, never reveals the framework, and forbids caching', async () => {
      // Arrange / Act
      const response = await me('not-a-session');

      // Assert
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('does not store a failed guess whose email is longer than any User can have', async () => {
      // Arrange
      const email = 'a'.repeat(242) + '@example.test';

      // Act
      const response = await signIn(email, WRONG_PASSWORD);

      // Assert
      expect(response.status).toBe(400);
      expect(await attemptCount(email)).toBe(0);
    });
  });

  describe('routing', () => {
    it('answers an unknown route with a Nest-shaped 404, not a 401', async () => {
      // Arrange / Act
      const response = await request(server()).get('/api/v1/nothing-here');

      // Assert
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        statusCode: 404,
        message: 'Cannot GET /api/v1/nothing-here',
        error: 'Not Found',
      });
    });
  });
});
