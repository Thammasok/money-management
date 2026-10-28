import type { Request } from 'express';
import type { SignedInUser } from './interfaces/identity-service.interface';

/** A request that passed the SessionGuard: it carries who is signed in and which Session they used. */
export interface AuthenticatedRequest extends Request {
  identity: { user: SignedInUser; sessionId: string };
}
