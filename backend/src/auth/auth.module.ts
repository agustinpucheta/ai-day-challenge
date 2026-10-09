import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { SessionStoreService } from './session';
import { SessionGuard } from './session.guard';

@Module({
  imports: [UsersModule, AuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    SessionStoreService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [SessionStoreService],
})
export class AuthModule {}
