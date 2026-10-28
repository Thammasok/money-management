import { Pool, types } from 'pg';
import type { CustomTypesConfig } from 'pg';

/**
 * How the shared Pool reads Postgres values: `pg`'s defaults, except `DATE`, which stays the exact `YYYY-MM-DD`
 * string. The default builds a JS Date at *local* midnight, which a JSON response then serialises as UTC — one day
 * early east of Greenwich (AD-1). Nothing in this app turns a DATE into a Date: a Transaction's `occurredOn` is a
 * calendar date, not an instant.
 *
 * `INT8` (BIGINT) and `NUMERIC` are already strings by default and must stay so: money is a `bigint` made from the
 * string, never a JS number.
 */
export const postgresTypes: CustomTypesConfig = {
  getTypeParser: (oid, format) =>
    oid === types.builtins.DATE ? (value: string) => value : types.getTypeParser(oid, format),
};

/** The one way this app creates a Pool, so production and the integration tests read Postgres identically. */
export function createPool(connectionString: string, options: { max?: number } = {}): Pool {
  return new Pool({ connectionString, types: postgresTypes, ...options });
}
