import { Controller, Get, INestApplication, Res } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { SessionCookie } from './session-cookie';

// The real Express response — `Max-Age=0`, `HttpOnly` and the other attributes are what browsers act on, so
// they are asserted on the actual Set-Cookie header rather than on a stubbed `res.cookie`.
@Controller('probe')
class ProbeController {
  constructor(private readonly sessionCookie: SessionCookie) {}

  @Get('set')
  set(@Res({ passthrough: true }) res: Response): void {
    this.sessionCookie.set(res, 'token-123');
  }

  @Get('clear')
  clear(@Res({ passthrough: true }) res: Response): void {
    this.sessionCookie.clear(res);
  }

  @Get('set-then-clear')
  setThenClear(@Res({ passthrough: true }) res: Response): void {
    this.sessionCookie.set(res, 'old-token');
    this.sessionCookie.clear(res);
  }
}

describe('SessionCookie', () => {
  let app: INestApplication;

  async function startApp(cookieSecure: boolean): Promise<void> {
    const config: AppConfig = { port: 0, databaseUrl: 'unused', cookieSecure };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [SessionCookie, { provide: APP_CONFIG, useValue: config }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }

  const setCookieHeaders = async (path: string): Promise<string[]> => {
    const response = await request(app.getHttpServer()).get(path).expect(200);
    return response.headers['set-cookie'] as unknown as string[];
  };

  afterEach(async () => {
    await app.close();
  });

  describe('set', () => {
    it('sends the Session id as an httpOnly, SameSite=Lax cookie for the whole site, lasting 30 days', async () => {
      // Arrange
      await startApp(false);

      // Act
      const [cookie] = await setCookieHeaders('/probe/set');

      // Assert
      expect(cookie).toContain('sid=token-123');
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('leaves out Secure on local http, so the browser keeps the cookie', async () => {
      // Arrange
      await startApp(false);

      // Act
      const [cookie] = await setCookieHeaders('/probe/set');

      // Assert
      expect(cookie).not.toContain('Secure');
    });

    it('adds Secure when configured for https', async () => {
      // Arrange
      await startApp(true);

      // Act
      const [cookie] = await setCookieHeaders('/probe/set');

      // Assert
      expect(cookie).toContain('Secure');
    });
  });

  describe('clear', () => {
    it('expires the cookie at once: empty value and Max-Age=0, with the same scope attributes', async () => {
      // Arrange
      await startApp(false);

      // Act
      const [cookie] = await setCookieHeaders('/probe/clear');

      // Assert
      expect(cookie).toMatch(/^sid=;/);
      expect(cookie).toContain('Max-Age=0');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('replaces a sid cookie already queued for the same response instead of sending two contradicting ones', async () => {
      // Arrange
      await startApp(false);

      // Act
      const cookies = await setCookieHeaders('/probe/set-then-clear');

      // Assert
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toMatch(/^sid=;/);
      expect(cookies[0]).toContain('Max-Age=0');
    });
  });
});
