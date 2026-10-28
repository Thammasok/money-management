// The Web App's contract with Identity (artifacts/F-1/02-flow.md → API Endpoint Map and Error message catalogue).
// Shapes mirror the backend exactly (backend/src/identity/dto/*): JSON in camelCase, errors in Nest's default body.

/** The signed-in User as `POST /users`, `POST /sessions` and `GET /me` return them. */
export interface User {
  id: string;
  email: string;
}

/**
 * Everything the screens need from Identity. The only implementation that talks to the network is
 * `HttpAuthService`; tests inject a mock. The Web App holds no auth rules — it shows what the backend says.
 *
 * Rejections: a non-2xx answer rejects with `ApiError`; a transport failure (offline, backend down) rejects with
 * whatever `fetch` rejected with. Callers treat anything that is not an `ApiError` as "something went wrong".
 */
export interface IAuthService {
  /** The signed-in User, or `null` when there is no valid Session (`GET /me` answered 401). */
  getCurrentUser(): Promise<User | null>;
  /** Creates a User and signs them in (`POST /users`). Rejects with `ApiError` 400 (rule broken) or 409 (taken). */
  signUp(email: string, password: string): Promise<User>;
  /** Signs in (`POST /sessions`). Rejects with `ApiError` 400, 401 (wrong credentials) or 429 (paused, `retryAt`). */
  signIn(email: string, password: string): Promise<User>;
  /** Ends the current Session (`DELETE /sessions/current`); also resolves when there was none (already signed out). */
  signOut(): Promise<void>;
}
