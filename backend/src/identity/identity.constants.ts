/** Name of the httpOnly cookie that carries the Session id. */
export const SESSION_COOKIE_NAME = 'sid';

/** A Session expires this many days after its last use (sliding). */
export const SESSION_LIFETIME_DAYS = 30;

/** The Nth failed sign-in within the window pauses that email. */
export const SIGN_IN_FAILURES_BEFORE_PAUSE = 10;

/** Failures are counted over this many minutes, and the pause lasts this long, counted from the latest failure. */
export const SIGN_IN_PAUSE_MINUTES = 15;
