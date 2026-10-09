import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { API_PREFIX } from './app.setup';
import { buildOpenApiDocument } from './swagger';

/**
 * Writes backend/openapi.json for frontend type generation (openapi-typescript).
 * Preview mode builds the module graph without instantiating providers, so no
 * database connection is opened. Environment validation still runs (root .env).
 */
async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  app.setGlobalPrefix(API_PREFIX);
  const document = buildOpenApiDocument(app);
  const target = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();
  process.stdout.write(
    `OpenAPI spec written to openapi.json (${Object.keys(document.paths).length} paths)\n`,
  );
}

void exportOpenApi();
