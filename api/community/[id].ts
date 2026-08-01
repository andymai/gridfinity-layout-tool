import { del, put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSessionCookie } from '../lib/cookies.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityLikedKey,
  communityLikesKey,
  communityPublishedKey,
  communityReportsKey,
} from '../lib/redisKeys.js';
import { checkRateLimit, getClientIP, getRedis } from '../lib/rateLimit.js';
import { readSession, requireSession } from '../lib/session.js';
import type { SessionRecord } from '../lib/session.js';
import { logger } from '../lib/logger.js';
import {
  ErrorCode,
  methodNotAllowed,
  rateLimited,
  serviceUnavailable,
  timingSafeCompare,
} from '../lib/shared.js';
import {
  communityContentHash,
  communityMeshBlobPath,
  communityThumbBlobPath,
  deleteCommunityDesignBlob,
  deriveCommunityMetrics,
  readCommunityDesignBlob,
  removeFromCommunityIndexes,
  writeCommunityCard,
  writeCommunityDesignBlob,
} from '../lib/communityStore.js';
import type { CommunityDesignRecord, CommunityDesignStatus } from '../lib/communityStore.js';
import { validateCommunityPublish } from '../lib/communityValidation.js';

const COMMUNITY_DESIGN_ID_REGEX = /^[a-zA-Z0-9]{12}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (typeof id !== 'string' || !COMMUNITY_DESIGN_ID_REGEX.test(id)) {
    return res.status(400).json({
      error: 'Invalid design ID',
      code: ErrorCode.VALIDATION_ERROR,
    });
  }

  switch (req.method) {
    case 'OPTIONS':
      return res.status(200).end();
    case 'GET':
      return handleGet(req, res, id);
    case 'PUT':
      return handlePut(req, res, id);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      return methodNotAllowed(res, 'GET, PUT, DELETE');
  }
}

function designNotFound(res: VercelResponse) {
  return res.status(404).json({
    error: 'Design not found',
    code: ErrorCode.NOT_FOUND,
  });
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
 * hash is therefore the source of truth for every moderation gate, with the
 * blob's own status as the fallback when the hash is unreadable.
 */
async function readModerationStatus(
  id: string,
  fallback: CommunityDesignStatus
): Promise<CommunityDesignStatus> {
  const redis = getRedis();
  if (!redis) return fallback;
  const status = await redis.hget(communityDesignKey(id), 'status');
  return status === 'live' || status === 'hidden' || status === 'removed' ? status : fallback;
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
    if (status !== 'live') {
      // Hidden/removed designs must be indistinguishable from missing ones
      // for everyone but their owner, so a takedown can't be probed.
      const session = await readOptionalSession(req);
      const owns = session !== null && (await isPublishedBy(session.userId, id));
      if (!owns) {
        return designNotFound(res);
      }
    }

    return res.status(200).json({ design: { ...record, status } });
  } catch (error) {
    logger.error('Community design fetch error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      error: 'Failed to fetch design',
      code: ErrorCode.SERVER_ERROR,
    });
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
      return res.status(403).json({
        error: 'Publishing is not available for this account.',
        code: ErrorCode.UNAUTHORIZED,
      });
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
      return res.status(403).json({
        error: 'This design cannot be updated.',
        code: ErrorCode.UNAUTHORIZED,
      });
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
    return res.status(500).json({
      error: 'Failed to update design',
      code: ErrorCode.SERVER_ERROR,
    });
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
        return res.status(401).json({
          error: 'Invalid admin token',
          code: ErrorCode.UNAUTHORIZED,
        });
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
    const parentId = record?.lineage?.parentId;

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
    return res.status(500).json({
      error: 'Failed to delete design',
      code: ErrorCode.SERVER_ERROR,
    });
  }
}
