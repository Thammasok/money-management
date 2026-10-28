import type { User } from '../services/auth/auth.types';

/**
 * Whether anyone is signed in, decided only by `GET /api/v1/me` (the session cookie is httpOnly — the Web App never
 * reads it). The provider renders no route content until the first answer, so a screen only ever sees one of these.
 */
export type Session = { status: 'signed-out' } | { status: 'signed-in'; user: User };

/** What a screen can do with the Session: read it, and report that a sign-up / sign-in / sign-out succeeded. */
export interface SessionContextValue {
  session: Session;
  signedIn(user: User): void;
  signedOut(): void;
}
