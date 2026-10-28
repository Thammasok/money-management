import { HttpException, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createIdentityServiceMock } from '../../test/support/mocks';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { createValidationPipe } from '../validation-pipe';
import type { AuthenticatedRequest } from './authenticated-request';
import { IdentityController } from './identity.controller';
import { IDENTITY_SERVICE } from './identity.tokens';
import { SessionCookie } from './session-cookie';

// Controller under test: the real transport (routing, pipes, status codes, cookies), the business logic mocked.
describe('IdentityController', () => {
  let app: INestApplication;
  let identity: ReturnType<typeof createIdentityServiceMock>;

  beforeEach(async () => {
    identity = createIdentityServiceMock();
    const config: AppConfig = { port: 0, databaseUrl: 'unused', cookieSecure: false };
    const moduleRef = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [
        SessionCookie,
        { provide: IDENTITY_SERVICE, useValue: identity },
        { provide: APP_CONFIG, useValue: config },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    // Stands in for the SessionGuard, which attaches who is signed in to the request on protected routes.
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

  const setCookies = (response: request.Response): string[] =>
    (response.headers['set-cookie'] ?? []) as unknown as string[];

  describe('POST /api/v1/users', () => {
    it('signs up and answers 201 with the new User and a Session cookie (S-1)', async () => {
      // Arrange
      identity.signUp.mockResolvedValue({
        sessionId: 'session-new',
        user: { id: 'user-new', email: 'new@example.test' },
      });

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: '  New@Example.test ', password: 'Sunny-Day-42' });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 'user-new', email: 'new@example.test' });
      expect(identity.signUp).toHaveBeenCalledWith({
        email: 'new@example.test',
        password: 'Sunny-Day-42',
      });
      expect(setCookies(response)[0]).toContain('sid=session-new');
      expect(setCookies(response)[0]).toContain('HttpOnly');
    });

    it('answers 400 with every message and never reaches the business logic when the body breaks the rules (S-15, S-16)', async () => {
      // Arrange
      const body = { email: 'not-an-email', password: 'weak' };

      // Act
      const response = await request(app.getHttpServer()).post('/api/v1/users').send(body);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        statusCode: 400,
        message: expect.arrayContaining([
          'Enter a valid email address.',
          'Password must be at least 8 characters and include a letter, a number, and a symbol.',
        ]),
        error: 'Bad Request',
      });
      expect(identity.signUp).not.toHaveBeenCalled();
    });

    it('answers what the business logic throws, and sets no cookie, when the email is taken (S-14)', async () => {
      // Arrange
      identity.signUp.mockRejectedValue(
        new HttpException(
          { statusCode: 409, message: 'This email is already registered.', error: 'Conflict' },
          409,
        ),
      );

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ email: 'taken@example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        statusCode: 409,
        message: 'This email is already registered.',
        error: 'Conflict',
      });
      expect(setCookies(response)).toEqual([]);
    });
  });

  describe('POST /api/v1/sessions', () => {
    it('signs in and answers 200 (not 201) with the User and a Session cookie (S-2)', async () => {
      // Arrange
      identity.signIn.mockResolvedValue({
        sessionId: 'session-b',
        user: { id: 'user-1', email: 'me@example.test' },
      });

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/sessions')
        .send({ email: 'ME@Example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 'user-1', email: 'me@example.test' });
      expect(identity.signIn).toHaveBeenCalledWith({
        email: 'me@example.test',
        password: 'Sunny-Day-42',
      });
      expect(setCookies(response)[0]).toContain('sid=session-b');
    });

    it('answers 400 with the sign-in messages for empty fields, without counting a failed attempt (S-17)', async () => {
      // Arrange
      const body = { email: '', password: '' };

      // Act
      const response = await request(app.getHttpServer()).post('/api/v1/sessions').send(body);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(
        expect.arrayContaining(['Enter your email.', 'Enter your password.']),
      );
      expect(identity.signIn).not.toHaveBeenCalled();
    });

    it('answers 401 when the credentials are wrong, with no cookie', async () => {
      // Arrange
      identity.signIn.mockRejectedValue(
        new UnauthorizedException('Email or password is incorrect.'),
      );

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/sessions')
        .send({ email: 'me@example.test', password: 'Not-The-Pass-1' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Email or password is incorrect.',
        error: 'Unauthorized',
      });
      expect(setCookies(response)).toEqual([]);
    });

    it('answers 429 with retryAt when sign-in is paused (S-19)', async () => {
      // Arrange
      identity.signIn.mockRejectedValue(
        new HttpException(
          {
            statusCode: 429,
            message: 'Too many failed sign-ins. Try again later.',
            error: 'Too Many Requests',
            retryAt: '2026-10-28T12:15:00.000Z',
          },
          429,
        ),
      );

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/sessions')
        .send({ email: 'me@example.test', password: 'Sunny-Day-42' });

      // Assert
      expect(response.status).toBe(429);
      expect(response.body).toEqual({
        statusCode: 429,
        message: 'Too many failed sign-ins. Try again later.',
        error: 'Too Many Requests',
        retryAt: '2026-10-28T12:15:00.000Z',
      });
    });
  });

  describe('GET /api/v1/me', () => {
    it('answers 200 with the signed-in User', async () => {
      // Arrange
      identity.getUser.mockResolvedValue({ id: 'user-1', email: 'me@example.test' });

      // Act
      const response = await request(app.getHttpServer()).get('/api/v1/me');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 'user-1', email: 'me@example.test' });
      expect(identity.getUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('DELETE /api/v1/sessions/current', () => {
    it('ends only the current Session and answers 204 with no body and an expired cookie (S-4)', async () => {
      // Arrange
      identity.signOut.mockResolvedValue(undefined);

      // Act
      const response = await request(app.getHttpServer()).delete('/api/v1/sessions/current');

      // Assert
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(identity.signOut).toHaveBeenCalledWith('session-1');
      expect(setCookies(response)[0]).toMatch(/^sid=;/);
      expect(setCookies(response)[0]).toContain('Max-Age=0');
    });
  });
});
