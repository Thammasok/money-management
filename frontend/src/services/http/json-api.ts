import { ApiError, type ApiErrorBody } from './api-error';

/**
 * One request to `/api/v1`, which is on the page's own origin (the Vite proxy in development), so the httpOnly `sid`
 * cookie travels with every call and is never touched by JavaScript. A request that has a body is sent as
 * `application/json` — the backend answers 415 to anything else. `fetchFn` is injected (see `createServices`).
 */
export function sendJson(
  fetchFn: typeof fetch,
  url: string,
  method: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetchFn(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The `ApiError` for a non-2xx answer: its status and every message the backend sent, whichever shape they came in. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body = await readErrorBody(response);
  const message = body.message;
  const messages = Array.isArray(message) ? message : typeof message === 'string' ? [message] : [];
  return new ApiError(
    response.status,
    messages,
    typeof body.retryAt === 'string' ? body.retryAt : undefined,
  );
}

/** The error body when there is a JSON one; an empty object for an HTML error page from a proxy or an empty body. */
async function readErrorBody(response: Response): Promise<Partial<ApiErrorBody>> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === 'object' && parsed !== null ? (parsed as Partial<ApiErrorBody>) : {};
  } catch {
    return {};
  }
}
