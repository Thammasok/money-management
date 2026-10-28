import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServices } from './create-services';

// Boundary under test: createServices — the production wiring. The browser's `fetch` is the only thing replaced.

describe('createServices', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wires an auth service that talks to /api/v1 through the global fetch', async () => {
    // Arrange
    const globalFetch = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ message: 'Not signed in.' }), { status: 401 })),
    );
    vi.stubGlobal('fetch', globalFetch);

    // Act
    const user = await createServices().authService.getCurrentUser();

    // Assert
    expect(user).toBeNull();
    expect(globalFetch).toHaveBeenCalledWith(
      '/api/v1/me',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
