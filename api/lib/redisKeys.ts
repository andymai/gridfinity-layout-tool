/**
 * Centralized Redis key builders for all API endpoints.
 *
 * Keeping every namespace pattern in one file prevents collisions and
 * makes the key layout discoverable. When you add a feature that talks
 * to Redis, define the key shape here.
 *
 * Namespaces in use:
 *   share:hash:{id}                 → delete-token hash for an anonymous share
 *   share:reports:{id}              → abuse-report counter for a share
 *   ratelimit:{action}:{scope}      → sliding-window rate-limit counter
 *   session:{token}                 → user session record (sync feature)
 *   users:{uid}:sessions            → SET of session tokens owned by a user
 *   users:{uid}:profile             → user profile (email, provider, etc.)
 *   users:{uid}:index:{kind}        → HASH of a user's synced layouts/designs
 *   users:{uid}:indexUpdatedAt      → ms timestamp for If-Modified-Since on /api/sync/manifest
 */

export type SyncItemKind = 'layouts' | 'designs';

/** Delete-token hash for an anonymous share. */
export function shareHashKey(shareId: string): string {
  return `share:hash:${shareId}`;
}

/** Abuse-report counter for an anonymous share. */
export function shareReportKey(shareId: string): string {
  return `share:reports:${shareId}`;
}

/** Sliding-window rate-limit counter. `scope` is hashedIP for anonymous, userId for authed. */
export function rateLimitKey(action: string, scope: string): string {
  return `ratelimit:${action}:${scope}`;
}

/** Sync user-session record. */
export function sessionKey(token: string): string {
  return `session:${token}`;
}

/** SET of session tokens for a user (for cascade invalidation on sign-out / account delete). */
export function userSessionsKey(userId: string): string {
  return `users:${userId}:sessions`;
}

/** Sync user profile (email, provider, displayName, providerSubject). */
export function userProfileKey(userId: string): string {
  return `users:${userId}:profile`;
}

/** Per-user item index (hash of `IndexEntry` keyed by item id). */
export function userIndexKey(userId: string, kind: SyncItemKind): string {
  return `users:${userId}:index:${kind}`;
}

/** Last-mutation ms timestamp for cheap 304 responses on `/api/sync/manifest`. */
export function userIndexUpdatedAtKey(userId: string): string {
  return `users:${userId}:indexUpdatedAt`;
}
