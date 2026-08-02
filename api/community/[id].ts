import { createHash } from 'node:crypto';
import { del, put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { readSessionCookie } from '../lib/cookies.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityExportedKey,
  communityLikedKey,
  communityLikesKey,
  communityOpenedKey,
  communityPublishedKey,
  communityReportReasonKey,
  communityReportedKey,
  communityReportsKey,
  communityViewedKey,
} from '../lib/redisKeys.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { readSession, requireSession } from '../lib/session.js';
import type { SessionRecord } from '../lib/session.js';
import { logger } from '../lib/logger.js';
import { checkText, REPORT_THRESHOLD } from '../lib/contentFilter.js';
import {
  ErrorCode,
  methodNotAllowed,
  rateLimited,
  sendError,
  serviceUnavailable,
  timingSafeCompare,
} from '../lib/shared.js';
import {
  COMMUNITY_DEDUPE_TTL_SECONDS,
  communityContentHash,
  communityDedupeBucket,
  communityMeshBlobPath,
  communityThumbBlobPath,
  deleteCommunityDesignBlob,
  deriveCommunityMetrics,
  readCommunityDesignBlob,
  removeFromCommunityIndexes,
  setCommunityDesignStatus,
  toggleCommunityLike,
  writeCommunityCard,
  writeCommunityDesignBlob,
} from '../lib/communityStore.js';
import type {
  CommunityDesignRecord,
  CommunityDesignStatus,
  CommunityHiddenReason,
} from '../lib/communityStore.js';
import {
  COMMUNITY_REPORT_NOTE_MAX_LENGTH,
  COMMUNITY_REPORT_REASONS,
  validateCommunityPublish,
} from '../lib/communityValidation.js';
import type { CommunityReportReason } from '../lib/communityValidation.js';
import { isObject, isString } from '../lib/validationUtils.js';

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

function designNotFound(res: VercelResponse) {
  return sendError(res, 404, ErrorCode.NOT_FOUND, 'Design not found');
}

/**
 * Resolve the caller's session without sending any response. GET is a public
 * surface: an absent, expired, or unreadable session must degrade to the
 * anonymous view, never 401.
 */
async function readOptionalSession(req: VercelRequest): Promise<SessionRecord | null> {
  const token = readSessionCookie(req);
  if (!token) return null;
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await readSession(redis, token);
  } catch {
    return null;
  }
}

/**
 * Ownership is always the server-side published set keyed by the session's
 * userId. A client-sent publishedId is never consulted.
 */
async function isPublishedBy(userId: string, designId: string): Promise<boolean> {
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
async function readModerationStatus(
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
const COMMUNITY_DEDUPE_MAX_MEMBERS = 20_000;

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
    let hiddenReason: CommunityHiddenReason | null = null;
    let hiddenReasonCategory: CommunityReportReason | null = null;
    if (redis) {
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
      if (status === 'live' && !owns) {
        await recordCommunityView(redis, id, clientIP);
      }
    }

    return res.status(200).json({
      design: { ...record, status },
      isOwner: owns,
      counts,
      likedByMe,
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

/**
 * The revision lives only in the asset paths, so the next revision is parsed
 * back out of the stored mesh URL. An unparseable legacy URL falls back to a
 * timestamp, which still yields a fresh immutably-cacheable path.
 */
function nextAssetRev(meshUrl: string): number {
  try {
    const match = /-(\d+)\.glb$/.exec(new URL(meshUrl).pathname);
    if (match) return Number(match[1]) + 1;
  } catch {
    // fall through to the timestamp fallback
  }
  return Date.now();
}

async function handlePut(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    if (process.env.COMMUNITY_PUBLISH_ENABLED !== 'true') {
      return serviceUnavailable(res, 'Community publishing is not available.');
    }

    const session = await requireSession(req, res);
    if (!session) return;

    const rateLimit = await checkRateLimit(session.userId, 'community.manage');
    if (!rateLimit.allowed) {
      return rateLimited(res, rateLimit.retryAfterSeconds, 'Too many updates. Try again later.');
    }

    const redis = getRedis();
    if (!redis) {
      return serviceUnavailable(res);
    }

    const denied = await redis.sismember(communityDenylistKey(), session.userId);
    if (denied === 1) {
      // Deliberately neutral: the response must not reveal deny-listing.
      return sendError(
        res,
        403,
        ErrorCode.UNAUTHORIZED,
        'Publishing is not available for this account.'
      );
    }

    const owns = (await redis.sismember(communityPublishedKey(session.userId), id)) === 1;
    if (!owns) {
      return designNotFound(res);
    }

    const result = validateCommunityPublish(req.body);
    if (!result.valid) {
      return res.status(400).json({
        error: result.error.message,
        code: result.error.code,
      });
    }
    const payload = result.payload;

    const existing = await readCommunityDesignBlob(id);
    if (!existing) {
      return designNotFound(res);
    }

    // A moderated design must not keep accepting fresh public assets: an
    // update to a hidden/removed design would upload new blobs to the CDN
    // even though the design itself is off the gallery.
    const status = await readModerationStatus(id, existing.status);
    if (status !== 'live') {
      return sendError(res, 403, ErrorCode.UNAUTHORIZED, 'This design cannot be updated.');
    }

    // allowOverwrite because the rev derives from the stored record: a retry
    // after a partial failure recomputes the same rev and must be able to
    // rewrite its own half-written assets.
    const rev = nextAssetRev(existing.meshUrl);
    const thumbnailUrls: string[] = [];
    for (let i = 0; i < payload.thumbnails.length; i++) {
      const thumb = await put(
        communityThumbBlobPath(id, rev, i),
        Buffer.from(payload.thumbnails[i], 'base64'),
        {
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      );
      thumbnailUrls.push(thumb.url);
    }
    const mesh = await put(communityMeshBlobPath(id, rev), Buffer.from(payload.glb, 'base64'), {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // Update in place: id, author identity, lineage, createdAt, featured, and
    // moderation status all survive the rewrite. Status in particular is
    // never client-writable.
    const updated: CommunityDesignRecord = {
      ...existing,
      name: payload.name,
      description: payload.description,
      authorName: payload.authorName,
      category: payload.category,
      techniques: payload.techniques,
      params: payload.params,
      metrics: deriveCommunityMetrics(payload.params),
      thumbnails: thumbnailUrls,
      meshUrl: mesh.url,
      updatedAt: Date.now(),
    };

    await writeCommunityDesignBlob(updated, { allowOverwrite: true });
    await writeCommunityCard(redis, {
      id,
      name: updated.name,
      authorPublicId: updated.authorPublicId,
      authorName: updated.authorName,
      category: updated.category,
      techniques: updated.techniques,
      width: updated.metrics.width,
      depth: updated.metrics.depth,
      height: updated.metrics.height,
      gridUnitMm: updated.metrics.gridUnitMm,
      thumbnailUrl: thumbnailUrls.length > 0 ? thumbnailUrls[0] : '',
      isRemix: updated.lineage !== null,
      parentId: updated.lineage?.parentId ?? '',
      featured: updated.featured,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      status: updated.status,
    });

    // Publish idempotency keys on this hash; without the refresh a retried
    // POST of the pre-edit content would 200 against this id and a POST of
    // the edited content would mint a duplicate design.
    await redis.hset(communityDesignKey(id), {
      contentHash: communityContentHash({
        params: payload.params,
        name: payload.name,
        description: payload.description,
        category: payload.category,
      }),
    });

    // Replaced-asset cleanup is best-effort: the record already points at the
    // new rev, so a failed delete only strands unreferenced blobs.
    const staleAssets = [...existing.thumbnails, existing.meshUrl].filter(
      (url) => url !== '' && url !== updated.meshUrl && !updated.thumbnails.includes(url)
    );
    if (staleAssets.length > 0) {
      await del(staleAssets).catch((delErr: unknown) => {
        logger.warn('Failed to delete replaced community assets', {
          id,
          error: delErr instanceof Error ? delErr.message : String(delErr),
        });
      });
    }

    return res.status(200).json({ design: updated });
  } catch (error) {
    logger.error('Community design update error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to update design');
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string) {
  try {
    const adminHeader = req.headers['x-admin-token'];
    const adminToken = Array.isArray(adminHeader) ? adminHeader[0] : adminHeader;
    const expectedAdminToken = process.env.COMMUNITY_ADMIN_TOKEN;
    const adminPathEnabled = expectedAdminToken !== undefined && expectedAdminToken !== '';

    let ownerUserId: string | null = null;
    if (adminToken !== undefined && adminPathEnabled) {
      const clientIP = getClientIP(req);
      const rateLimit = await checkRateLimit(clientIP, 'community.manage');
      if (!rateLimit.allowed) {
        return rateLimited(res, rateLimit.retryAfterSeconds);
      }
      if (!timingSafeCompare(adminToken, expectedAdminToken)) {
        return sendError(res, 401, ErrorCode.UNAUTHORIZED, 'Invalid admin token');
      }
    } else {
      // With COMMUNITY_ADMIN_TOKEN unset the admin path is disabled outright;
      // a supplied header falls through to owner authorization.
      const session = await requireSession(req, res);
      if (!session) return;
      const rateLimit = await checkRateLimit(session.userId, 'community.manage');
      if (!rateLimit.allowed) {
        return rateLimited(res, rateLimit.retryAfterSeconds);
      }
      ownerUserId = session.userId;
    }

    const redis = getRedis();
    if (!redis) {
      // Cleanup spans blob and Redis; deleting only the blob would strand
      // index entries pointing at a missing record, so fail closed.
      return serviceUnavailable(res);
    }

    const record = await readCommunityDesignBlob(id);
    // A retried delete whose blob removal already succeeded still has Redis
    // state to clean; the card hash stands in for the missing record.
    const cardFields = record ? null : await redis.hgetall(communityDesignKey(id));
    if (!record && (cardFields === null || Object.keys(cardFields).length === 0)) {
      return designNotFound(res);
    }

    if (ownerUserId !== null) {
      const owns = (await redis.sismember(communityPublishedKey(ownerUserId), id)) === 1;
      if (!owns) {
        return designNotFound(res);
      }
    }

    const authorPublicId = record?.authorPublicId ?? cardFields?.authorPublicId ?? '';
    const cardParentId = cardFields?.parentId;
    const parentId =
      record?.lineage?.parentId ??
      (cardParentId !== undefined && cardParentId !== '' ? cardParentId : undefined);

    // Blobs before Redis, assets before the record JSON: any failure leaves
    // enough state (record blob, then card hash) for a retry to find and
    // finish the cleanup instead of stranding public CDN content.
    if (record) {
      const assetUrls = [...record.thumbnails, record.meshUrl].filter((url) => url !== '');
      if (assetUrls.length > 0) {
        await del(assetUrls);
      }
      await deleteCommunityDesignBlob(id);
    }

    const likers = await redis.smembers(communityLikesKey(id));
    await removeFromCommunityIndexes(redis, id);

    const pipeline = redis.pipeline();
    pipeline.del(
      communityDesignKey(id),
      communityLikesKey(id),
      communityReportsKey(id),
      communityReportReasonKey(id),
      communityChildrenKey(id)
    );
    if (authorPublicId !== '') {
      pipeline.srem(communityAuthorKey(authorPublicId), id);
    }
    // Admin purge cannot clear the owner's community:published slot: the
    // record only carries the one-way authorPublicId hash, never the userId.
    // The admin CLI reclaims that slot out of band.
    if (ownerUserId !== null) {
      pipeline.srem(communityPublishedKey(ownerUserId), id);
    }
    // Children keep their lineage snapshots; only the parent's membership
    // link to this design is dropped.
    if (parentId !== undefined) {
      pipeline.srem(communityChildrenKey(parentId), id);
    }
    for (const liker of likers) {
      pipeline.srem(communityLikedKey(liker), id);
    }
    const results = await pipeline.exec();
    if (results === null) {
      throw new Error('Community delete pipeline failed: redis connection lost');
    }
    for (const [pipelineError] of results) {
      if (pipelineError) throw pipelineError;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Community design delete error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return sendError(res, 500, ErrorCode.SERVER_ERROR, 'Failed to delete design');
  }
}

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
async function requireLiveDesign(redis: Redis, id: string): Promise<boolean> {
  const status = await redis.hget(communityDesignKey(id), 'status');
  return status === 'live';
}

const COMMUNITY_CLIENT_ID_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

async function handlePost(req: VercelRequest, res: VercelResponse, id: string) {
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

  if (!(await requireLiveDesign(redis, id))) return designNotFound(res);

  const { likes, likedByMe } = await toggleCommunityLike(redis, session.userId, id, like);
  return res.status(200).json({ likes, likedByMe });
}

/**
 * Flip status to hidden and purge the public asset blobs (thumbnails + GLB)
 * from the CDN. The record blob itself is untouched so the owner still sees
 * the design in the Mine view, but updates are rejected while non-live
 * (handlePut), so fresh assets can only reach the CDN again through a
 * moderation restore. The purge is required because blob access is by
 * unguessable path, not by the
 * already-flipped moderation status: a leaked or search-indexed thumbnail URL
 * must stop resolving the moment a design is auto-hidden, not just stop
 * being served through the API.
 */
async function autoHideCommunityDesign(redis: Redis, id: string): Promise<boolean> {
  const record = await readCommunityDesignBlob(id);
  await setCommunityDesignStatus(redis, id, 'hidden');
  // Distinguishes this hide from a deny-list sweep in the owner's Mine view;
  // everyone else keeps seeing a plain 404 either way.
  await redis.hset(communityDesignKey(id), { hiddenReason: 'reports' });
  if (record) {
    const assetUrls = [...record.thumbnails, record.meshUrl].filter((url) => url !== '');
    if (assetUrls.length > 0) {
      // One inline retry, then a persisted flag: a hidden design stops taking
      // reports (non-live actions 404), so nothing on the moderation path
      // would revisit a failed purge and the leaked/search-indexed asset URLs
      // would stay live on the CDN. The flag is what admin tooling / a sweep
      // keys on to finish the purge.
      let purged = false;
      for (let attempt = 0; attempt < 2 && !purged; attempt++) {
        try {
          await del(assetUrls);
          purged = true;
        } catch (delErr) {
          logger.warn('Failed to purge CDN assets for auto-hidden design', {
            id,
            attempt,
            error: delErr instanceof Error ? delErr.message : String(delErr),
          });
        }
      }
      if (!purged) {
        await redis.hset(communityDesignKey(id), { purgePending: '1' });
      }
    }
  }
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

  const { reason, note } = body;
  if (!isString(reason) || !(COMMUNITY_REPORT_REASONS as readonly string[]).includes(reason)) {
    return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid report reason');
  }
  const reportReason = reason as CommunityReportReason;
  let reportNote = '';
  if (note !== undefined) {
    if (!isString(note)) {
      return sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'note must be a string');
    }
    // The slice bounds the string before the filter's ReDoS-prone regexes run.
    reportNote = note.slice(0, COMMUNITY_REPORT_NOTE_MAX_LENGTH);
    if (reportNote !== '' && !checkText(reportNote).passed) {
      return sendError(res, 400, ErrorCode.CONTENT_BLOCKED, 'note contains prohibited content');
    }
  }

  const redis = getRedis();
  if (!redis) return serviceUnavailable(res);

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
