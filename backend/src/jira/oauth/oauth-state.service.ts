import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const STATE_BYTES = 32;
const MAX_RAW_STATE_LENGTH = 128;

/**
 * Why a state was refused. Kept distinct for audit and logs; the HTTP layer must show callers
 * one generic failure so the reason does not become an oracle.
 */
export type ConsumeResult = 'ok' | 'invalid' | 'expired' | 'replayed' | 'wrong_session';

const hashState = (raw: string): string => createHash('sha256').update(raw).digest('hex');

/** Single-use OAuth `state` bound to a user and session. Only its SHA-256 hash is stored. */
@Injectable()
export class OAuthStateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the raw state to send to Atlassian; it is never persisted. */
  async issue(userId: string, sessionId: string): Promise<string> {
    const raw = randomBytes(STATE_BYTES).toString('base64url');
    await this.prisma.oAuthState.create({
      data: {
        stateHash: hashState(raw),
        userId,
        sessionId,
        expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
      },
    });
    return raw;
  }

  /**
   * One conditional UPDATE decides the winner, so replays and races lose. The follow-up read
   * only classifies the failure; it never grants anything. The state is looked up by hash, so
   * no secret is compared in memory (a timing-safe comparison is not needed).
   */
  async consume(rawState: string, userId: string, sessionId: string): Promise<ConsumeResult> {
    if (rawState.length === 0 || rawState.length > MAX_RAW_STATE_LENGTH) return 'invalid';
    const stateHash = hashState(rawState);
    const now = new Date();
    const claimed = await this.prisma.oAuthState.updateMany({
      where: { stateHash, userId, sessionId, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (claimed.count === 1) return 'ok';

    const row = await this.prisma.oAuthState.findUnique({ where: { stateHash } });
    if (row === null || row.userId !== userId) return 'invalid';
    if (row.sessionId !== sessionId) return 'wrong_session';
    if (row.consumedAt !== null) return 'replayed';
    return 'expired';
  }

  /** Deletes expired rows and returns how many were removed. Not scheduled yet. */
  async deleteExpired(): Promise<number> {
    const result = await this.prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
