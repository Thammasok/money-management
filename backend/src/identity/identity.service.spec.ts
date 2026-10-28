import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { deferred } from '../../test/support/deferred';
import { createIdentityRepositoryMock, createPasswordHasherMock } from '../../test/support/mocks';
import { IdentityService } from './identity.service';
import { SignInAttemptWindow } from './interfaces/identity-repository.interface';
import { KeyedMutex } from './keyed-mutex';
import { Session } from './session.entity';
import { User } from './user.entity';

const NOW = new Date('2026-10-28T12:00:00.000Z');
const MINUTE = 60 * 1000;
const SESSION_ID_SHAPE = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

function createService() {
  const repository = createIdentityRepositoryMock();
  const hasher = createPasswordHasherMock();

  // Defaults that every test may override: an email with no failed sign-ins, and a repository that echoes a Session.
  repository.getSignInAttemptWindow.mockResolvedValue(
    windowOf({ recentCount: 0, latestAttemptAt: null }),
  );
  repository.insertSession.mockImplementation(async ({ id, userId }) => aSession({ id, userId }));
  hasher.hash.mockResolvedValue('hash-of-something');

  return { service: new IdentityService(repository, hasher, new KeyedMutex()), repository, hasher };
}

function aUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'me@example.test',
    passwordHash: 'stored-hash',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function aSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'a'.repeat(43),
    userId: '11111111-1111-4111-8111-111111111111',
    expiresAt: new Date(NOW.getTime() + 30 * 24 * 60 * MINUTE),
    createdAt: NOW,
    ...overrides,
  };
}

function windowOf(overrides: Partial<SignInAttemptWindow>): SignInAttemptWindow {
  return { latestAttemptAt: null, recentCount: 0, now: NOW, ...overrides };
}

describe('IdentityService', () => {
  describe('signUp', () => {
    it('hashes the password, stores the User, opens a Session and returns the Session id with the User (S-1)', async () => {
      // Arrange
      const { service, repository, hasher } = createService();
      const user = aUser({ email: 'new@example.test' });
      hasher.hash.mockResolvedValue('argon2id-hash');
      repository.insertUser.mockResolvedValue(user);

      // Act
      const issued = await service.signUp({ email: 'new@example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(hasher.hash).toHaveBeenCalledWith('Sunny-Day-42');
      expect(repository.insertUser).toHaveBeenCalledWith({
        email: 'new@example.test',
        passwordHash: 'argon2id-hash',
      });
      expect(repository.insertSession).toHaveBeenCalledWith({
        id: expect.stringMatching(SESSION_ID_SHAPE),
        userId: user.id,
      });
      expect(issued.sessionId).toBe(repository.insertSession.mock.calls[0][0].id);
      expect(issued.user).toEqual({ id: user.id, email: 'new@example.test' });
    });

    it('never lets the password hash leave Identity', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.insertUser.mockResolvedValue(aUser({ passwordHash: 'secret-hash' }));

      // Act
      const issued = await service.signUp({ email: 'me@example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(JSON.stringify(issued)).not.toContain('secret-hash');
      expect(Object.keys(issued.user).sort()).toEqual(['email', 'id']);
    });

    it('answers 409 "This email is already registered." and opens no Session when the email is taken (S-14)', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.insertUser.mockResolvedValue(null);

      // Act
      const outcome = service.signUp({ email: 'taken@example.test', password: 'Sunny-Day-42' });

      // Assert
      await expect(outcome).rejects.toBeInstanceOf(ConflictException);
      await expect(outcome).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message: 'This email is already registered.',
          error: 'Conflict',
        },
      });
      expect(repository.insertSession).not.toHaveBeenCalled();
    });

    it('gives every Session its own random id', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.insertUser.mockResolvedValue(aUser());

      // Act
      const first = await service.signUp({ email: 'a@example.test', password: 'Sunny-Day-42' });
      const second = await service.signUp({ email: 'b@example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(first.sessionId).not.toBe(second.sessionId);
    });
  });

  describe('signIn', () => {
    it("opens a Session for the right password and clears the email's earlier failures (S-1, S-9)", async () => {
      // Arrange
      const { service, repository, hasher } = createService();
      const user = aUser();
      repository.findUserByEmail.mockResolvedValue(user);
      hasher.verify.mockResolvedValue(true);

      // Act
      const issued = await service.signIn({ email: 'me@example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(hasher.verify).toHaveBeenCalledWith('stored-hash', 'Sunny-Day-42');
      expect(repository.deleteSignInAttempts).toHaveBeenCalledWith('me@example.test');
      expect(repository.insertSignInAttempt).not.toHaveBeenCalled();
      expect(repository.insertSession).toHaveBeenCalledWith({
        id: expect.stringMatching(SESSION_ID_SHAPE),
        userId: user.id,
      });
      expect(issued).toEqual({
        sessionId: repository.insertSession.mock.calls[0][0].id,
        user: { id: user.id, email: 'me@example.test' },
      });
    });

    it('answers 401 "Email or password is incorrect." for a wrong password and stores the failed attempt (S-17)', async () => {
      // Arrange
      const { service, repository, hasher } = createService();
      repository.findUserByEmail.mockResolvedValue(aUser());
      hasher.verify.mockResolvedValue(false);

      // Act
      const outcome = service.signIn({ email: 'me@example.test', password: 'Not-The-Pass-1' });

      // Assert
      await expect(outcome).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(outcome).rejects.toMatchObject({
        response: {
          statusCode: 401,
          message: 'Email or password is incorrect.',
          error: 'Unauthorized',
        },
      });
      expect(repository.insertSignInAttempt).toHaveBeenCalledWith('me@example.test');
      expect(repository.insertSession).not.toHaveBeenCalled();
      expect(repository.deleteSignInAttempts).not.toHaveBeenCalled();
    });

    it('answers an unknown email with the very same 401 body as a wrong password, and stores the failed attempt too (S-18, S-20)', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.findUserByEmail.mockResolvedValue(null);

      // Act
      const outcome = service.signIn({ email: 'ghost@example.test', password: 'Sunny-Day-42' });

      // Assert
      await expect(outcome).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(outcome).rejects.toMatchObject({
        response: {
          statusCode: 401,
          message: 'Email or password is incorrect.',
          error: 'Unauthorized',
        },
      });
      expect(repository.insertSignInAttempt).toHaveBeenCalledWith('ghost@example.test');
      expect(repository.insertSession).not.toHaveBeenCalled();
    });

    it('still runs a password verification when the email is unknown, so timing does not reveal whether it exists', async () => {
      // Arrange
      const { service, repository, hasher } = createService();
      repository.findUserByEmail.mockResolvedValue(null);
      hasher.hash.mockResolvedValue('dummy-hash');
      hasher.verify.mockResolvedValue(false);

      // Act
      await service
        .signIn({ email: 'ghost@example.test', password: 'Sunny-Day-42' })
        .catch(() => undefined);

      // Assert
      expect(hasher.verify).toHaveBeenCalledTimes(1);
      expect(hasher.verify).toHaveBeenCalledWith('dummy-hash', 'Sunny-Day-42');
    });

    it('prepares its dummy hash once, not on every unknown-email sign-in', async () => {
      // Arrange
      const { service, repository, hasher } = createService();
      repository.findUserByEmail.mockResolvedValue(null);
      hasher.verify.mockResolvedValue(false);

      // Act
      await service
        .signIn({ email: 'a@example.test', password: 'Sunny-Day-42' })
        .catch(() => undefined);
      await service
        .signIn({ email: 'b@example.test', password: 'Sunny-Day-42' })
        .catch(() => undefined);

      // Assert
      expect(hasher.hash).toHaveBeenCalledTimes(1);
      expect(hasher.verify).toHaveBeenCalledTimes(2);
    });

    describe('the sign-in pause', () => {
      it('refuses with 429 and retryAt = latest failure + 15 minutes once 10 failures are recent, storing nothing (S-19)', async () => {
        // Arrange
        const { service, repository } = createService();
        const latest = new Date(NOW.getTime() - 5 * MINUTE);
        repository.getSignInAttemptWindow.mockResolvedValue(
          windowOf({ recentCount: 10, latestAttemptAt: latest }),
        );

        // Act
        const outcome = service.signIn({ email: 'locked@example.test', password: 'Sunny-Day-42' });

        // Assert
        await expect(outcome).rejects.toBeInstanceOf(HttpException);
        await expect(outcome).rejects.toMatchObject({
          status: 429,
          response: {
            statusCode: 429,
            message: 'Too many failed sign-ins. Try again later.',
            error: 'Too Many Requests',
            retryAt: new Date(latest.getTime() + 15 * MINUTE).toISOString(),
          },
        });
        expect(repository.insertSignInAttempt).not.toHaveBeenCalled();
        expect(repository.deleteSignInAttempts).not.toHaveBeenCalled();
        expect(repository.insertSession).not.toHaveBeenCalled();
      });

      it('is decided before any User lookup or password check, so the correct password is refused too and an unknown email is paused the same way (S-19, S-20)', async () => {
        // Arrange
        const { service, repository, hasher } = createService();
        repository.getSignInAttemptWindow.mockResolvedValue(
          windowOf({ recentCount: 10, latestAttemptAt: new Date(NOW.getTime() - MINUTE) }),
        );

        // Act
        await service
          .signIn({ email: 'nobody@example.test', password: 'Sunny-Day-42' })
          .catch(() => undefined);

        // Assert
        expect(repository.findUserByEmail).not.toHaveBeenCalled();
        expect(hasher.verify).not.toHaveBeenCalled();
      });

      it('treats the 10th failure as an ordinary failure: with 9 recent failures a wrong password is still a 401 (S-10)', async () => {
        // Arrange
        const { service, repository, hasher } = createService();
        repository.getSignInAttemptWindow.mockResolvedValue(
          windowOf({ recentCount: 9, latestAttemptAt: new Date(NOW.getTime() - MINUTE) }),
        );
        repository.findUserByEmail.mockResolvedValue(aUser());
        hasher.verify.mockResolvedValue(false);

        // Act
        const outcome = service.signIn({ email: 'me@example.test', password: 'Not-The-Pass-1' });

        // Assert
        await expect(outcome).rejects.toBeInstanceOf(UnauthorizedException);
        expect(repository.insertSignInAttempt).toHaveBeenCalledWith('me@example.test');
      });

      it('ends exactly 15 minutes after the 10th failure: from then on the correct password signs in (S-12)', async () => {
        // Arrange
        const { service, repository, hasher } = createService();
        repository.getSignInAttemptWindow.mockResolvedValue(
          windowOf({ recentCount: 10, latestAttemptAt: new Date(NOW.getTime() - 15 * MINUTE) }),
        );
        repository.findUserByEmail.mockResolvedValue(aUser());
        hasher.verify.mockResolvedValue(true);

        // Act
        const issued = await service.signIn({ email: 'me@example.test', password: 'Sunny-Day-42' });

        // Assert
        expect(issued.user.email).toBe('me@example.test');
        expect(repository.deleteSignInAttempts).toHaveBeenCalledWith('me@example.test');
      });

      it('is still in force one second before it ends', async () => {
        // Arrange
        const { service, repository } = createService();
        repository.getSignInAttemptWindow.mockResolvedValue(
          windowOf({
            recentCount: 10,
            latestAttemptAt: new Date(NOW.getTime() - 15 * MINUTE + 1000),
          }),
        );

        // Act
        const outcome = service.signIn({ email: 'me@example.test', password: 'Sunny-Day-42' });

        // Assert
        await expect(outcome).rejects.toMatchObject({ status: 429 });
      });
    });

    describe('a burst of parallel guesses', () => {
      it('cannot get past the pause: check, verify and store never interleave for one email, so only 10 guesses are ever verified', async () => {
        // Arrange: a stateful stand-in for the failure table, and a verification that takes time —
        // the gap in which parallel requests used to all see "0 failures so far".
        const { service, repository, hasher } = createService();
        const failures: Date[] = [];
        repository.getSignInAttemptWindow.mockImplementation(async () => {
          await Promise.resolve();
          return windowOf({
            recentCount: failures.length,
            latestAttemptAt: failures.length > 0 ? new Date(NOW.getTime() - MINUTE) : null,
          });
        });
        repository.findUserByEmail.mockResolvedValue(aUser());
        hasher.verify.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return false;
        });
        repository.insertSignInAttempt.mockImplementation(async () => {
          await Promise.resolve();
          failures.push(NOW);
        });

        // Act
        const outcomes = await Promise.allSettled(
          Array.from({ length: 15 }, () =>
            service.signIn({ email: 'burst@example.test', password: 'a-guess' }),
          ),
        );

        // Assert
        const statuses = outcomes.map((outcome) =>
          outcome.status === 'rejected' ? (outcome.reason as HttpException).getStatus() : 200,
        );
        expect(hasher.verify).toHaveBeenCalledTimes(10);
        expect(statuses.filter((status) => status === 401)).toHaveLength(10);
        expect(statuses.filter((status) => status === 429)).toHaveLength(5);
      });

      it("does not make one email's sign-in wait for another email's", async () => {
        // Arrange
        const { service, repository, hasher } = createService();
        const gate = deferred();
        let verifyingAtTheSameTime = 0;
        let mostVerifyingAtTheSameTime = 0;
        repository.findUserByEmail.mockResolvedValue(aUser());
        hasher.verify.mockImplementation(async () => {
          verifyingAtTheSameTime += 1;
          mostVerifyingAtTheSameTime = Math.max(mostVerifyingAtTheSameTime, verifyingAtTheSameTime);
          await gate.promise;
          verifyingAtTheSameTime -= 1;
          return false;
        });

        // Act
        const all = Promise.allSettled([
          service.signIn({ email: 'one@example.test', password: 'a-guess' }),
          service.signIn({ email: 'two@example.test', password: 'a-guess' }),
          service.signIn({ email: 'three@example.test', password: 'a-guess' }),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 5));
        const verifyingBeforeAnyFinishes = mostVerifyingAtTheSameTime;
        gate.resolve();
        await all;

        // Assert
        expect(verifyingBeforeAnyFinishes).toBe(3);
      });
    });
  });

  describe('authenticate', () => {
    it('slides the Session and answers who is signed in', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.slideSession.mockResolvedValue(aSession({ id: 'sid-1', userId: 'user-1' }));

      // Act
      const signedIn = await service.authenticate('sid-1');

      // Assert
      expect(repository.slideSession).toHaveBeenCalledWith('sid-1');
      expect(signedIn).toEqual({ userId: 'user-1' });
    });

    it('answers null for a Session that is unknown or has expired', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.slideSession.mockResolvedValue(null);

      // Act
      const signedIn = await service.authenticate('does-not-exist');

      // Assert
      expect(signedIn).toBeNull();
    });
  });

  describe('signOut', () => {
    it('deletes exactly the Session it was given (S-4)', async () => {
      // Arrange
      const { service, repository } = createService();

      // Act
      await service.signOut('sid-A');

      // Assert
      expect(repository.deleteSession).toHaveBeenCalledTimes(1);
      expect(repository.deleteSession).toHaveBeenCalledWith('sid-A');
    });
  });

  describe('getUser', () => {
    it("shows the User's id and email only", async () => {
      // Arrange
      const { service, repository } = createService();
      repository.findUserById.mockResolvedValue(aUser({ passwordHash: 'secret-hash' }));

      // Act
      const user = await service.getUser('11111111-1111-4111-8111-111111111111');

      // Assert
      expect(user).toEqual({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'me@example.test',
      });
    });

    it('answers 401 "Not signed in." when the User no longer exists', async () => {
      // Arrange
      const { service, repository } = createService();
      repository.findUserById.mockResolvedValue(null);

      // Act
      const outcome = service.getUser('gone');

      // Assert
      await expect(outcome).rejects.toMatchObject({
        response: { statusCode: 401, message: 'Not signed in.', error: 'Unauthorized' },
      });
    });
  });
});
