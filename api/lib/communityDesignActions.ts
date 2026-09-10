/** POST actions on a community design: set cover, like, report, and the deduplicated counters. */
import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import {
  communityDenylistKey,
  communityDesignKey,
  communityExportedKey,
  communityOpenedKey,
  communityReportReasonKey,
  communityReportedKey,
  communityReportsKey,
  communityPrintsKey,
} from './redisKeys.js';
import { checkRateLimit, getClientIP, getRedis } from './rateLimit.js';
import { requireSession } from './session.js';
import { logger } from './logger.js';
import { REPORT_THRESHOLD } from './contentFilter.js';
import { ErrorCode, rateLimited, sendError, serviceUnavailable } from './shared.js';
import {
  COMMUNITY_DEDUPE_TTL_SECONDS,
  communityDedupeBucket,
  readCommunityDesignBlob,
  recordModerationTombstone,
  setCommunityDesignStatus,
  toggleCommunityLike,
  writeCommunityDesignBlob,
} from './communityStore.js';
import { parseReportBody } from './communityValidation.js';
import { readCommunityPrints } from './communityPrintStore.js';
import { communityPrintsEnabled } from './communityPrintValidation.js';
import { isObject, isString } from './validationUtils.js';
import {
  designNotFound,
  isPublishedBy,
  COMMUNITY_DEDUPE_MAX_MEMBERS,
  requireLiveDesign,
} from './communityDesignShared.js';

const COMMUNITY_CLIENT_ID_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

export async function handlePost(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const body: unknown = req.body;
    if (!isObject(body) || !isString(body.action)) {
      return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'action is required');
    }
    switch (body.action) {
      case 'like':
        return await handleLikeAction(req, res, id, true);
      case 'unlike':
        return await handleLikeAction(req, res, id, false);
      case 'report':
        return await handleReportAction(req, res, id, body);
      case 'open':
        return await handleCounterAction(req, res, id, 'open', body);
      case 'export':
        return await handleCounterAction(req, res, id, 'export', body);
      case 'setCover':
        return await handleSetCoverAction(req, res, id, body);
      default:
        return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Unknown action');
    }
  } catch (error) {
    logger.error('Community design action error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to perform action');
  }
}

/**
 * Owner opt-in cover promotion: replace the design's card image with one of its
 * print photos, or clear it back to the render.
 *
 * Owner-only and validated against the design's own live prints. Without that
 * check the field would accept any URL, which is the whole risk this feature
 * carries: the gallery grid is the most public surface in the app, and an
 * unreviewed image reaching it is exactly what owner opt-in exists to prevent.
 */
async function handleSetCoverAction(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  body: Record<string, unknown>
) {
  // Promotion is part of the prints feature, so the kill switch covers it too:
  // otherwise an owner could still push an unreviewed photo onto the grid
  // while prints are meant to be dark.
  if (!communityPrintsEnabled()) {
    return serviceUnavailable(res, 'Print reports are not available.');
  }

  const session = await requireSession(req, res);
  if (!session) return;

  const rateLimit = await checkRateLimit(session.userId, 'community.manage');
  if (!rateLimit.allowed) return rateLimited(res, rateLimit.retryAfterSeconds);

  const redis = getRedis();
  if (!redis) return serviceUnavailable(res);

  if (!(await isPublishedBy(session.userId, id))) return designNotFound(res);

  const photoUrl = body.photoUrl;
  if (photoUrl !== null && !isString(photoUrl)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'photoUrl must be a string or null');
  }

  // Captured in the same pass as the ownership check: the print that proves
  // the photo is promotable is also the only thing that knows its
  // browsing-sized copy, and the gallery grid needs that rather than the
  // 1200px original.
  let coverPhotoThumbUrl = '';
  if (photoUrl !== null) {
    const printerIds = await redis.zrange(communityPrintsKey(id), 0, '-1');
    const prints = await readCommunityPrints(redis, id, printerIds);
    const owner = prints.find(
      (print) => print !== null && print.status === 'live' && print.photos.includes(photoUrl)
    );
    if (!owner) {
      return sendError(
        res,
        400,
        ErrorCode.VALIDATION_ERROR,
        'photoUrl must be a photo from a live print of this design'
      );
    }
    // Read as optional: a record that reached here without going through
    // parsePrint has no normalised array, and a missing browsing copy must
    // cost the optimisation, not 500 the promote.
    const thumbs = (owner as { photoThumbs?: readonly string[] }).photoThumbs;
    coverPhotoThumbUrl = thumbs?.[owner.photos.indexOf(photoUrl)] ?? '';
  }

  await redis.hset(communityDesignKey(id), {
    coverPhotoUrl: photoUrl ?? '',
    coverPhotoThumbUrl,
  });

  // Mirror onto the record blob so a detail fetch and the card agree; the hash
  // is the one the gallery reads, so a blob failure must not fail the action.
  const record = await readCommunityDesignBlob(id);
  if (record !== null) {
    await writeCommunityDesignBlob(
      { ...record, coverPhotoUrl: photoUrl ?? '' },
      { allowOverwrite: true }
    ).catch((err: unknown) => {
      logger.warn('Community cover: record blob mirror failed', {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return res.status(200).json({ coverPhotoUrl: photoUrl ?? '' });
}

async function handleLikeAction(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  like: boolean
) {
  const session = await requireSession(req, res);
  if (!session) return;

  const rateLimit = await checkRateLimit(session.userId, 'community.like');
  if (!rateLimit.allowed) return rateLimited(res, rateLimit.retryAfterSeconds);

  const redis = getRedis();
  if (!redis) return serviceUnavailable(res);

  // A3: a deny-listed account keeps no like/report powers, matching publish/PUT.
  if ((await redis.sismember(communityDenylistKey(), session.userId)) === 1) {
    return sendError(
      res,
      403,
      ErrorCode.UNAUTHORIZED,
      'This action is not available for this account.'
    );
  }

  // A15: only a NEW like requires a live design. Withdrawing a like (unlike)
  // must keep working after the design was hidden/removed, or a user could
  // never clear a heart on a moderated design.
  const isLive = await requireLiveDesign(redis, id);
  if (like && !isLive) return designNotFound(res);

  const { likes, likedByMe } = await toggleCommunityLike(redis, session.userId, id, like);

  // The unlike above really did clear the heart, but the stored count must not
  // come back for a non-live design: the Lua script reads `likes` off the card
  // hash whatever the status, so a hidden design answers {likes: N} where a
  // deleted one answers {likes: 0}. That difference confirms a takedown and
  // leaks the pre-takedown count. Answer as the missing design would.
  if (!isLive) return res.status(200).json({ likes: 0, likedByMe: false });

  return res.status(200).json({ likes, likedByMe });
}

/**
 * Reversible soft-hide: flip status to hidden and de-index, keeping the record
 * and asset blobs intact so an admin restore brings the design back whole. A
 * report threshold is a signal, not a verdict, so it must NOT delete CDN
 * assets: the takedown that purges assets is the admin hide/denylist/purge path
 * (scripts/community-admin, API delete), which fails loud on a delete error.
 */
async function autoHideCommunityDesign(redis: Redis, id: string): Promise<boolean> {
  await setCommunityDesignStatus(redis, id, 'hidden');
  // Distinguishes this hide from a deny-list sweep in the owner's Mine view;
  // everyone else keeps seeing a plain 404 either way.
  await redis.hset(communityDesignKey(id), { hiddenReason: 'reports' });
  // The hide must outlive this design id. Deleting the design (or the whole
  // account) purges the card hash and the reports, and a re-publish of the
  // same payload would otherwise mint a fresh live design with zero reports.
  await recordModerationTombstone(redis, id);
  logger.warn('Community design auto-hidden by reports', { id });
  return true;
}

async function handleReportAction(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  body: Record<string, unknown>
) {
  const session = await requireSession(req, res);
  if (!session) return;

  const rateLimit = await checkRateLimit(session.userId, 'community.report');
  if (!rateLimit.allowed) return rateLimited(res, rateLimit.retryAfterSeconds);

  const parsed = parseReportBody(body);
  if (!parsed.ok) {
    return sendError(res, parsed.status, parsed.code, parsed.message);
  }
  const { reason: reportReason, note: reportNote } = parsed;

  const redis = getRedis();
  if (!redis) return serviceUnavailable(res);

  // A3: a deny-listed account keeps no like/report powers, matching publish/PUT.
  if ((await redis.sismember(communityDenylistKey(), session.userId)) === 1) {
    return sendError(
      res,
      403,
      ErrorCode.UNAUTHORIZED,
      'This action is not available for this account.'
    );
  }

  if (!(await requireLiveDesign(redis, id))) return designNotFound(res);

  // Both sides of the report written together: the reverse index is what the
  // account-deletion cascade walks to find this user's entries (redisKeys.ts).
  const pipeline = redis.pipeline();
  pipeline.sadd(communityReportsKey(id), session.userId);
  pipeline.sadd(communityReportedKey(session.userId), id);
  const results = await pipeline.exec();
  if (results === null) {
    throw new Error('Community report pipeline failed: redis connection lost');
  }
  for (const [pipelineError] of results) {
    if (pipelineError) throw pipelineError;
  }

  const [, added] = results[0] as [Error | null, number];
  let autoHidden = false;

  // Only re-evaluate the threshold on a genuinely new report: a repeat report
  // from the same account (SADD returns 0) cannot push the count further and
  // would just redo the purge work.
  if (added === 1) {
    // Tallied only for genuinely new reporters, mirroring the dedupe above,
    // so one account cannot skew the owner-facing dominant reason.
    await redis.hincrby(communityReportReasonKey(id), reportReason, 1);
    const distinctReporters = await redis.scard(communityReportsKey(id));
    logger.warn('Community design reported', {
      id,
      reason: reportReason,
      note: reportNote,
      reportCount: distinctReporters,
    });
    if (distinctReporters >= REPORT_THRESHOLD) {
      autoHidden = await autoHideCommunityDesign(redis, id);
    }
  }

  return res.status(200).json({ success: true, autoHidden });
}

async function handleCounterAction(
  req: VercelRequest,
  res: VercelResponse,
  id: string,
  kind: 'open' | 'export',
  body: Record<string, unknown>
) {
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(clientIP, 'community.action');
  if (!rateLimit.allowed) return rateLimited(res, rateLimit.retryAfterSeconds);

  const { clientId } = body;
  if (!isString(clientId) || !COMMUNITY_CLIENT_ID_REGEX.test(clientId)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid clientId');
  }

  const redis = getRedis();
  if (!redis) return serviceUnavailable(res);

  if (!(await requireLiveDesign(redis, id))) return designNotFound(res);

  const bucket = communityDedupeBucket(Date.now());
  const dedupeKey =
    kind === 'open' ? communityOpenedKey(id, bucket) : communityExportedKey(id, bucket);

  let counted = false;
  if ((await redis.scard(dedupeKey)) < COMMUNITY_DEDUPE_MAX_MEMBERS) {
    // The counter only moves when the caller's IP AND the clientId are both
    // new to this window: the clientId is attacker-mintable (any string
    // passing the regex), so on its own the dedupe set is no defense against
    // deliberate inflation. The server-derived hashed-IP member goes first,
    // and the clientId member is only written when the IP is new: writing
    // minted clientIds on every request would let a single IP fill the set to
    // the cardinality ceiling and freeze counting for the whole window.
    // IP-first bounds set growth at two members per distinct IP and bounds
    // inflation at one count per IP per window per design. Distinct member
    // prefixes keep a crafted clientId from colliding with an IP member.
    const ipAdded = await redis.sadd(
      dedupeKey,
      `ip:${createHash('sha256').update(clientIP).digest('hex').slice(0, 16)}`
    );
    if (ipAdded === 1) {
      const pipeline = redis.pipeline();
      pipeline.sadd(dedupeKey, `c:${clientId}`);
      pipeline.expire(dedupeKey, COMMUNITY_DEDUPE_TTL_SECONDS);
      const results = await pipeline.exec();
      if (results === null) {
        throw new Error('Community counter pipeline failed: redis connection lost');
      }
      for (const [pipelineError] of results) {
        if (pipelineError) throw pipelineError;
      }
      const [, clientAdded] = results[0] as [Error | null, number];
      counted = clientAdded === 1;
    }
  }

  if (!counted) {
    // Already counted for this client or IP within the window: no-op, still 200.
    if (kind === 'export') {
      const exports = Number((await redis.hget(communityDesignKey(id), 'exports')) ?? 0);
      return res.status(200).json({ success: true, exports });
    }
    return res.status(200).json({ success: true });
  }

  if (kind === 'open') {
    // Owner-only stat (never echoed back): HINCRBY on a never-set field
    // starts from 0, so no card-hash migration is needed.
    await redis.hincrby(communityDesignKey(id), 'opens', 1);
    return res.status(200).json({ success: true });
  }

  // Export credits this design, plus its parent and root when it has lineage:
  // printing a remix is also evidence the design it descends from works. The
  // blob record supplies the lineage (the card hash only carries parentId).
  const exports = await redis.hincrby(communityDesignKey(id), 'exports', 1);
  const record = await readCommunityDesignBlob(id);
  if (record?.lineage) {
    // A Set collapses parentId === rootId (a direct remix of the root) so
    // that case credits once, not twice.
    const creditIds = new Set([record.lineage.parentId, record.lineage.rootId]);
    for (const creditId of creditIds) {
      // EXISTS guard: the parent/root may have since been deleted. HINCRBY on
      // a DEL'd hash would silently recreate a phantom hash carrying only an
      // exports field and none of its card metadata.
      if ((await redis.exists(communityDesignKey(creditId))) === 1) {
        await redis.hincrby(communityDesignKey(creditId), 'exports', 1);
      }
    }
  }
  return res.status(200).json({ success: true, exports });
}
