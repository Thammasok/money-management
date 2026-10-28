/**
 * Text as the API stores it: NUL characters dropped (Postgres cannot store them — an unhandled one would be a 500),
 * then trimmed. Anything that is not a string passes through unchanged, for the validators to reject.
 */
export function cleanText(value: unknown): unknown {
  return typeof value === 'string' ? value.replaceAll('\u0000', '').trim() : value;
}

/** Like `cleanText`, and a blank text means "no text" (null) — a Transaction with a blank note has no note. */
export function textOrNull(value: unknown): unknown {
  const text = cleanText(value);
  return text === '' ? null : text;
}
