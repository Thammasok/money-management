import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { AuthenticatedRequest } from './authenticated-request';
import { SESSION_COOKIE_NAME } from './identity.constants';
import { IS_PUBLIC_KEY } from './identity.decorators';
import { IdentityMessage } from './identity.messages';
import { IDENTITY_SERVICE } from './identity.tokens';
import type { IIdentityService } from './interfaces/identity-service.interface';
import { SessionCookie } from './session-cookie';

/**
 * Registered globally by IdentityModule: every route needs a valid Session unless it is marked @Public().
 * A valid Session is slid to 30 days from now and its cookie re-sent; the signed-in User is attached to the request.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDENTITY_SERVICE) private readonly identity: IIdentityService,
    private readonly sessionCookie: SessionCookie,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const sessionId = readSessionId(request);
    const user = sessionId === null ? null : await this.identity.authenticate(sessionId);
    if (sessionId === null || user === null) {
      throw new UnauthorizedException(IdentityMessage.notSignedIn);
    }

    request.identity = { user, sessionId };
    this.sessionCookie.set(http.getResponse<Response>(), sessionId);
    return true;
  }
}

/** The cookie value, only if it is a non-empty string (a crafted cookie can parse to an object). */
function readSessionId(request: AuthenticatedRequest): string | null {
  const value: unknown = request.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
