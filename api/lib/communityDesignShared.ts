/** Lookups and guards the community design route handlers share. */
import type { VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { communityDesignKey, communityPublishedKey } from './redisKeys.js';
import { getRedis } from './rateLimit.js';
import { ErrorCode, sendError } from './shared.js';
import type { CommunityDesignStatus } from './communityStore.js';

export function designNotFound(res: VercelResponse) {
  return sendError(res, 404, ErrorCode.NOT_FOUND, 'Design not found');
}

/**
 * Ownership is always the server-side published set keyed by the session's
 * userId. A client-sent publishedId is never consulted.
 */
export async function isPublishedBy(userId: string, designId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  return (await redis.sismember(communityPublishedKey(userId), designId)) === 1;
}

/**
 * Moderation flips (admin hide/restore, denylist sweeps) write status to the
 * Redis card hash only; the record blob keeps its publish-time 'live'. The
 * hash is therefore the source of truth for every moderation gate. When the
 * hash is unreadable a blob-live design fails closed to 'hidden' so a lost
 * or corrupt hash can never resurrect a moderated design; a blob status of
 * 'hidden'/'removed' is already restrictive and is kept as-is.
 */
export async function readModerationStatus(
  id: string,
  fallback: CommunityDesignStatus
): Promise<CommunityDesignStatus> {
  const failClosed: CommunityDesignStatus = fallback === 'live' ? 'hidden' : fallback;
  const redis = getRedis();
  if (!redis) return failClosed;
  const status = await redis.hget(communityDesignKey(id), 'status');
  return status === 'live' || status === 'hidden' || status === 'removed' ? status : failClosed;
}

/**
 * Cardinality ceiling for one dedupe set (one design, one 7-day bucket).
 * Memory defense in depth on a small Redis instance: past this many distinct
 * members the set stops growing and counting for the rest of the window.
 */
export const COMMUNITY_DEDUPE_MAX_MEMBERS = 20_000;

/**
 * Existence + visibility gate for the POST actions. Unlike GET, no action
 * needs the ~1 MB record blob just to be admitted, so the card hash status
 * is read directly. A missing hash (never published or already deleted)
 * collapses onto the same 404 as hidden/removed, preserving the
 * "indistinguishable from missing" invariant.
 *
 * Actions on live designs deliberately ignore the COMMUNITY_PUBLISH_ENABLED
 * kill switch: it gates creating new public content, not engaging with
 * content that is already live.
 */
export async function requireLiveDesign(redis: Redis, id: string): Promise<boolean> {
  const status = await redis.hget(communityDesignKey(id), 'status');
  return status === 'live';
}
