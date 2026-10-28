import { NewSession, Session } from '../session.entity';
import { NewUser, User } from '../user.entity';

/**
 * What the sign-in pause needs to know about one email's failed sign-ins. All times come from
 * Postgres, so the decision never depends on the application server's clock.
 */
export interface SignInAttemptWindow {
  /** Time of the most recent failed sign-in, or null when the email has none. */
  latestAttemptAt: Date | null;
  /** Failed sign-ins in the 15 minutes up to (and including) the most recent one. */
  recentCount: number;
  /** Postgres `now()` at the moment of the query. */
  now: Date;
}

/** Data Access for Users, Sessions and Sign-in Attempts — the only code that reads these tables. */
export interface IIdentityRepository {
  /** Stores the User, or returns null when a User with that email already exists (no check-then-insert race). */
  insertUser(newUser: NewUser): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;

  /** Opens a Session that expires 30 days from now (Postgres time). */
  insertSession(newSession: NewSession): Promise<Session>;
  /**
   * Moves a still-valid Session's expiry to 30 days from now and returns it.
   * Returns null when the id is unknown or the Session has expired.
   */
  slideSession(id: string): Promise<Session | null>;
  /** Deletes the one Session. Idempotent. */
  deleteSession(id: string): Promise<void>;

  getSignInAttemptWindow(email: string): Promise<SignInAttemptWindow>;
  /** Stores one failed sign-in for the email (time = Postgres `now()`). */
  insertSignInAttempt(email: string): Promise<void>;
  /** Deletes every failed sign-in stored for the email. */
  deleteSignInAttempts(email: string): Promise<void>;
}
