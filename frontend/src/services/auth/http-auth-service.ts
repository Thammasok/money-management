import { sendJson, toApiError } from '../http/json-api';
import type { IAuthService, User } from './auth.types';

const API_BASE_URL = '/api/v1';

/**
 * Identity over HTTP: `/api/v1` on the page's own origin, with the httpOnly `sid` cookie and JSON bodies (`sendJson`).
 * `fetchFn` is injected (see `createServices`).
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
    return sendJson(this.fetchFn, `${this.baseUrl}${path}`, method, body);
  }
}

function toUser(json: unknown): User {
  const { id, email } = json as User;
  return { id, email };
}
