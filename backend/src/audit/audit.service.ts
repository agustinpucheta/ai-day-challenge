import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditEventType =
  | 'auth.register'
  | 'auth.login'
  | 'auth.logout'
  | 'jira_connected'
  | 'jira_token_refreshed'
  | 'jira_reauth_required'
  | 'jira_disconnected';

/** Only scalar, non-sensitive metadata is accepted. Never pass passwords, emails, tokens or cookies. */
export type AuditMetadata = Record<string, string | number | boolean>;

export interface AuditEventInput {
  type: AuditEventType;
  success: boolean;
  userId?: string | null;
  /** Must reference an existing connection; for deleted ones put the id in metadata. */
  connectionId?: string | null;
  errorCode?: string;
  metadata?: AuditMetadata;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Best effort: an audit failure never breaks the user-facing operation. */
  async record(event: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          eventType: event.type,
          success: event.success,
          userId: event.userId ?? null,
          connectionId: event.connectionId ?? null,
          errorCode: event.errorCode ?? null,
          ...(event.metadata ? { metadata: event.metadata } : {}),
        },
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(`Failed to record audit event ${event.type} (${name})`);
    }
  }
}
