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
 *   share:lastAccessed:{id}         → ISO timestamp of last GET for a share
 *   ratelimit:{action}:{scope}      → sliding-window rate-limit counter
 *   session:{token}                 → user session record (sync feature)
 *   scan:session:{token}            → ephemeral phone-scan handoff (traced SVG)
 *   users:{uid}:sessions            → SET of session tokens owned by a user
 *   users:{uid}:profile             → user profile (email, provider, etc.)
 *   users:{uid}:index:{kind}        → HASH of a user's synced layouts/designs
 *   users:{uid}:indexUpdatedAt      → ms timestamp for If-Modified-Since on /api/sync/manifest
 *   supporters:donors               → HASH of donorId → JSON {n,t,m} record (legacy: bare name)
 *   supporters:totals               → HASH of currency → received minor units (collect-only)
 *   supporters:msg:{messageId}      → Ko-fi webhook dedupe marker
 *   community:design:{id}           → HASH of card metadata + status + counters for a published design
 *   community:index:{sort}          → ZSET of design ids scored for one sort (newest|remixes|likes)
 *   community:likes:{id}            → SET of userIds who liked a design
 *   community:liked:{uid}           → SET of design ids a user liked (reverse index for heart state + deletion cascade)
 *   community:children:{id}         → SET of published direct-remix design ids
 *   community:author:{publicId}     → SET of design ids published under one author publicId
 *   community:published:{uid}       → SET of design ids a user has published (quota via SCARD)
 *   community:reports:{id}          → SET of userIds who reported a design (per-account dedupe)
 *   community:reportReasons:{id}    → HASH of report reason → distinct-reporter count (owner-facing aggregate)
 *   community:reported:{uid}        → SET of design ids a user reported (reverse index for the account-deletion cascade)
 *   community:denylist              → SET of userIds barred from publishing
 *   community:opened:{id}           → SET of clientId dedupe tokens for the "open" (remix) counter, 7d TTL
 *   community:exported:{id}         → SET of clientId dedupe tokens for the "export" (printed) counter, 7d TTL
 *   community:viewed:{id}           → SET of hashed-IP dedupe tokens for the "views" counter, 7d TTL
 */

export type SyncItemKind = 'layouts' | 'designs' | 'baseplates';

export const COMMUNITY_INDEX_SORTS = ['newest', 'remixes', 'likes'] as const;
export type CommunityIndexSort = (typeof COMMUNITY_INDEX_SORTS)[number];

/** Delete-token hash for an anonymous share. */
export function shareHashKey(shareId: string): string {
  return `share:hash:${shareId}`;
}

/** Abuse-report counter for an anonymous share. */
export function shareReportKey(shareId: string): string {
  return `share:reports:${shareId}`;
}

/** ISO timestamp of the last GET for a share (cheap view-tracking, no blob write). */
export function shareLastAccessedKey(shareId: string): string {
  return `share:lastAccessed:${shareId}`;
}

/** Sliding-window rate-limit counter. `scope` is hashedIP for anonymous, userId for authed. */
export function rateLimitKey(action: string, scope: string): string {
  return `ratelimit:${action}:${scope}`;
}

/** Sync user-session record. */
export function sessionKey(token: string): string {
  return `session:${token}`;
}

/** Ephemeral phone-scan handoff record (traced SVG awaiting desktop pickup). */
export function scanSessionKey(token: string): string {
  return `scan:session:${token}`;
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

/** Ms timestamp of the last tombstone sweep — gates how often `upsertEntry` HGETALLs. */
export function userTombstoneSweptAtKey(userId: string): string {
  return `users:${userId}:tombstoneSweptAt`;
}

/** HASH of Ko-fi supporters: donorId → JSON `{n,t,m}` record (legacy values are a bare name). */
export function supportersDonorsKey(): string {
  return 'supporters:donors';
}

/**
 * HASH of received totals keyed by currency, in integer minor units (cents).
 * Collect-only: incremented on every payment, never served to the page.
 */
export function supportersTotalsKey(): string {
  return 'supporters:totals';
}

/** Dedupe marker for a Ko-fi webhook delivery (their retries reuse `message_id`). */
export function supportersMessageKey(messageId: string): string {
  return `supporters:msg:${messageId}`;
}

/** Card metadata + status + counters for a published community design. */
export function communityDesignKey(designId: string): string {
  return `community:design:${designId}`;
}

/** Sorted set of live design ids for one gallery sort mode. */
export function communityIndexKey(sort: CommunityIndexSort): string {
  return `community:index:${sort}`;
}

/** SET of userIds who liked a design (like counts derive from its card hash, not SCARD). */
export function communityLikesKey(designId: string): string {
  return `community:likes:${designId}`;
}

/** Reverse index: SET of design ids a user liked (heart state + account-deletion cascade). */
export function communityLikedKey(userId: string): string {
  return `community:liked:${userId}`;
}

/** SET of published design ids that are direct remixes of a design. */
export function communityChildrenKey(designId: string): string {
  return `community:children:${designId}`;
}

/** SET of design ids published under one pseudonymous author publicId. */
export function communityAuthorKey(authorPublicId: string): string {
  return `community:author:${authorPublicId}`;
}

/** SET of design ids a user has published; publish quota is SCARD over this. */
export function communityPublishedKey(userId: string): string {
  return `community:published:${userId}`;
}

/** SET of userIds who reported a design (per-account dedupe for the auto-hide threshold). */
export function communityReportsKey(designId: string): string {
  return `community:reports:${designId}`;
}

/**
 * HASH of report reason → distinct-reporter count for a design. Bumped once
 * per new reporter alongside communityReportsKey, so the owner-facing
 * "hidden after reports" explanation can name the dominant reason category
 * without persisting individual reports.
 */
export function communityReportReasonKey(designId: string): string {
  return `community:reportReasons:${designId}`;
}

/**
 * Reverse index: SET of design ids a user reported. Whatever records a report
 * must SADD here too, or the account-deletion cascade cannot find and remove
 * the user's entries from each design's reports set.
 */
export function communityReportedKey(userId: string): string {
  return `community:reported:${userId}`;
}

/** SET of userIds barred from publishing to the community showcase. */
export function communityDenylistKey(): string {
  return 'community:denylist';
}

/**
 * SET of dedupe members (client tokens + hashed IPs) that already triggered
 * the "open" (remix) counter for a design, keyed by 7-day bucket. Bucketing
 * gives every key a fixed expiry and bounded growth: refreshing one key's TTL
 * on each hit would keep any weekly-active design's set alive (and growing)
 * forever. A new bucket starts a fresh window, so an anonymous client's
 * repeat open re-counts the next week instead of capping a design's lifetime
 * count at "unique visitors ever".
 */
export function communityOpenedKey(designId: string, bucket: number): string {
  return `community:opened:${designId}:${bucket}`;
}

/** SET of dedupe members that already triggered the export ("printed") counter for a design. Same weekly-bucket rationale as communityOpenedKey. */
export function communityExportedKey(designId: string, bucket: number): string {
  return `community:exported:${designId}:${bucket}`;
}

/** SET of hashed-IP dedupe members that already triggered the owner-only "views" counter for a design. Same weekly-bucket rationale as communityOpenedKey. */
export function communityViewedKey(designId: string, bucket: number): string {
  return `community:viewed:${designId}:${bucket}`;
}
