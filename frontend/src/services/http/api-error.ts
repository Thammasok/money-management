/**
 * Body of every non-2xx answer from `/api/v1`: Nest's default `{ statusCode, message, error }`. `message` is a
 * `string[]` for DTO validation (400, one line per broken rule) and a `string` otherwise; a 429 adds `retryAt`
 * (ISO-8601 UTC).
 */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  retryAt?: string;
}

/** A non-2xx answer from `/api/v1`: the status, every message the backend sent (one per broken rule), and `retryAt` on a 429. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
    readonly retryAt?: string,
  ) {
    super(messages.join(' ') || `Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}
