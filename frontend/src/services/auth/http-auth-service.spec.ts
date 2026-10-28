import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../http/api-error';
import { HttpAuthService } from './http-auth-service';

// Boundary under test: HttpAuthService (the only code that talks to /api/v1). The one thing mocked is `fetch`.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function serviceAnswering(answer: Response | Error) {
  const fetchFn = vi.fn<typeof fetch>(() =>
    answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
  );
  return { service: new HttpAuthService(fetchFn), fetchFn };
}

const USER = { id: '6c1f0a52-0b64-4d8e-9a53-5b0f6a2a7c11', email: 'me@example.test' };

describe('HttpAuthService.signUp', () => {
  it('posts the email and password as JSON to /api/v1/users and returns the User', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(jsonResponse(201, USER));

    // Act
    const user = await service.signUp('me@example.test', 'Sunny-Day-42');

    // Assert
    expect(user).toEqual(USER);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/users');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'me@example.test',
      password: 'Sunny-Day-42',
    });
  });

  it('rejects with every message of a 400', async () => {
    // Arrange
    const messages = ['Enter a valid email address.', 'Password must be strong.'];
    const { service } = serviceAnswering(
      jsonResponse(400, { statusCode: 400, message: messages, error: 'Bad Request' }),
    );

    // Act
    const failure = service.signUp('not-an-email', 'weak');

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 400, messages }));
    await expect(failure).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects with the message of a 409 (email already registered)', async () => {
    // Arrange
    const { service } = serviceAnswering(
      jsonResponse(409, {
        statusCode: 409,
        message: 'This email is already registered.',
        error: 'Conflict',
      }),
    );

    // Act
    const failure = service.signUp('me@example.test', 'Sunny-Day-42');

    // Assert
    await expect(failure).rejects.toEqual(
      expect.objectContaining({ status: 409, messages: ['This email is already registered.'] }),
    );
  });

  it('lets a transport failure through unchanged', async () => {
    // Arrange
    const offline = new TypeError('Failed to fetch');
    const { service } = serviceAnswering(offline);

    // Act
    const failure = service.signUp('me@example.test', 'Sunny-Day-42');

    // Assert
    await expect(failure).rejects.toBe(offline);
  });
});

describe('HttpAuthService.signIn', () => {
  it('posts the email and password as JSON to /api/v1/sessions and returns the User', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(jsonResponse(200, USER));

    // Act
    const user = await service.signIn('me@example.test', 'Sunny-Day-42');

    // Assert
    expect(user).toEqual(USER);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/sessions');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'me@example.test',
      password: 'Sunny-Day-42',
    });
  });

  it('rejects with the 401 message when the credentials are wrong', async () => {
    // Arrange
    const { service } = serviceAnswering(
      jsonResponse(401, {
        statusCode: 401,
        message: 'Email or password is incorrect.',
        error: 'Unauthorized',
      }),
    );

    // Act
    const failure = service.signIn('me@example.test', 'Not-The-Pass-1');

    // Assert
    await expect(failure).rejects.toEqual(
      expect.objectContaining({ status: 401, messages: ['Email or password is incorrect.'] }),
    );
  });

  it('rejects with status 429 and retryAt when sign-in is paused', async () => {
    // Arrange
    const retryAt = '2026-10-28T09:45:00.000Z';
    const { service } = serviceAnswering(
      jsonResponse(429, {
        statusCode: 429,
        message: 'Too many failed sign-ins. Try again later.',
        error: 'Too Many Requests',
        retryAt,
      }),
    );

    // Act
    const failure = service.signIn('me@example.test', 'Sunny-Day-42');

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 429, retryAt }));
  });
});

describe('HttpAuthService.getCurrentUser', () => {
  it('asks GET /api/v1/me without a body and returns the User', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(jsonResponse(200, USER));

    // Act
    const user = await service.getCurrentUser();

    // Assert
    expect(user).toEqual(USER);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/me');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBeUndefined();
  });

  it('returns null when there is no valid Session (401)', async () => {
    // Arrange
    const { service } = serviceAnswering(
      jsonResponse(401, { statusCode: 401, message: 'Not signed in.', error: 'Unauthorized' }),
    );

    // Act
    const user = await service.getCurrentUser();

    // Assert
    expect(user).toBeNull();
  });

  it('rejects with an ApiError for any other failure, even without a JSON body', async () => {
    // Arrange
    const { service } = serviceAnswering(new Response('<html>Bad gateway</html>', { status: 502 }));

    // Act
    const failure = service.getCurrentUser();

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 502, messages: [] }));
    await expect(failure).rejects.toBeInstanceOf(ApiError);
  });
});

describe('HttpAuthService.signOut', () => {
  it('sends DELETE /api/v1/sessions/current without a body and resolves on 204', async () => {
    // Arrange
    const { service, fetchFn } = serviceAnswering(new Response(null, { status: 204 }));

    // Act
    const result = service.signOut();

    // Assert
    await expect(result).resolves.toBeUndefined();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/sessions/current');
    expect(init?.method).toBe('DELETE');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBeUndefined();
  });

  it('resolves when the Session is already gone (401)', async () => {
    // Arrange
    const { service } = serviceAnswering(
      jsonResponse(401, { statusCode: 401, message: 'Not signed in.', error: 'Unauthorized' }),
    );

    // Act
    const result = service.signOut();

    // Assert
    await expect(result).resolves.toBeUndefined();
  });

  it('rejects with an ApiError when the backend fails', async () => {
    // Arrange
    const { service } = serviceAnswering(
      jsonResponse(500, {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      }),
    );

    // Act
    const failure = service.signOut();

    // Assert
    await expect(failure).rejects.toEqual(expect.objectContaining({ status: 500 }));
  });
});
