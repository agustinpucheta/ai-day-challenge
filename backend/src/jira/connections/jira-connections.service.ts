import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../audit/audit.service';
import type { Env } from '../../config/env';
import { TokenCipher, TokenDecryptionError } from '../../crypto/token-cipher';
import { Prisma, type JiraConnection } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AtlassianInvalidGrantError } from '../oauth/atlassian-errors';
import {
  AtlassianOAuthClient,
  type AccessibleResource,
  type AtlassianTokens,
} from '../oauth/atlassian-oauth.client';
import { HTTP_TIMEOUT_MS } from '../oauth/http-port';
import {
  ConnectionNotFoundError,
  MultipleSitesError,
  NoAccessibleSiteError,
  ReauthorizationRequiredError,
} from './errors';

/** Tokens expiring within this window are refreshed before use. */
export const ACCESS_TOKEN_SKEW_MS = 60_000;
/** `last_used_at` is refreshed at most once per interval. */
export const LAST_USED_THROTTLE_MS = 60_000;
/** Waiting for the row lock plus one HTTP call (10 s timeout) must fit in the transaction. */
const REFRESH_TX_TIMEOUT_MS = HTTP_TIMEOUT_MS + 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConnectFromCodeInput {
  userId: string;
  code: string;
  preferredSiteUrl?: string;
}

/** Sanitized view of a connection: never tokens or ciphertext. */
export interface JiraConnectionDto {
  id: string;
  cloudId: string;
  siteUrl: string;
  siteName: string;
  status: 'active' | 'reauthorization_required';
  grantedScopes: string[];
  connectedAt: Date;
  lastUsedAt: Date | null;
}

type RefreshOutcome =
  { kind: 'token'; accessToken: string; refreshed: boolean } | { kind: 'reauth' };

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return `${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

@Injectable()
export class JiraConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipher,
    private readonly client: AtlassianOAuthClient,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * One row per authorization: tokens belong to the authorization, not to a site, so storing
   * the same refresh token under several sites would leave stale copies after rotation.
   */
  async connectFromAuthorizationCode(input: ConnectFromCodeInput): Promise<JiraConnectionDto> {
    const tokens = await this.client.exchangeCode(input.code);
    const resources = await this.client.listAccessibleResources(tokens.accessToken);
    const preferred =
      input.preferredSiteUrl ?? this.config.get('ATLASSIAN_PREFERRED_SITE_URL', { infer: true });
    const site = this.selectSite(resources, preferred);

    const row = await this.upsertConnection(input.userId, site, tokens);
    await this.audit.record({
      type: 'jira_connected',
      success: true,
      userId: input.userId,
      connectionId: row.id,
      metadata: { cloudId: row.cloudId },
    });
    return toDto(row);
  }

  async listForUser(userId: string): Promise<JiraConnectionDto[]> {
    const rows = await this.prisma.jiraConnection.findMany({
      where: { userId },
      orderBy: { connectedAt: 'asc' },
    });
    return rows.map(toDto);
  }

  /** Returns a usable access token, refreshing (serialized per connection) when needed. */
  async getValidAccessToken(userId: string, connectionId: string): Promise<string> {
    const row = await this.findOwned(userId, connectionId);
    if (row.status === 'reauthorization_required') throw new ReauthorizationRequiredError();

    if (row.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_TOKEN_SKEW_MS) {
      const accessToken = await this.decryptOrMark(row, row.accessTokenCiphertext);
      await this.touchLastUsed(row.id);
      return accessToken;
    }

    const outcome = await this.refreshLocked(userId, row.id);
    if (outcome.kind === 'reauth') {
      await this.recordReauth(userId, row.id, 'invalid_grant_or_unreadable_tokens');
      throw new ReauthorizationRequiredError();
    }
    if (outcome.refreshed) {
      await this.audit.record({
        type: 'jira_token_refreshed',
        success: true,
        userId,
        connectionId: row.id,
      });
    }
    await this.touchLastUsed(row.id);
    return outcome.accessToken;
  }

  /**
   * Removes the local connection. Atlassian documents no app-side revocation endpoint, so
   * nothing is revoked remotely; the user can remove the app from their Atlassian account.
   */
  async disconnect(userId: string, connectionId: string): Promise<void> {
    const row = await this.findOwned(userId, connectionId);
    const deleted = await this.prisma.jiraConnection.deleteMany({
      where: { id: row.id, userId },
    });
    if (deleted.count === 0) throw new ConnectionNotFoundError();
    // The row is gone, so the id goes in metadata (the FK column would be rejected).
    await this.audit.record({
      type: 'jira_disconnected',
      success: true,
      userId,
      metadata: { connectionId: row.id, cloudId: row.cloudId },
    });
  }

  private selectSite(resources: AccessibleResource[], preferredUrl?: string): AccessibleResource {
    const [only, ...rest] = resources;
    if (only === undefined) throw new NoAccessibleSiteError();
    if (rest.length === 0) return only;
    if (preferredUrl !== undefined) {
      const wanted = normalizeSiteUrl(preferredUrl);
      const match = resources.find((resource) => normalizeSiteUrl(resource.url) === wanted);
      if (match !== undefined) return match;
    }
    throw new MultipleSitesError(
      resources.map(({ cloudId, name, url }) => ({ cloudId, name, url })),
    );
  }

  /** Reconnecting keeps the row id, so the AAD of previously stored data stays valid. */
  private async upsertConnection(
    userId: string,
    site: AccessibleResource,
    tokens: AtlassianTokens,
  ): Promise<JiraConnection> {
    for (let attempt = 0; ; attempt++) {
      const existing = await this.prisma.jiraConnection.findUnique({
        where: { userId_cloudId: { userId, cloudId: site.cloudId } },
      });
      const id = existing?.id ?? randomUUID();
      const common = {
        siteUrl: site.url,
        siteName: site.name,
        grantedScopes: tokens.scopes,
        status: 'active' as const,
        ...this.encryptTokens(id, tokens),
      };
      try {
        if (existing !== null) {
          return await this.prisma.jiraConnection.update({
            where: { id },
            data: { ...common, connectedAt: new Date() },
          });
        }
        return await this.prisma.jiraConnection.create({
          data: { id, userId, cloudId: site.cloudId, ...common },
        });
      } catch (error) {
        // A concurrent connect created the row first: retry once as an update.
        const conflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!conflict || attempt > 0) throw error;
      }
    }
  }

  private encryptTokens(connectionId: string, tokens: AtlassianTokens) {
    return {
      accessTokenCiphertext: this.cipher.encrypt(tokens.accessToken, connectionId),
      refreshTokenCiphertext: this.cipher.encrypt(tokens.refreshToken, connectionId),
      accessTokenExpiresAt: tokens.expiresAt,
      encryptionKeyVersion: this.cipher.currentVersion,
    };
  }

  /** Always filters by user: another user's connection is indistinguishable from a missing one. */
  private async findOwned(userId: string, connectionId: string): Promise<JiraConnection> {
    if (!UUID.test(connectionId)) throw new ConnectionNotFoundError();
    const row = await this.prisma.jiraConnection.findFirst({ where: { id: connectionId, userId } });
    if (row === null) throw new ConnectionNotFoundError();
    return row;
  }

  private async decryptOrMark(row: JiraConnection, ciphertext: string): Promise<string> {
    try {
      return this.cipher.decrypt(ciphertext, row.id);
    } catch (error) {
      if (!(error instanceof TokenDecryptionError)) throw error;
      await this.prisma.jiraConnection.updateMany({
        where: { id: row.id },
        data: { status: 'reauthorization_required' },
      });
      await this.recordReauth(row.userId, row.id, 'decryption_failed');
      throw new ReauthorizationRequiredError();
    }
  }

  private async recordReauth(userId: string, connectionId: string, reason: string): Promise<void> {
    await this.audit.record({
      type: 'jira_reauth_required',
      success: false,
      userId,
      connectionId,
      errorCode: reason,
    });
  }

  private async touchLastUsed(connectionId: string): Promise<void> {
    const now = new Date();
    try {
      await this.prisma.jiraConnection.updateMany({
        where: {
          id: connectionId,
          OR: [
            { lastUsedAt: null },
            { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_THROTTLE_MS) } },
          ],
        },
        data: { lastUsedAt: now },
      });
    } catch {
      // Best effort: bookkeeping must not fail a token request.
    }
  }

  /**
   * The row lock serializes concurrent refreshes of one connection. After acquiring it the row
   * is re-read: a caller that waited reuses the token the winner stored. The rotated refresh
   * token is persisted in the same transaction, before any access token is returned.
   * Failures other than `invalid_grant` roll back and rethrow unchanged (status stays active).
   */
  private async refreshLocked(userId: string, connectionId: string): Promise<RefreshOutcome> {
    return await this.prisma.$transaction(
      async (tx): Promise<RefreshOutcome> => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM jira_connections
          WHERE id = ${connectionId}::uuid AND user_id = ${userId}::uuid
          FOR UPDATE`;
        if (locked.length === 0) throw new ConnectionNotFoundError();

        const row = await tx.jiraConnection.findUniqueOrThrow({ where: { id: connectionId } });
        if (row.status === 'reauthorization_required') return { kind: 'reauth' };

        try {
          if (row.accessTokenExpiresAt.getTime() - Date.now() > ACCESS_TOKEN_SKEW_MS) {
            const accessToken = this.cipher.decrypt(row.accessTokenCiphertext, row.id);
            return { kind: 'token', accessToken, refreshed: false };
          }
          const refreshToken = this.cipher.decrypt(row.refreshTokenCiphertext, row.id);
          const tokens = await this.client.refresh(refreshToken);
          await tx.jiraConnection.update({
            where: { id: row.id },
            data: {
              ...this.encryptTokens(row.id, tokens),
              ...(tokens.scopes.length > 0 ? { grantedScopes: tokens.scopes } : {}),
              lastRefreshedAt: new Date(),
            },
          });
          return { kind: 'token', accessToken: tokens.accessToken, refreshed: true };
        } catch (error) {
          if (
            error instanceof AtlassianInvalidGrantError ||
            error instanceof TokenDecryptionError
          ) {
            await tx.jiraConnection.update({
              where: { id: row.id },
              data: { status: 'reauthorization_required' },
            });
            return { kind: 'reauth' };
          }
          throw error;
        }
      },
      { timeout: REFRESH_TX_TIMEOUT_MS, maxWait: REFRESH_TX_TIMEOUT_MS },
    );
  }
}

function toDto(row: JiraConnection): JiraConnectionDto {
  return {
    id: row.id,
    cloudId: row.cloudId,
    siteUrl: row.siteUrl,
    siteName: row.siteName,
    status: row.status,
    grantedScopes: row.grantedScopes,
    connectedAt: row.connectedAt,
    lastUsedAt: row.lastUsedAt,
  };
}
