/** Emails are compared, stored and counted trimmed and lower-cased. Non-strings pass through for the validators to reject. */
export function normaliseEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
