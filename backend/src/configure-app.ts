import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { APP_CONFIG } from './config/app-config';
import type { AppConfig } from './config/app-config';
import { requireJsonBody, securityHeaders } from './http-security';
import { createValidationPipe } from './validation-pipe';

/**
 * Everything about the HTTP surface that is not a module: used by `main.ts` and by the integration tests, so tests
 * exercise the app exactly as it runs. Must run before `listen()` / `init()` — the middleware registered here has
 * to come before the body parsers Nest adds at `init()`.
 */
export function configureApp(app: NestExpressApplication): void {
  const { cookieSecure } = app.get<AppConfig>(APP_CONFIG);
  app.setGlobalPrefix('api/v1');
  app.disable('x-powered-by');
  app.use(securityHeaders({ hsts: cookieSecure }));
  app.use(requireJsonBody());
  app.useGlobalPipes(createValidationPipe());
  app.use(cookieParser());
}
