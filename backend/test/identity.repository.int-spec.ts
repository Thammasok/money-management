import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { Argon2PasswordHasher } from '../src/identity/argon2-password-hasher';
import { IdentityRepository } from '../src/identity/identity.repository';
import { createTestPool, storeFailedSignIn, uniqueEmail } from './support/database';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// Data Access under test: nothing mocked — real Postgres, schema and seed from Liquibase.
describe('IdentityRepository (real Postgres)', () => {
  let pool: Pool;
  let repository: IdentityRepository;

  beforeAll(() => {
    pool = createTestPool();
    repository = new IdentityRepository(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const newSessionId = (): string => randomBytes(32).toString('base64url');
  const databaseNow = async (): Promise<Date> =>
    (await pool.query<{ now: Date }>('SELECT now() AS now')).rows[0].now;

  async function aStoredUser(prefix = 'user') {
    const user = await repository.insertUser({
      email: uniqueEmail(prefix),
      passwordHash: '$argon2id$stored-hash',
    });
    if (user === null) throw new Error('arrange failed: email was already taken');
    return user;
  }

  describe('users', () => {
    it('stores a User and returns it with a generated UUID and timestamps', async () => {
      // Arrange
      const email = uniqueEmail('insert');

      // Act
      const user = await repository.insertUser({ email, passwordHash: '$argon2id$some-hash' });

      // Assert
      expect(user).not.toBeNull();
      expect(user?.id).toMatch(UUID_SHAPE);
      expect(user?.email).toBe(email);
      expect(user?.passwordHash).toBe('$argon2id$some-hash');
      expect(user?.createdAt).toBeInstanceOf(Date);
      expect(user?.updatedAt).toBeInstanceOf(Date);
    });

    it('returns null for a second User with the same email, and leaves the first User untouched (S-14)', async () => {
      // Arrange
      const first = await aStoredUser('dup');

      // Act
      const second = await repository.insertUser({
        email: first.email,
        passwordHash: 'another-hash',
      });

      // Assert
      expect(second).toBeNull();
      const stored = await repository.findUserByEmail(first.email);
      expect(stored?.id).toBe(first.id);
      expect(stored?.passwordHash).toBe('$argon2id$stored-hash');
    });

    it('lets the database refuse an email that is not lower-case, so "unique" means case-insensitively unique', async () => {
      // Arrange
      const email = uniqueEmail('Mixed').replace('mixed', 'MiXed');

      // Act
      const outcome = repository.insertUser({ email, passwordHash: 'hash' });

      // Assert
      await expect(outcome).rejects.toThrow(/users_email_lower_case/);
    });

    it('finds a User by email', async () => {
      // Arrange
      const stored = await aStoredUser('find-email');

      // Act
      const found = await repository.findUserByEmail(stored.email);

      // Assert
      expect(found).toEqual(stored);
    });

    it('finds a User by id', async () => {
      // Arrange
      const stored = await aStoredUser('find-id');

      // Act
      const found = await repository.findUserById(stored.id);

      // Assert
      expect(found).toEqual(stored);
    });

    it('finds nobody for an unknown email or id', async () => {
      // Arrange
      const unknownEmail = uniqueEmail('ghost');
      const unknownId = '00000000-0000-4000-8000-0000000000ff';

      // Act
      const byEmail = await repository.findUserByEmail(unknownEmail);
      const byId = await repository.findUserById(unknownId);

      // Assert
      expect(byEmail).toBeNull();
      expect(byId).toBeNull();
    });

    it("holds the seeded test User whose Liquibase-computed hash verifies with the app's hasher (S-2)", async () => {
      // Arrange
      const hasher = new Argon2PasswordHasher();

      // Act
      const seeded = await repository.findUserByEmail('seed.user@example.test');

      // Assert
      expect(seeded?.id).toBe('0f100000-0000-4000-8000-000000000001');
      expect(seeded?.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await hasher.verify(seeded?.passwordHash ?? '', 'Seed-Pass-1')).toBe(true);
      expect(await hasher.verify(seeded?.passwordHash ?? '', 'Seed-Pass-2')).toBe(false);
    });
  });

  describe('sessions', () => {
    it('opens a Session that expires 30 days from now (database time)', async () => {
      // Arrange
      const user = await aStoredUser('session');
      const id = newSessionId();

      // Act
      const session = await repository.insertSession({ id, userId: user.id });

      // Assert
      const now = await databaseNow();
      expect(session.id).toBe(id);
      expect(session.userId).toBe(user.id);
      expect(Math.abs(session.expiresAt.getTime() - (now.getTime() + 30 * DAY_MS))).toBeLessThan(
        5000,
      );
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('slides a valid Session to 30 days from now (S-13)', async () => {
      // Arrange
      const user = await aStoredUser('slide');
      const { id } = await repository.insertSession({ id: newSessionId(), userId: user.id });
      await pool.query("UPDATE sessions SET expires_at = now() + interval '1 day' WHERE id = $1", [
        id,
      ]);

      // Act
      const slid = await repository.slideSession(id);

      // Assert
      const now = await databaseNow();
      expect(slid?.userId).toBe(user.id);
      expect(
        Math.abs((slid?.expiresAt.getTime() ?? 0) - (now.getTime() + 30 * DAY_MS)),
      ).toBeLessThan(5000);
    });

    it('answers null for an unknown Session id', async () => {
      // Arrange
      const unknown = newSessionId();

      // Act
      const slid = await repository.slideSession(unknown);

      // Assert
      expect(slid).toBeNull();
    });

    it('answers null for an expired Session and does not revive it (S-13)', async () => {
      // Arrange
      const user = await aStoredUser('expired');
      const { id } = await repository.insertSession({ id: newSessionId(), userId: user.id });
      await pool.query(
        "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE id = $1",
        [id],
      );

      // Act
      const slid = await repository.slideSession(id);

      // Assert
      expect(slid).toBeNull();
      const stillExpired = await pool.query(
        'SELECT expires_at < now() AS expired FROM sessions WHERE id = $1',
        [id],
      );
      expect(stillExpired.rows[0].expired).toBe(true);
    });

    it("deletes exactly the one Session; the User's other Session stays (S-4)", async () => {
      // Arrange
      const user = await aStoredUser('two-sessions');
      const a = await repository.insertSession({ id: newSessionId(), userId: user.id });
      const b = await repository.insertSession({ id: newSessionId(), userId: user.id });

      // Act
      await repository.deleteSession(a.id);

      // Assert
      expect(await repository.slideSession(a.id)).toBeNull();
      expect((await repository.slideSession(b.id))?.id).toBe(b.id);
    });

    it('treats deleting an unknown Session as a no-op', async () => {
      // Arrange
      const unknown = newSessionId();

      // Act
      const outcome = repository.deleteSession(unknown);

      // Assert
      await expect(outcome).resolves.toBeUndefined();
    });
  });

  describe('sign-in attempts', () => {
    it('reports no failures for an email that has none', async () => {
      // Arrange
      const email = uniqueEmail('clean');

      // Act
      const window = await repository.getSignInAttemptWindow(email);

      // Assert
      expect(window.latestAttemptAt).toBeNull();
      expect(window.recentCount).toBe(0);
      expect(window.now).toBeInstanceOf(Date);
    });

    it('stores each failed sign-in at database time and counts them', async () => {
      // Arrange
      const email = uniqueEmail('count');

      // Act
      await repository.insertSignInAttempt(email);
      await repository.insertSignInAttempt(email);
      await repository.insertSignInAttempt(email);
      const window = await repository.getSignInAttemptWindow(email);

      // Assert
      expect(window.recentCount).toBe(3);
      expect(
        Math.abs((window.latestAttemptAt?.getTime() ?? 0) - window.now.getTime()),
      ).toBeLessThan(5000);
    });

    it('takes its "now" from Postgres', async () => {
      // Arrange
      const email = uniqueEmail('now');

      // Act
      const window = await repository.getSignInAttemptWindow(email);

      // Assert
      const now = await databaseNow();
      expect(Math.abs(window.now.getTime() - now.getTime())).toBeLessThan(5000);
    });

    it('counts only the 15 minutes up to the latest failure (IT-05)', async () => {
      // Arrange: 10 failures spread over 20 minutes, 6 of them within 15 minutes of the latest
      const email = uniqueEmail('spread');
      for (const minutesAgo of [20, 19, 18, 17, 16, 10, 8, 6, 4, 2]) {
        await storeFailedSignIn(pool, email, minutesAgo * 60);
      }

      // Act
      const window = await repository.getSignInAttemptWindow(email);

      // Assert: the latest is 2 minutes ago, so the window is (17 minutes ago, 2 minutes ago]
      expect(window.recentCount).toBe(6);
    });

    it('excludes a failure exactly 15 minutes before the latest one', async () => {
      // Arrange: both rows are computed from the same now(), so they are exactly 15 minutes apart
      const email = uniqueEmail('boundary');
      await pool.query(
        `INSERT INTO sign_in_attempts (email, attempted_at)
         SELECT $1, now() - interval '1 minute' UNION ALL SELECT $1, now() - interval '16 minutes'`,
        [email],
      );

      // Act
      const window = await repository.getSignInAttemptWindow(email);

      // Assert
      expect(window.recentCount).toBe(1);
    });

    it('counts per email', async () => {
      // Arrange
      const paused = uniqueEmail('paused');
      const other = uniqueEmail('other');
      await repository.insertSignInAttempt(paused);
      await repository.insertSignInAttempt(paused);

      // Act
      const window = await repository.getSignInAttemptWindow(other);

      // Assert
      expect(window.recentCount).toBe(0);
    });

    it("deletes one email's failures and leaves every other email's alone", async () => {
      // Arrange
      const cleared = uniqueEmail('cleared');
      const kept = uniqueEmail('kept');
      await repository.insertSignInAttempt(cleared);
      await repository.insertSignInAttempt(cleared);
      await repository.insertSignInAttempt(kept);

      // Act
      await repository.deleteSignInAttempts(cleared);

      // Assert
      expect((await repository.getSignInAttemptWindow(cleared)).recentCount).toBe(0);
      expect((await repository.getSignInAttemptWindow(kept)).recentCount).toBe(1);
    });
  });
});
