import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { Env, ROOT_ENV_FILE, validateEnv } from './config/env';
import { CryptoModule } from './crypto/crypto.module';
import { HealthModule } from './health/health.module';
import { JiraOAuthModule } from './jira/jira-oauth.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ROOT_ENV_FILE,
      validate: validateEnv,
    }),
    // Applied only where ThrottlerGuard is used (login/register), keyed by client IP.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.get('AUTH_RATE_LIMIT_PER_MINUTE', { infer: true }),
          },
        ],
      }),
    }),
    PrismaModule,
    CryptoModule,
    AuditModule,
    UsersModule,
    AuthModule,
    PreferencesModule,
    JiraOAuthModule,
    HealthModule,
  ],
})
export class AppModule {}
