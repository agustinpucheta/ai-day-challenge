import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { SESSION_COOKIE_NAME } from './auth/session';

/** Not under the /api/v1 prefix: Swagger UI at /api/docs, JSON at /api/docs-json. */
export const SWAGGER_UI_PATH = 'api/docs';
export const SWAGGER_JSON_PATH = 'api/docs-json';

/** Requires the global prefix to be set first so paths include /api/v1. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Jira Dashboard API')
    .setDescription(
      'Local REST API. Authentication uses a server-side session cookie. ' +
        'State-changing requests must send an allowed Origin header. ' +
        'Errors use the normalized { code, message } body.',
    )
    .setVersion('0.1.0')
    .addCookieAuth(SESSION_COOKIE_NAME, { type: 'apiKey', in: 'cookie' }, SESSION_COOKIE_NAME)
    .build();
  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_UI_PATH, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
    swaggerOptions: { withCredentials: true },
  });
}
