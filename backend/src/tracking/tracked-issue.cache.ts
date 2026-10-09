import type { LoadedIssue } from './tracked-issue.mapper';

interface CacheEntry {
  value: LoadedIssue;
  storedAt: number;
}

/**
 * Small in-memory TTL cache of loaded issues. The key always contains the user id, so an entry is
 * never served to another user. The cached value keeps its original `fetchedAt`: a cache hit is
 * never presented as a fresh read.
 */
export class TrackedIssueCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(userId: string, siteUrl: string, issueKey: string): LoadedIssue | undefined {
    const key = cacheKey(userId, siteUrl, issueKey);
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (this.now() - entry.storedAt >= this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(userId: string, siteUrl: string, issueKey: string, value: LoadedIssue): void {
    const key = cacheKey(userId, siteUrl, issueKey);
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: this.now() });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done === true) break;
      this.entries.delete(oldest.value);
    }
  }

  delete(userId: string, siteUrl: string, issueKey: string): void {
    this.entries.delete(cacheKey(userId, siteUrl, issueKey));
  }

  get size(): number {
    return this.entries.size;
  }
}

function cacheKey(userId: string, siteUrl: string, issueKey: string): string {
  return JSON.stringify([userId, siteUrl, issueKey]);
}
