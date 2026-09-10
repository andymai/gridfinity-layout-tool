/** PUT and DELETE on a community design: revise the published record and its assets, or remove them. */
import { del, put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import {
  cardFromRecord,
  DUPLICATE_DESIGN_RESPONSE,
  REMIX_UNCHANGED_RESPONSE,
} from './communityRecord.js';
import {
  communityAuthorKey,
  communityChildrenKey,
  communityDenylistKey,
  communityDesignKey,
  communityLikedKey,
  communityLikesKey,
  communityParamsHashKey,
  communityPublishedKey,
  communityReportReasonKey,
  communityReportedKey,
  communityReportsKey,
} from './redisKeys.js';
import { checkRateLimit, getClientIP, getRedis } from './rateLimit.js';
import { requireSession } from './session.js';
import { logger } from './logger.js';
import {
  ErrorCode,
  rateLimited,
  sendError,
  serviceUnavailable,
  timingSafeCompare,
} from './shared.js';
import {
  adjustRemixCredit,
  communityContentHash,
  communityMeshBlobPath,
  communityDesignContent,
  communityParamsFingerprint,
  communityThumbBlobPath,
  deleteCommunityDesignBlob,
  deriveAssemblyMetrics,
  deriveCommunityMetrics,
  readCommunityDesignBlob,
  removeFromCommunityIndexes,
  writeCommunityCard,
  writeCommunityDesignBlob,
} from './communityStore.js';
import type { CommunityDesignRecord } from './communityStore.js';
import { validateCommunityPublish } from './communityValidation.js';
import { COMMUNITY_EXAMPLE_PARAM_HASHES } from './communityExampleParamHashes.js';
import { designNotFound, readModerationStatus } from './communityDesignShared.js';

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

export async function handlePut(req: VercelRequest, res: VercelResponse, id: string) {
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

export async function handleDelete(req: VercelRequest, res: VercelResponse, id: string) {
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
