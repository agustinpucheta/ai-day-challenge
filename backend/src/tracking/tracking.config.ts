export interface TrackingOptions {
  /** Maximum tracked issues per user; adding past it answers 409 TRACKING_LIMIT_REACHED. */
  maxPerUser: number;
  /** How long a loaded issue is served from memory (per user, per site, per key). */
  cacheTtlMs: number;
  /** Maximum number of cached entries across all users (oldest evicted first). */
  cacheMaxEntries: number;
  /** Jira reads in flight at once when loading the tracked list. */
  loadConcurrency: number;
}

export const TRACKING_CONFIG: TrackingOptions = {
  maxPerUser: 50,
  cacheTtlMs: 60_000,
  cacheMaxEntries: 1000,
  loadConcurrency: 4,
};

export const TRACKING_OPTIONS = Symbol('TRACKING_OPTIONS');
