import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import type { CookieOptions, Request, RequestHandler } from 'express';
import session from 'express-session';
import { Pool } from 'pg';
import type { Env } from '../config/env';

export const SESSION_COOKIE_NAME = 'jd.sid';
export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
/** Table created by the Prisma migration (`UserSession` model). */
const SESSION_TABLE = 'user_sessions';

export function sessionCookieOptions(nodeEnv: Env['NODE_ENV']): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    path: '/',
  };
}

/** Owns the PostgreSQL pool used by the express-session store. */
@Injectable()
export class SessionStoreService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly store: connectPgSimple.PGStore;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      max: 5,
    });
    const PgStore = connectPgSimple(session);
    this.store = new PgStore({
      pool: this.pool,
      tableName: SESSION_TABLE,
      createTableIfMissing: false,
      pruneSessionInterval: 15 * 60,
    });
  }

  createMiddleware(): RequestHandler {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    return session({
      name: SESSION_COOKIE_NAME,
      secret: this.config.get('SESSION_SECRET', { infer: true }),
      store: this.store,
      resave: false,
      saveUninitialized: false,
      cookie: { ...sessionCookieOptions(nodeEnv), maxAge: SESSION_MAX_AGE_MS },
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.store.close();
    await this.pool.end();
  }
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error: unknown) => (error ? reject(toError(error)) : resolve()));
  });
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error: unknown) => (error ? reject(toError(error)) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error: unknown) => (error ? reject(toError(error)) : resolve()));
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Session store error');
}
