import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SessionStoreService } from './auth/session';
import { HttpErrorFilter } from './common/errors/http-error.filter';
import { createOriginCheckMiddleware } from './common/security/origin-check.middleware';
import { createValidationPipe } from './common/validation/validation.pipe';
import { Env, apiOrigin, isSwaggerEnabled } from './config/env';
import { setupSwagger } from './swagger';

export const API_PREFIX = 'api/v1';

/** Shared by main.ts and the e2e tests so both run the exact same HTTP pipeline. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const env = {
    NODE_ENV: config.get('NODE_ENV', { infer: true }),
    SWAGGER_ENABLED: config.get('SWAGGER_ENABLED', { infer: true }),
    API_PORT: config.get('API_PORT', { infer: true }),
    API_ORIGIN: config.get('API_ORIGIN', { infer: true }),
  };
  const webOrigin = config.get('WEB_ORIGIN', { infer: true });
  const swaggerEnabled = isSwaggerEnabled(env);
  // The API's own origin is trusted only while Swagger UI ("Try it out") is served.
  const allowedOrigins = swaggerEnabled ? [webOrigin, apiOrigin(env)] : [webOrigin];

  app.disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: webOrigin, credentials: true });
  app.use(createOriginCheckMiddleware(allowedOrigins));
  app.use(app.get(SessionStoreService).createMiddleware());
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpErrorFilter());
  if (swaggerEnabled) {
    setupSwagger(app);
  }
}
