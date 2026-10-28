import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { TEST_DATABASE_URL } from './database';

/** The real app — AppModule and the same `configureApp` as production — against the docker-compose test database. */
export async function createTestApp(): Promise<NestExpressApplication> {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  // Listening once (ephemeral loopback port) lets Supertest reuse the server instead of re-listening per request.
  await app.listen(0, '127.0.0.1');
  return app;
}
