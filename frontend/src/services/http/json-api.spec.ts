import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { sendJson, toApiError } from './json-api';

// Boundary under test: the two things every service shares when it talks to /api/v1 — how a request is sent and how a
// failure is read. The one thing mocked is `fetch`.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

describe('sendJson', () => {
  it('sends a body as JSON, with the Content-Type the backend insists on, to the page’s own origin', async () => {
    // Arrange
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(201, {}));

    // Act
    await sendJson(fetchFn, '/api/v1/wallets', 'POST', { name: 'Cash' });

    // Assert
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('/api/v1/wallets');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Cash' });
  });

  it('sends no body and no Content-Type when there is nothing to send', async () => {
    // Arrange
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, {}));

    // Act
    await sendJson(fetchFn, '/api/v1/me', 'GET');

    // Assert
    const [, init] = fetchFn.mock.calls[0]!;
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('hands back the response it was given', async () => {
    // Arrange
    const response = jsonResponse(200, { ok: true });
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(response);

    // Act
    const answer = await sendJson(fetchFn, '/api/v1/me', 'GET');

    // Assert
    expect(answer).toBe(response);
  });
});

describe('toApiError', () => {
  it('collects every message of a 400, one per broken rule', async () => {
    // Arrange
    const messages = ['Enter a wallet name.', 'Choose a supported currency.'];
    const response = jsonResponse(400, {
      statusCode: 400,
      message: messages,
      error: 'Bad Request',
    });

    // Act
    const error = await toApiError(response);

    // Assert
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.messages).toEqual(messages);
  });

  it('wraps the single message of any other answer', async () => {
    // Arrange
    const response = jsonResponse(404, {
      statusCode: 404,
      message: 'Wallet not found.',
      error: 'Not Found',
    });

    // Act
    const error = await toApiError(response);

    // Assert
    expect(error.status).toBe(404);
    expect(error.messages).toEqual(['Wallet not found.']);
  });

  it('keeps when to try again from a 429', async () => {
    // Arrange
    const retryAt = '2026-10-28T09:45:00.000Z';
    const response = jsonResponse(429, {
      statusCode: 429,
      message: 'Slow down.',
      error: 'Too Many Requests',
      retryAt,
    });

    // Act
    const error = await toApiError(response);

    // Assert
    expect(error.retryAt).toBe(retryAt);
  });

  it('has no messages when the answer is not JSON (a proxy’s error page)', async () => {
    // Arrange
    const response = new Response('<html>Bad gateway</html>', { status: 502 });

    // Act
    const error = await toApiError(response);

    // Assert
    expect(error.status).toBe(502);
    expect(error.messages).toEqual([]);
  });
});
