import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import {
  communityDesignKey,
  communityLikesKey,
  communityReportReasonKey,
  communityViewedKey,
} from '../lib/redisKeys.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { readOptionalSession } from '../lib/session.js';
import { logger } from '../lib/logger.js';
import { ErrorCode, methodNotAllowed, rateLimited, sendError } from '../lib/shared.js';
import {
  COMMUNITY_DEDUPE_TTL_SECONDS,
  communityDedupeBucket,
  readCommunityDesignBlob,
} from '../lib/communityStore.js';
import type { CommunityHiddenReason } from '../lib/communityStore.js';
import { COMMUNITY_REPORT_REASONS } from '../lib/communityValidation.js';
import type { CommunityReportReason } from '../lib/communityValidation.js';
import { resolveSupporterAuthors } from '../lib/supporterLink.js';
import {
  designNotFound,
  isPublishedBy,
  readModerationStatus,
  COMMUNITY_DEDUPE_MAX_MEMBERS,
} from '../lib/communityDesignShared.js';
import { handlePost } from '../lib/communityDesignActions.js';
import { handlePut, handleDelete } from '../lib/communityDesignMutations.js';

const COMMUNITY_DESIGN_ID_REGEX = /^[a-zA-Z0-9]{12}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !COMMUNITY_DESIGN_ID_REGEX.test(id)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid design ID');
  }

  switch (req.method) {
    case 'OPTIONS':
      return res.status(200).end();
    case 'GET':
      return handleGet(req, res, id);
    case 'PUT':
      return handlePut(req, res, id);
    case 'POST':
      return handlePost(req, res, id);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      return methodNotAllowed(res, 'GET, PUT, POST, DELETE');
  }
}

/**
 * Dominant reported-reason category for the owner-facing hidden explanation.
 * Ties resolve in COMMUNITY_REPORT_REASONS order; null when nothing was
 * tallied (pre-tally hides, admin hides).
 */
async function readTopReportReason(
  redis: Redis,
  id: string
): Promise<CommunityReportReason | null> {
  const tallies = await redis.hgetall(communityReportReasonKey(id));
  let top: CommunityReportReason | null = null;
  let topCount = 0;
  for (const reason of COMMUNITY_REPORT_REASONS) {
    const count = Number(tallies[reason] ?? 0);
    if (count > topCount) {
      top = reason;
      topCount = count;
    }
  }
  return top;
}

/**
 * Owner-only "views" counter, bumped on public detail GETs of live designs.
 * Dedupes on the hashed caller IP per weekly bucket (GET has no request body,
 * so there is no clientId to pair it with the way open/export do) and shares
 * their cardinality ceiling. Best-effort: a Redis hiccup here must not fail
 * the read that already succeeded.
 */
async function recordCommunityView(redis: Redis, id: string, clientIP: string): Promise<void> {
  try {
    const dedupeKey = communityViewedKey(id, communityDedupeBucket(Date.now()));
    if ((await redis.scard(dedupeKey)) >= COMMUNITY_DEDUPE_MAX_MEMBERS) return;
    const ipAdded = await redis.sadd(
      dedupeKey,
      `ip:${createHash('sha256').update(clientIP).digest('hex').slice(0, 16)}`
    );
    if (ipAdded !== 1) return;
    await redis.expire(dedupeKey, COMMUNITY_DEDUPE_TTL_SECONDS);
    await redis.hincrby(communityDesignKey(id), 'views', 1);
  } catch (error) {
    logger.warn('Community view counter failed', {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const clientIP = getClientIP(req);
    const rateLimit = await checkRateLimit(clientIP, 'community.read');
    if (!rateLimit.allowed) {
      return rateLimited(res, rateLimit.retryAfterSeconds);
    }

    const record = await readCommunityDesignBlob(id);
    if (!record) {
      return designNotFound(res);
    }

    const status = await readModerationStatus(id, record.status);
    // Ownership resolves on every GET (not only the hidden/removed branch) so
    // the detail view can render owner actions without a second request.
    const session = await readOptionalSession(req);
    const owns = session !== null && (await isPublishedBy(session.userId, id));
    if (status !== 'live' && !owns) {
      // Hidden/removed designs must be indistinguishable from missing ones
      // for everyone but their owner, so a takedown can't be probed.
      return designNotFound(res);
    }

    // Counts and like-state ship with the detail so the stats row does not
    // depend on the capped browse index: a design past the client's index cap
    // (or any index fetch failure) still gets a heart and counters.
    const redis = getRedis();
    let counts: {
      likes: number;
      remixes: number;
      exports: number;
      opens?: number;
      views?: number;
    } | null = null;
    let likedByMe = false;
    let authorIsSupporter = false;
    let hiddenReason: CommunityHiddenReason | null = null;
    let hiddenReasonCategory: CommunityReportReason | null = null;
    if (redis) {
      authorIsSupporter = (await resolveSupporterAuthors(redis, [record.authorPublicId])).size > 0;
      const [likes, remixes, exports, opens, views, storedHiddenReason] = await redis.hmget(
        communityDesignKey(id),
        'likes',
        'remixes',
        'exports',
        'opens',
        'views',
        'hiddenReason'
      );
      counts = {
        likes: Number(likes ?? 0),
        remixes: Number(remixes ?? 0),
        exports: Number(exports ?? 0),
        // Opens/views are owner-only stats and must never reach a public
        // response, so they are attached only on the owns branch.
        ...(owns && { opens: Number(opens ?? 0), views: Number(views ?? 0) }),
      };
      if (session !== null) {
        likedByMe = (await redis.sismember(communityLikesKey(id), session.userId)) === 1;
      }
      if (owns && status === 'hidden') {
        if (
          storedHiddenReason === 'reports' ||
          storedHiddenReason === 'denylist' ||
          storedHiddenReason === 'moderation'
        ) {
          hiddenReason = storedHiddenReason;
        }
        hiddenReasonCategory = await readTopReportReason(redis, id);
      }
      // A15: lineage-resolution and publish-dialog fetches pass ?view=0 so a
      // parent design's view count is not inflated by the remix flow.
      const viewParam = Array.isArray(req.query.view) ? req.query.view[0] : req.query.view;
      if (status === 'live' && !owns && viewParam !== '0') {
        await recordCommunityView(redis, id, clientIP);
      }
    }

    return res.status(200).json({
      design: { ...record, status },
      isOwner: owns,
      counts,
      likedByMe,
      authorIsSupporter,
      ...(owns && status === 'hidden' && { hiddenReason, hiddenReasonCategory }),
    });
  } catch (error) {
    logger.error('Community design fetch error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to fetch design');
  }
}
