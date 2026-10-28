import { Body, Controller, Delete, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';
import { requireJsonBody, securityHeaders } from './http-security';

describe('securityHeaders', () => {
  const run = (options: { hsts: boolean }) => {
    const headers = new Map<string, string>();
    const res = { setHeader: (name: string, value: string) => void headers.set(name, value) };
    const next = jest.fn();
    securityHeaders(options)({} as never, res as unknown as Response, next);
    return { headers, next };
  };

  it('marks every response as private, un-sniffable, un-frameable and un-linkable', () => {
    // Arrange
    const options = { hsts: false };

    // Act
    const { headers } = run(options);

    // Assert
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(headers.get('Content-Security-Policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
  });

  it('asks browsers to insist on https when the API is served over https', () => {
    // Arrange
    const options = { hsts: true };

    // Act
    const { headers } = run(options);

    // Assert
    expect(headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('leaves out Strict-Transport-Security when the API is served over plain http', () => {
    // Arrange
    const options = { hsts: false };

    // Act
    const { headers } = run(options);

    // Assert
    expect(headers.has('Strict-Transport-Security')).toBe(false);
  });

  it('passes the request on to the next handler', () => {
    // Arrange
    const options = { hsts: false };

    // Act
    const { next } = run(options);

    // Assert
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// The real HTTP stack, so "has a body" and "is JSON" are decided by Express and not by a stub.
describe('requireJsonBody', () => {
  @Controller('probe')
  class ProbeController {
    @Post()
    create(@Body() body: unknown): { received: unknown } {
      return { received: body };
    }

    @Delete()
    remove(): { removed: boolean } {
      return { removed: true };
    }
  }

  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication();
    app.use(requireJsonBody());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets a JSON body through', async () => {
    // Arrange
    const body = { email: 'me@example.test' };

    // Act
    const response = await request(app.getHttpServer()).post('/probe').send(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: body });
  });

  it('lets a JSON body with a charset through', async () => {
    // Arrange
    const body = JSON.stringify({ a: 1 });

    // Act
    const response = await request(app.getHttpServer())
      .post('/probe')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ received: { a: 1 } });
  });

  it.each([
    [
      'a form post (the cross-site login-CSRF vector)',
      'application/x-www-form-urlencoded',
      'email=a%40b.test&password=x',
    ],
    [
      'JSON smuggled as text/plain (a "simple" cross-site request)',
      'text/plain',
      '{"email":"a@b.test"}',
    ],
  ])('refuses %s with 415 and a Nest-shaped body', async (_why, contentType, body) => {
    // Arrange
    const server = app.getHttpServer();

    // Act
    const response = await request(server)
      .post('/probe')
      .set('Content-Type', contentType)
      .send(body);

    // Assert
    expect(response.status).toBe(415);
    expect(response.body).toEqual({
      statusCode: 415,
      message: 'Content-Type must be application/json',
      error: 'Unsupported Media Type',
    });
  });

  it('lets a POST without a body through', async () => {
    // Arrange
    const server = app.getHttpServer();

    // Act
    const response = await request(server).post('/probe');

    // Assert
    expect(response.status).toBe(201);
  });

  it('lets a DELETE without a body through', async () => {
    // Arrange
    const server = app.getHttpServer();

    // Act
    const response = await request(server).delete('/probe');

    // Assert
    expect(response.status).toBe(200);
  });

  it('lets an empty body without a content type through (some clients send Content-Length: 0)', async () => {
    // Arrange
    const server = app.getHttpServer();

    // Act
    const response = await request(server).post('/probe').set('Content-Length', '0');

    // Assert
    expect(response.status).toBe(201);
  });
});
