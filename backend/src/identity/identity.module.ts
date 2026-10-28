import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { IdentityController } from './identity.controller';
import { IdentityRepository } from './identity.repository';
import { IdentityService } from './identity.service';
import {
  IDENTITY_REPOSITORY,
  IDENTITY_SERVICE,
  PASSWORD_HASHER,
  SIGN_IN_LOCK,
} from './identity.tokens';
import { KeyedMutex } from './keyed-mutex';
import { SessionCookie } from './session-cookie';
import { SessionGuard } from './session.guard';

/**
 * Owns Users, Sessions and Sign-in Attempts. Exposes to other modules only the global SessionGuard (every route
 * needs a signed-in User unless marked @Public()) and the `@CurrentUser()` / `@Public()` decorators.
 */
@Module({
  controllers: [IdentityController],
  providers: [
    { provide: IDENTITY_SERVICE, useClass: IdentityService },
    { provide: IDENTITY_REPOSITORY, useClass: IdentityRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: SIGN_IN_LOCK, useClass: KeyedMutex },
    SessionCookie,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class IdentityModule {}
