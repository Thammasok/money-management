import { SignInDto } from '../dto/sign-in.dto';
import { SignUpDto } from '../dto/sign-up.dto';
import { UserResponseDto } from '../dto/user-response.dto';

/** A Session was opened for this User: the controller puts `sessionId` in the cookie and shows `user`. */
export interface IssuedSession {
  sessionId: string;
  user: UserResponseDto;
}

/**
 * "Who is the signed-in User" — the only thing Identity exposes to other modules (through the global guard,
 * read with the `@CurrentUser()` decorator). F-10 adds `homeCurrency`.
 */
export interface SignedInUser {
  userId: string;
}

/**
 * Business Logic for sign up, sign in, sign out and "who is signed in". Errors are Nest HttpExceptions in the
 * default `{ statusCode, message, error }` body: 409 email taken, 401 wrong credentials / not signed in,
 * 429 sign-in paused (body also carries `retryAt`).
 */
export interface IIdentityService {
  /** Creates the User (email already normalised by the DTO) and opens their first Session. */
  signUp(input: SignUpDto): Promise<IssuedSession>;
  /** Applies the sign-in pause, verifies the credentials, opens a Session. */
  signIn(input: SignInDto): Promise<IssuedSession>;
  /** Ends exactly this Session; the User's other Sessions stay. */
  signOut(sessionId: string): Promise<void>;
  /** The User behind a valid Session. */
  getUser(userId: string): Promise<UserResponseDto>;
  /** Slides a valid Session's expiry. Null when the Session is unknown or expired. */
  authenticate(sessionId: string): Promise<SignedInUser | null>;
}
