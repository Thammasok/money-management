import { ApiError } from './api-error';
import type { ApiErrorBody, IAuthService, User } from './auth.types';

const API_BASE_URL = '/api/v1';

/**
 * Identity over HTTP: `/api/v1` on the page's own origin (the Vite proxy in development), so the httpOnly `sid`
 * cookie travels with every call and is never touched by JavaScript.
 *
 * `fetchFn` is injected (see `createServices`). Every request that has a body is sent as `application/json` — the
 * backend answers 415 to anything else.
 */
export class HttpAuthService implements IAuthService {
  constructor(
    private readonly fetchFn: typeof fetch,
    private readonly baseUrl: string = API_BASE_URL,
  ) {}

  async getCurrentUser(): Promise<User | null> {
    const response = await this.send('GET', '/me');
    if (response.ok) return toUser(await response.json());
    if (response.status === 401) return null;
    throw await toApiError(response);
  }

  signUp(email: string, password: string): Promise<User> {
    return this.sendForUser('/users', { email, password });
  }

  signIn(email: string, password: string): Promise<User> {
    return this.sendForUser('/sessions', { email, password });
  }

  async signOut(): Promise<void> {
    const response = await this.send('DELETE', '/sessions/current');
    // 401 means there was no Session left to end — the person is signed out either way.
    if (response.ok || response.status === 401) return;
    throw await toApiError(response);
  }

  private async sendForUser(
    path: string,
    body: { email: string; password: string },
  ): Promise<User> {
    const response = await this.send('POST', path, body);
    if (!response.ok) throw await toApiError(response);
    return toUser(await response.json());
  }

  private send(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}

function toUser(json: unknown): User {
  const { id, email } = json as User;
  return { id, email };
}

async function toApiError(response: Response): Promise<ApiError> {
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
