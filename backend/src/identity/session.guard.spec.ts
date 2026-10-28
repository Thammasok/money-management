import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createIdentityServiceMock } from '../../test/support/mocks';
import type { AuthenticatedRequest } from './authenticated-request';
import { Public } from './identity.decorators';
import { SessionCookie } from './session-cookie';
import { SessionGuard } from './session.guard';

class ProbeRoutes {
  @Public()
  open(): void {}

  secured(): void {}
}

@Public()
class PublicController {
  anything(): void {}
}

function createGuard() {
  const identity = createIdentityServiceMock();
  const sessionCookie = {
    set: jest.fn(),
    clear: jest.fn(),
  } as unknown as jest.Mocked<SessionCookie>;
  const guard = new SessionGuard(new Reflector(), identity, sessionCookie);
  return { guard, identity, sessionCookie };
}

function contextFor(
  handler: () => void,
  cookies: unknown,
  controller: new () => unknown = ProbeRoutes,
) {
  const request = { cookies } as unknown as AuthenticatedRequest;
  const response = {};
  const context = {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, request, response };
}

describe('SessionGuard', () => {
  describe('routes marked @Public()', () => {
    it('lets the request through without looking at any Session', async () => {
      // Arrange
      const { guard, identity } = createGuard();
      const { context } = contextFor(ProbeRoutes.prototype.open, { sid: 'whatever' });

      // Act
      const allowed = await guard.canActivate(context);

      // Assert
      expect(allowed).toBe(true);
      expect(identity.authenticate).not.toHaveBeenCalled();
    });

    it('honours @Public() on the whole controller', async () => {
      // Arrange
      const { guard, identity } = createGuard();
      const { context } = contextFor(PublicController.prototype.anything, {}, PublicController);

      // Act
      const allowed = await guard.canActivate(context);

      // Assert
      expect(allowed).toBe(true);
      expect(identity.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('every other route', () => {
    it('lets a valid Session through, attaches who is signed in, and re-sends the cookie so the 30 days slide', async () => {
      // Arrange
      const { guard, identity, sessionCookie } = createGuard();
      identity.authenticate.mockResolvedValue({ userId: 'user-1' });
      const { context, request, response } = contextFor(ProbeRoutes.prototype.secured, {
        sid: 'session-1',
      });

      // Act
      const allowed = await guard.canActivate(context);

      // Assert
      expect(allowed).toBe(true);
      expect(identity.authenticate).toHaveBeenCalledWith('session-1');
      expect(request.identity).toEqual({ user: { userId: 'user-1' }, sessionId: 'session-1' });
      expect(sessionCookie.set).toHaveBeenCalledWith(response, 'session-1');
    });

    it('answers 401 "Not signed in." without a session cookie, and never asks Identity (S-22)', async () => {
      // Arrange
      const { guard, identity } = createGuard();
      const { context } = contextFor(ProbeRoutes.prototype.secured, {});

      // Act
      const outcome = guard.canActivate(context);

      // Assert
      await expect(outcome).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(outcome).rejects.toMatchObject({
        response: { statusCode: 401, message: 'Not signed in.', error: 'Unauthorized' },
      });
      expect(identity.authenticate).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty value', { sid: '' }],
      ['a non-string value (e.g. a crafted JSON cookie)', { sid: { $ne: null } }],
      ['no cookie jar at all (cookie-parser missing)', undefined],
    ])('answers 401 for %s', async (_why, cookies) => {
      // Arrange
      const { guard, identity } = createGuard();
      const { context } = contextFor(ProbeRoutes.prototype.secured, cookies);

      // Act
      const outcome = guard.canActivate(context);

      // Assert
      await expect(outcome).rejects.toBeInstanceOf(UnauthorizedException);
      expect(identity.authenticate).not.toHaveBeenCalled();
    });

    it('answers 401 for a cookie that matches no live Session, and sends no cookie back (S-22, S-23)', async () => {
      // Arrange
      const { guard, identity, sessionCookie } = createGuard();
      identity.authenticate.mockResolvedValue(null);
      const { context, request } = contextFor(ProbeRoutes.prototype.secured, {
        sid: 'does-not-exist',
      });

      // Act
      const outcome = guard.canActivate(context);

      // Assert
      await expect(outcome).rejects.toMatchObject({
        response: { statusCode: 401, message: 'Not signed in.', error: 'Unauthorized' },
      });
      expect(request.identity).toBeUndefined();
      expect(sessionCookie.set).not.toHaveBeenCalled();
    });
  });
});
