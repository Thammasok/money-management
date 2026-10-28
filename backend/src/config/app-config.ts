/** Settings the app reads from the environment once, at start-up. */
export interface AppConfig {
  /** Port the API listens on. */
  port: number;
  /** Postgres connection string. */
  databaseUrl: string;
  /** Whether the Session cookie carries `Secure` (https only). Off for local http development. */
  cookieSecure: boolean;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const DEFAULT_PORT = 3000;

/**
 * Reads and validates the environment: DATABASE_URL (required), PORT (default 3000), COOKIE_SECURE
 * ("true" | "false"; default: on when NODE_ENV is production). Throws with a message naming the variable.
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: parsePort(env.PORT),
    databaseUrl: requireDatabaseUrl(env.DATABASE_URL),
    cookieSecure: parseCookieSecure(env),
  };
}

function requireDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error(
      'DATABASE_URL is required, e.g. postgresql://user:password@localhost:5432/database',
    );
  }
  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a whole number between 1 and 65535');
  }
  return port;
}

function parseCookieSecure(env: NodeJS.ProcessEnv): boolean {
  const value = env.COOKIE_SECURE;
  if (value === undefined || value === '') {
    return env.NODE_ENV === 'production';
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error('COOKIE_SECURE must be "true" or "false"');
}
