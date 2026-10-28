import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { SignInDto } from './dto/sign-in.dto';
import type { SignUpDto } from './dto/sign-up.dto';
import type { UserResponseDto } from './dto/user-response.dto';
import { SIGN_IN_FAILURES_BEFORE_PAUSE, SIGN_IN_PAUSE_MINUTES } from './identity.constants';
import { IdentityMessage } from './identity.messages';
import { IDENTITY_REPOSITORY, PASSWORD_HASHER, SIGN_IN_LOCK } from './identity.tokens';
import type {
  IIdentityRepository,
  SignInAttemptWindow,
} from './interfaces/identity-repository.interface';
import type {
  IIdentityService,
  IssuedSession,
  SignedInUser,
} from './interfaces/identity-service.interface';
import type { IPasswordHasher } from './interfaces/password-hasher.interface';
import type { KeyedMutex } from './keyed-mutex';
import type { User } from './user.entity';

const MINUTE_MS = 60 * 1000;

@Injectable()
export class IdentityService implements IIdentityService {
  /** A hash nobody knows the password of, made once, so an unknown email costs as much to check as a known one. */
  private dummyPasswordHash?: Promise<string>;

  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IIdentityRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    @Inject(SIGN_IN_LOCK) private readonly signInLock: KeyedMutex,
  ) {}

  async signUp(input: SignUpDto): Promise<IssuedSession> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.repository.insertUser({ email: input.email, passwordHash });
    if (user === null) {
      throw new ConflictException(IdentityMessage.emailTaken);
    }
    return this.openSession(user);
  }

  signIn(input: SignInDto): Promise<IssuedSession> {
    // Check, verify and store must not interleave for one email: otherwise a burst of parallel guesses all pass
    // the 10-failure check before the first failure is stored. Other emails are not held up.
    return this.signInLock.run(input.email, () => this.attemptSignIn(input));
  }

  /** One sign-in attempt, start to finish: pause check, credential check, then store the failure or open a Session. */
  private async attemptSignIn(input: SignInDto): Promise<IssuedSession> {
    const window = await this.repository.getSignInAttemptWindow(input.email);
    const pausedUntil = pauseEndsAt(window);
    if (pausedUntil !== null) {
      // Refused before any lookup or check, and nothing is stored: the pause is fixed, not extended by retries.
      throw signInPaused(pausedUntil);
    }

    const user = await this.repository.findUserByEmail(input.email);
    const passwordMatches = await this.verifyPassword(user, input.password);
    if (user === null || !passwordMatches) {
      await this.repository.insertSignInAttempt(input.email);
      throw new UnauthorizedException(IdentityMessage.badCredentials);
    }

    await this.repository.deleteSignInAttempts(input.email);
    return this.openSession(user);
  }

  async signOut(sessionId: string): Promise<void> {
    await this.repository.deleteSession(sessionId);
  }

  async getUser(userId: string): Promise<UserResponseDto> {
    const user = await this.repository.findUserById(userId);
    if (user === null) {
      throw new UnauthorizedException(IdentityMessage.notSignedIn);
    }
    return toUserResponse(user);
  }

  async authenticate(sessionId: string): Promise<SignedInUser | null> {
    const session = await this.repository.slideSession(sessionId);
    return session === null ? null : { userId: session.userId };
  }

  private async openSession(user: User): Promise<IssuedSession> {
    const session = await this.repository.insertSession({
      id: randomBytes(32).toString('base64url'),
      userId: user.id,
    });
    return { sessionId: session.id, user: toUserResponse(user) };
  }

  /** Always runs one real password check, so response time does not reveal whether the email has a User. */
  private async verifyPassword(user: User | null, password: string): Promise<boolean> {
    if (user !== null) {
      return this.hasher.verify(user.passwordHash, password);
    }
    this.dummyPasswordHash ??= this.hasher.hash(randomBytes(16).toString('hex'));
    await this.hasher.verify(await this.dummyPasswordHash, password);
    return false;
  }
}

function toUserResponse(user: User): UserResponseDto {
  return { id: user.id, email: user.email };
}

/** When the pause ends, or null when the email is not paused: 10 recent failures and the latest under 15 minutes ago. */
function pauseEndsAt({ latestAttemptAt, recentCount, now }: SignInAttemptWindow): Date | null {
  if (latestAttemptAt === null || recentCount < SIGN_IN_FAILURES_BEFORE_PAUSE) {
    return null;
  }
  const endsAt = new Date(latestAttemptAt.getTime() + SIGN_IN_PAUSE_MINUTES * MINUTE_MS);
  return endsAt.getTime() > now.getTime() ? endsAt : null;
}

function signInPaused(retryAt: Date): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: IdentityMessage.signInPaused,
      error: 'Too Many Requests',
      retryAt: retryAt.toISOString(),
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
