// Fast preconditions through the real /api/v1 (via the same Vite proxy the UI uses).
// Pass `page.request`: it shares the browser context's cookie jar, so a sign-up here leaves the page
// signed in exactly as the UI would. Later features reuse signUpViaApi for "a signed-in User" setup;
// their journey specs must still drive F-1's real UI flow (e2e/F-1/pages) — no shortcut there.
import { expect, type APIRequestContext } from '@playwright/test';
import { FAILURES_TO_PAUSE, Passwords } from './test-data';

export interface SignedUpUser {
  id: string;
  email: string;
  password: string;
}

export async function signUpViaApi(
  request: APIRequestContext,
  email: string,
  password: string = Passwords.valid,
): Promise<SignedUpUser> {
  const response = await request.post('/api/v1/users', { data: { email, password } });
  expect(response.status(), `sign-up of ${email}`).toBe(201);
  const body = (await response.json()) as { id: string; email: string };
  return { id: body.id, email: body.email, password };
}

export async function signOutViaApi(request: APIRequestContext): Promise<void> {
  const response = await request.delete('/api/v1/sessions/current');
  expect(response.status(), 'sign-out').toBe(204);
}

/** Makes `times` failed sign-ins for `email`, asserting each is an ordinary 401. */
export async function failSignInsViaApi(
  request: APIRequestContext,
  email: string,
  times: number = FAILURES_TO_PAUSE,
): Promise<void> {
  for (let i = 1; i <= times; i++) {
    const response = await request.post('/api/v1/sessions', {
      data: { email, password: Passwords.wrong },
    });
    expect(response.status(), `failed sign-in #${i} for ${email}`).toBe(401);
  }
}
