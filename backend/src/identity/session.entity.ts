/**
 * A signed-in User's server-side Session (epic: Shared Domain Entities → Session, Identity-internal).
 * Its `id` is the value of the `sid` cookie.
 */
export interface Session {
  /** Random token (32 random bytes, base64url) — not a UUID. */
  id: string;
  userId: string;
  /** 30-day sliding expiry, computed by Postgres. */
  expiresAt: Date;
  createdAt: Date;
}

/** What Identity needs to open a Session; `expiresAt` and `createdAt` come from Postgres. */
export interface NewSession {
  id: string;
  userId: string;
}
