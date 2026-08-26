import { createHash } from 'node:crypto';
import { del, put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { readSessionCookie } from '../lib/cookies.js';
import {
  cardFromRecord,
  DUPLICATE_DESIGN_RESPONSE,
  REMIX_UNCHANGED_RESPONSE,
} from '../lib/communityRecord.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityExportedKey,
  communityLikedKey,
  communityLikesKey,
  communityOpenedKey,
  communityParamsHashKey,
  communityPublishedKey,
  communityReportReasonKey,
  communityReportedKey,
  communityReportsKey,
  communityPrintsKey,
  communityViewedKey,
} from '../lib/redisKeys.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { readSession, requireSession } from '../lib/session.js';
import type { SessionRecord } from '../lib/session.js';
import { logger } from '../lib/logger.js';
import { REPORT_THRESHOLD } from '../lib/contentFilter.js';
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
  adjustRemixCredit,
  communityContentHash,
  communityDedupeBucket,
  communityMeshBlobPath,
  communityDesignContent,
  communityParamsFingerprint,
  communityThumbBlobPath,
  deleteCommunityDesignBlob,
  deriveAssemblyMetrics,
  deriveCommunityMetrics,
  readCommunityDesignBlob,
  recordModerationTombstone,
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
  COMMUNITY_REPORT_REASONS,
  parseReportBody,
  validateCommunityPublish,
} from '../lib/communityValidation.js';
import { readCommunityPrints } from '../lib/communityPrintStore.js';
import { communityPrintsEnabled } from '../lib/communityPrintValidation.js';
import { COMMUNITY_EXAMPLE_PARAM_HASHES } from '../lib/communityExampleParamHashes.js';
import type { CommunityReportReason } from '../lib/communityValidation.js';
import { isObject, isString } from '../lib/validationUtils.js';
import { resolveSupporterAuthors } from '../lib/supporterLink.js';

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

/**
 * B3 exact-duplicate guard for updates. True when the edited params match a
 * built-in example or another author's live design. The design being edited is
 * excluded (its own params-hash index entry points back at itself).
 */
async function isDuplicateOnUpdate(
  redis: Redis,
  contentFingerprint: string,
  authorPublicId: string,
  selfId: string
): Promise<boolean> {
  if (COMMUNITY_EXAMPLE_PARAM_HASHES.has(contentFingerprint)) return true;
  const candidateId = await redis.get(communityParamsHashKey(contentFingerprint));
  if (candidateId === null || candidateId === '' || candidateId === selfId) return false;
  const [status, candidateAuthor] = await redis.hmget(
    communityDesignKey(candidateId),
    'status',
    'authorPublicId'
  );
  return status === 'live' && candidateAuthor !== null && candidateAuthor !== authorPublicId;
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

    // A design's kind is fixed at publish: the update payload must stay the
    // same shape as the stored record, or the content fields below would mix.
    if ((existing.kind === 'assembly') !== (payload.kind === 'assembly')) {
      sendError(res, 400, ErrorCode.VALIDATION_ERROR, 'design kind cannot change on update');
      return;
    }
    const contentFingerprint = communityParamsFingerprint(communityDesignContent(payload));
    const previousFingerprint = communityParamsFingerprint(communityDesignContent(existing));

    // B3: reject an edit into a verbatim built-in example or another author's
    // live design.
    if (await isDuplicateOnUpdate(redis, contentFingerprint, existing.authorPublicId, id)) {
      return res.status(409).json(DUPLICATE_DESIGN_RESPONSE);
    }

    // B4: a remix must still differ from its parent after an edit.
    if (existing.lineage !== null) {
      const parent = await readCommunityDesignBlob(existing.lineage.parentId);
      if (
        parent !== null &&
        communityParamsFingerprint(communityDesignContent(parent)) === contentFingerprint
      ) {
        return res.status(409).json(REMIX_UNCHANGED_RESPONSE);
      }
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
      ...(payload.kind === 'assembly'
        ? { kind: 'assembly' as const, envelope: payload.envelope, structure: payload.structure }
        : { params: payload.params }),
      metrics:
        payload.kind === 'assembly'
          ? deriveAssemblyMetrics(payload.envelope ?? {}, payload.heightUnits ?? 1)
          : deriveCommunityMetrics(payload.params ?? {}),
      thumbnails: thumbnailUrls,
      meshUrl: mesh.url,
      updatedAt: Date.now(),
    };

    await writeCommunityDesignBlob(updated, { allowOverwrite: true });

    // A4: re-read moderation status immediately before writing the card. A hide
    // (setCommunityDesignStatus) landing during the asset upload above must not
    // be flipped back to live by this in-flight edit; the card carries the
    // current status, never the publish-time one.
    const statusAtWrite = await readModerationStatus(id, existing.status);
    await writeCommunityCard(redis, cardFromRecord({ ...updated, status: statusAtWrite }));

    // Publish idempotency keys on this hash; without the refresh a retried
    // POST of the pre-edit content would 200 against this id and a POST of
    // the edited content would mint a duplicate design. Includes authorName +
    // lineage (A8) so it matches the publish-side hash.
    await redis.hset(communityDesignKey(id), {
      contentHash: communityContentHash({
        content: communityDesignContent(payload),
        name: payload.name,
        description: payload.description,
        category: payload.category,
        authorName: payload.authorName,
        lineage: existing.lineage,
      }),
    });

    // Keep the exact-duplicate index pointing at the edited params. Only a
    // still-live design is indexed (A4: never re-index a non-live design), and
    // a changed fingerprint drops the stale entry. Best-effort bookkeeping.
    if (statusAtWrite === 'live' && contentFingerprint !== previousFingerprint) {
      await redis.set(communityParamsHashKey(contentFingerprint), id).catch(() => undefined);
      await redis.del(communityParamsHashKey(previousFingerprint)).catch(() => undefined);
    }

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
      // A2: the owner cannot unpublish a design that moderation has hidden or
      // removed. Deleting it would clear the reports/record and let a clean
      // re-publish escape the moderation state. The card hash is the
      // moderation truth (record.status is the publish-time blob status). The
      // admin-token path (ownerUserId === null) still purges.
      const moderationStatus = await redis.hget(communityDesignKey(id), 'status');
      if (moderationStatus === 'hidden' || moderationStatus === 'removed') {
        // 409 (state conflict) so the client routes this through the coded
        // conflict channel and shows the localized under-review message,
        // rather than the generic neutral 403 used for deny-list rejections.
        return res.status(409).json({
          error: 'This design is under moderation review and cannot be unpublished.',
          code: 'UNDER_REVIEW',
        });
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
    // A15: before deleting the reports set, drop this id from each reporter's
    // reverse "reported" set, or those sets leak dead ids the account-deletion
    // cascade would later walk.
    const reporters = await redis.smembers(communityReportsKey(id));
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
    for (const reporter of reporters) {
      pipeline.srem(communityReportedKey(reporter), id);
    }
    const results = await pipeline.exec();
    if (results === null) {
      throw new Error('Community delete pipeline failed: redis connection lost');
    }
    for (const [pipelineError] of results) {
      if (pipelineError) throw pipelineError;
    }

    // A1: a deleted remix returns its credit to the parent and root. The blob
    // carries the rootId; a card-hash-only retry only knows the parent, which
    // adjustRemixCredit credits once. Best-effort: the design is already gone.
    if (parentId !== undefined) {
      const rootId = record?.lineage?.rootId ?? parentId;
      await adjustRemixCredit(redis, parentId, rootId, -1).catch((remixErr: unknown) => {
        logger.warn('Community delete: remix credit decrement failed', {
          id,
          error: remixErr instanceof Error ? remixErr.message : String(remixErr),
        });
      });
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
    // Optional-chained: a record that reached here without going through
    // parsePrint has no normalised array, and a missing browsing copy must
    // cost the optimisation, not 500 the promote.
    coverPhotoThumbUrl = owner.photoThumbs?.[owner.photos.indexOf(photoUrl)] ?? '';
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
