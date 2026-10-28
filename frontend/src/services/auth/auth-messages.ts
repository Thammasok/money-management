import { ApiError } from '../http/api-error';
import { GENERIC_FAILURE_TEXT } from '../http/failure-messages';

// Everything the person reads about signing up and in. The Web App holds no auth rules: for a 400, 401 and 409 it
// shows the backend's own sentence (artifacts/F-1/02-flow.md → Error message catalogue); only what the backend
// cannot know is written here — the always-visible password rule, the local time of a pause, and the fallback.

/** Shown under the password field on Sign Up at all times (same sentence the backend answers a 400 with). */
export const PASSWORD_RULE_TEXT =
  'Password must be at least 8 characters and include a letter, a number, and a symbol.';

const PAUSED_PREFIX = 'Too many failed sign-ins. Try again at';

/** Statuses whose backend message is written for the person to read. */
const SHOWN_AS_SENT = new Set([400, 401, 409, 429]);

export type TimeFormatter = (date: Date) => string;

const localTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** Hours and minutes in the browser's own time zone and locale. */
const formatLocalTime: TimeFormatter = (date) => localTime.format(date);

/** One line per message to show on Sign Up after a failed attempt. */
export function describeSignUpFailure(error: unknown): string[] {
  return messagesToShow(error) ?? [GENERIC_FAILURE_TEXT];
}

/** The one sentence to show on Sign In after a failed attempt. */
export function describeSignInFailure(
  error: unknown,
  formatTime: TimeFormatter = formatLocalTime,
): string {
  if (error instanceof ApiError && error.status === 429) {
    const retryAt = parseDate(error.retryAt);
    if (retryAt) return `${PAUSED_PREFIX} ${formatTime(retryAt)}.`;
  }
  return (messagesToShow(error) ?? [GENERIC_FAILURE_TEXT]).join(' ');
}

function messagesToShow(error: unknown): string[] | null {
  if (error instanceof ApiError && SHOWN_AS_SENT.has(error.status) && error.messages.length > 0) {
    return error.messages;
  }
  return null;
}

function parseDate(iso: string | undefined): Date | null {
  if (iso === undefined) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
