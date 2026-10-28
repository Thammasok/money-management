/** The shared `pg.Pool`, provided once by the global DatabaseModule. Repositories inject it; nothing else touches SQL. */
export const PG_POOL = Symbol('PG_POOL');
