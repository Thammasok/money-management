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
