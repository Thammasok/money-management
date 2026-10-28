import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest } from './authenticated-request';
import type { SignedInUser } from './interfaces/identity-service.interface';

export const IS_PUBLIC_KEY = 'identity:isPublic';

/** Marks a route (or a whole controller) as reachable without signing in. Every other route needs a valid Session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** The signed-in User, as established by the global SessionGuard. The only Identity type other modules need. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SignedInUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().identity.user,
);

/** Identity-internal: the id of the Session making this request (what sign-out ends). */
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().identity.sessionId,
);
