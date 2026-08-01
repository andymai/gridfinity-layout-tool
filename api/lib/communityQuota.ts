import type { Redis } from 'ioredis';
import { communityPublishedKey } from './redisKeys.js';

/**
 * Live published designs allowed per user. Count-only: per-design byte
 * ceilings are enforced at validation time (params 100KB/2MB, thumbnails
 * 200KB each, GLB 2MB), so a bytes axis would be redundant.
 */
export const COMMUNITY_MAX_LIVE_DESIGNS = 25;

export interface CommunityQuotaError {
  type: 'QUOTA_EXCEEDED';
  reason: 'count';
  /** Usage that would result if the publish proceeded. */
  current: number;
  /** The cap that was hit. */
  limit: number;
}

export type CommunityQuotaCheck = { ok: true } | { ok: false; error: CommunityQuotaError };

/**
 * Check whether a publish would push the user past the live-design cap.
 *
 * Only new publishes consult quota: updates (PUT) never change the published
 * set's membership, and deletes free the slot via SREM at the call site.
 *
 * Concurrent-publish note (mirrors quota.ts): two racing publishes both read
 * SCARD before either SADDs, so the cap can briefly overshoot by one.
 * Accepted as a soft ceiling at this scale.
 */
export async function checkCommunityPublishQuota(
  redis: Redis,
  userId: string
): Promise<CommunityQuotaCheck> {
  const liveCount = await redis.scard(communityPublishedKey(userId));
  const projectedCount = liveCount + 1;
  if (projectedCount > COMMUNITY_MAX_LIVE_DESIGNS) {
    return {
      ok: false,
      error: {
        type: 'QUOTA_EXCEEDED',
        reason: 'count',
        current: projectedCount,
        limit: COMMUNITY_MAX_LIVE_DESIGNS,
      },
    };
  }
  return { ok: true };
}
