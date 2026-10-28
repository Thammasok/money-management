import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AuthenticatedRequest } from './authenticated-request';
import { CurrentSessionId, CurrentUser, IS_PUBLIC_KEY, Public } from './identity.decorators';
import type { SignedInUser } from './interfaces/identity-service.interface';

@Controller('probe')
class ProbeController {
  @Public()
  @Get('open')
  open(): { open: boolean } {
    return { open: true };
  }

  @Get('who')
  who(
    @CurrentUser() user: SignedInUser,
    @CurrentSessionId() sessionId: string,
  ): { user: SignedInUser; sessionId: string } {
    return { user, sessionId };
  }
}

describe('Identity decorators', () => {
  describe('@Public()', () => {
    it('marks a route as reachable without signing in, and leaves other routes unmarked', () => {
      // Arrange
      const open = ProbeController.prototype.open;
      const who = ProbeController.prototype.who;

      // Act
      const openIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, open);
      const whoIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, who);

      // Assert
      expect(openIsPublic).toBe(true);
      expect(whoIsPublic).toBeUndefined();
    });
  });

  describe('@CurrentUser() and @CurrentSessionId()', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ProbeController],
      }).compile();
      app = moduleRef.createNestApplication();
      // Stands in for the SessionGuard, which attaches who is signed in to the request.
      app.use((req: unknown, _res: unknown, next: () => void) => {
        (req as AuthenticatedRequest).identity = {
          user: { userId: 'user-1' },
          sessionId: 'session-1',
        };
        next();
      });
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('hand the signed-in User and the id of the current Session to the route', async () => {
      // Arrange
      const server = app.getHttpServer();

      // Act
      const response = await request(server).get('/probe/who').expect(200);

      // Assert
      expect(response.body).toEqual({ user: { userId: 'user-1' }, sessionId: 'session-1' });
    });
  });
});
