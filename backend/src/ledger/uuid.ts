const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether `value` is written as a canonical UUID (8-4-4-4-12 hexadecimal, either case). Stricter than Postgres, which
 * also accepts braces and missing hyphens: anything else is answered "not found" without a query, so Postgres is never
 * asked to parse a path segment and a malformed id can never become a 500.
 */
export function isUuid(value: string): boolean {
  return UUID_SHAPE.test(value);
}
