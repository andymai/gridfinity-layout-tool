import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import { requireMethod } from '../lib/method.js';
import { rateLimited, serviceUnavailable, serverError } from '../lib/shared.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit, getRedis } from '../lib/rateLimit.js';
import { requireSession } from '../lib/session.js';
import { clearSessionCookie } from '../lib/cookies.js';
import { deleteBlob } from '../lib/blobStore.js';
import {
  COMMUNITY_INDEX_SORTS,
  communityAuthorKey,
  communityChildrenKey,
  communityDesignKey,
  communityIndexKey,
  communityLikedKey,
  communityLikesKey,
  communityPrintedKey,
  communityPrintReportedKey,
  communityPrintReportsKey,
  communityPublishedKey,
  communityReportedKey,
  communityReportReasonKey,
  communityReportsKey,
  sessionKey,
  userIndexKey,
  userIndexUpdatedAtKey,
  userProfileKey,
  userSessionsKey,
  userTombstoneSweptAtKey,
} from '../lib/redisKeys.js';
import {
  adjustRemixCredit,
  communityDesignBlobPath,
  readCommunityDesignBlob,
  type CommunityDesignRecord,
} from '../lib/communityStore.js';
import {
  clearCommunityCoverIfFromPhotos,
  deleteCommunityPrint,
  readCommunityPrint,
  syncCommunityPrintCount,
} from '../lib/communityPrintStore.js';
import { deriveAuthorPublicId } from '../lib/communityIds.js';

/**
 * DELETE /api/sync/account
 *
 * Hard-delete the signed-in user's account. The cascade order matters:
 *
 *   1. Sessions   : DEL session:{token} for every token in the user's set
 *                   (so other tabs/devices flip to anonymous on next sync)
 *   2. Blobs      : del() each layouts/{id}.json, designs/{id}.json, baseplates/{id}.json
 *   3. Community  : delete each published design (record/thumbnail/mesh blobs,
 *                   card hash, per-design sets, membership in the parent's
 *                   children set, every liker's reverse liked set, sort-index
 *                   memberships), un-like everything
 *                   in the reverse liked set, un-report everything in the
 *                   reverse reported set
 *   4. KV keys    : drop indexes, profile, sessions set, indexUpdatedAt,
 *                   tombstoneSweptAt, liked/published/reported sets, author set
 *   5. Cookie     : clear the session cookie on the responding device
 *
 * Deny-list membership survives deletion on purpose: the userId is a
 * deterministic hash of the OAuth identity, so deleting the account and
 * signing back in would otherwise reset a publishing ban. The set stores
 * only that pseudonymous hash.
 *
 * Idempotent on partial-failure replay: each step uses unconditional DEL,
 * so repeating after a timeout/cold-start just no-ops on already-cleared
 * keys. The blob loop catches per-blob errors and continues, so a stuck
 * blob won't block the rest of the cascade.
 *
 * Vercel function timeout is 60s. Max 100 layouts + 100 designs +
 * 100 baseplates plus 25 published community designs at up to 5 blobs each
 * (record + 3 thumbnails + mesh) is 425 Blob deletes x ~50ms = ~21s worst
 * case, within budget.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, ['DELETE'])) return;

  // CSRF defense is enforced inside `requireSession` (see api/lib/session.ts).
  const session = await requireSession(req, res);
  if (!session) return;

  const rate = await checkRateLimit(session.userId, 'sync.write');
  if (!rate.allowed) {
    rateLimited(res, rate.retryAfterSeconds);
    return;
  }

  const redis = getRedis();
  if (!redis) {
    serviceUnavailable(res);
    return;
  }

  const { userId } = session;
  try {
    // 1. Cascade-delete every active session for this user.
    const tokens = await redis.smembers(userSessionsKey(userId));
    if (tokens.length > 0) {
      await redis.del(...tokens.map((t) => sessionKey(t)));
    }

    // 2. Delete every blob this user owns. Errors per-blob are logged but
    //    don't block the cascade: leftover blobs are storage cost only,
    //    not a correctness issue, and re-issuing the request will retry.
    const layoutIds = await redis.hkeys(userIndexKey(userId, 'layouts'));
    const designIds = await redis.hkeys(userIndexKey(userId, 'designs'));
    const baseplateIds = await redis.hkeys(userIndexKey(userId, 'baseplates'));

    await Promise.all([
      ...layoutIds.map((id) => deleteBlobSafe(`users/${userId}/layouts/${id}.json`, userId)),
      ...designIds.map((id) => deleteBlobSafe(`users/${userId}/designs/${id}.json`, userId)),
      ...baseplateIds.map((id) => deleteBlobSafe(`users/${userId}/baseplates/${id}.json`, userId)),
    ]);

    // 3. Community cascade. The record blob is read first because it is the
    //    only place the revision-stamped thumbnail/mesh blob URLs live; a
    //    failed read only costs that design's asset deletes, not the cascade.
    const publishedIds = await redis.smembers(communityPublishedKey(userId));
    const records = await Promise.all(
      publishedIds.map((id) => readCommunityDesignSafe(id, userId))
    );

    await Promise.all(
      publishedIds.flatMap((id, i) => {
        const record = records[i];
        const assetUrls = record ? [...record.thumbnails, record.meshUrl] : [];
        return [
          deleteBlobSafe(communityDesignBlobPath(id), userId),
          ...assetUrls.map((url) => deleteBlobSafe(url, userId)),
        ];
      })
    );

    if (publishedIds.length > 0) {
      // Mirrors the single-design DELETE handler: each liker's reverse liked
      // set must drop these ids before the likes sets are deleted, or other
      // users keep phantom hearts pointing at dead designs forever.
      const likerSets = await Promise.all(
        publishedIds.map((id) => redis.smembers(communityLikesKey(id)))
      );
      await Promise.all(
        publishedIds.flatMap((id, i) =>
          likerSets[i].map((liker) => redis.srem(communityLikedKey(liker), id))
        )
      );
      await Promise.all(
        COMMUNITY_INDEX_SORTS.map((sort) => redis.zrem(communityIndexKey(sort), ...publishedIds))
      );
      // A remix must also leave its parent's children set, mirroring the
      // single-design DELETE handler; otherwise a live parent keeps a
      // dangling child id forever.
      await Promise.all(
        publishedIds.flatMap((id, i) => {
          const parentId = records[i]?.lineage?.parentId;
          return parentId === undefined ? [] : [redis.srem(communityChildrenKey(parentId), id)];
        })
      );
      // A1: deleting a remix returns its credit to the parent and root,
      // matching the single-design DELETE handler.
      await Promise.all(
        publishedIds.flatMap((_id, i) => {
          const lineage = records[i]?.lineage;
          return !lineage ? [] : [adjustRemixCredit(redis, lineage.parentId, lineage.rootId, -1)];
        })
      );
      await redis.del(
        ...publishedIds.flatMap((id) => [
          communityDesignKey(id),
          communityLikesKey(id),
          communityChildrenKey(id),
          communityReportsKey(id),
          communityReportReasonKey(id),
        ])
      );
    }

    const likedIds = await redis.smembers(communityLikedKey(userId));
    for (const likedId of likedIds) {
      const removed = await redis.srem(communityLikesKey(likedId), userId);
      // The SREM result gates the decrement so a replayed cascade can't
      // double-decrement a surviving design's like count.
      if (removed > 0 && (await redis.hexists(communityDesignKey(likedId), 'likes')) === 1) {
        // A13: clamp at zero and rescore the likes index, matching the Lua
        // toggle. Only a still-live design is rescored (a plain ZADD would
        // resurrect a hidden/removed design into the likes sort).
        let likes = await redis.hincrby(communityDesignKey(likedId), 'likes', -1);
        if (likes < 0) {
          await redis.hset(communityDesignKey(likedId), { likes: '0' });
          likes = 0;
        }
        if ((await redis.hget(communityDesignKey(likedId), 'status')) === 'live') {
          await redis.zadd(communityIndexKey('likes'), likes, likedId);
        }
      }
    }

    const reportedIds = await redis.smembers(communityReportedKey(userId));
    for (const reportedId of reportedIds) {
      await redis.srem(communityReportsKey(reportedId), userId);
    }

    // The author set falls back to the publicId stored on a published record
    // so the print keys and the author key still resolve if TOKEN_SALT was
    // rotated out since publish.
    const authorPublicId =
      deriveAuthorPublicId(userId) ??
      records.find((record) => record !== null)?.authorPublicId ??
      null;

    // 3b. Community prints. A print report carries the user's display name and
    //     their uploaded photos and is served publicly for any still-live
    //     design, so a deletion request that skipped it would leave the most
    //     personally-identifiable content of all in place. The two reverse
    //     indexes exist for exactly this cascade (see redisKeys.ts).
    if (authorPublicId !== null) {
      await purgeCommunityPrints(redis, userId, authorPublicId);
    }

    const printReportedIds = await redis.smembers(communityPrintReportedKey(userId));
    for (const printId of printReportedIds) {
      // Members are `${designId}:${authorPublicId}`; the author id is the last
      // segment, and a design id never contains ':'.
      const separator = printId.lastIndexOf(':');
      if (separator <= 0) continue;
      await redis.srem(
        communityPrintReportsKey(printId.slice(0, separator), printId.slice(separator + 1)),
        userId
      );
    }

    // 4. Drop all per-user KV state in one DEL.
    await redis.del(
      userIndexKey(userId, 'layouts'),
      userIndexKey(userId, 'designs'),
      userIndexKey(userId, 'baseplates'),
      userIndexUpdatedAtKey(userId),
      userProfileKey(userId),
      userSessionsKey(userId),
      userTombstoneSweptAtKey(userId),
      communityLikedKey(userId),
      communityPublishedKey(userId),
      communityReportedKey(userId),
      communityPrintedKey(userId),
      communityPrintReportedKey(userId),
      ...(authorPublicId === null ? [] : [communityAuthorKey(authorPublicId)])
    );

    // 5. Clear the session cookie on the device making this request.
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    logger.error('sync/account delete failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    serverError(res);
  }
}

/**
 * Delete every print report this user posted: the record hash, its membership
 * in each design's public ZSET, and the photo blobs.
 *
 * The print's own count is resynced per design so a surviving design does not
 * advertise a printer that no longer exists. Photo deletes are best-effort for
 * the same reason the layout-blob deletes are — a stuck blob must not strand
 * the rest of an account deletion — but they are attempted first so a failure
 * is visible in logs rather than silently skipped.
 */
async function purgeCommunityPrints(
  redis: Redis,
  userId: string,
  authorPublicId: string
): Promise<void> {
  const designIds = await redis.smembers(communityPrintedKey(userId));
  if (designIds.length === 0) return;

  for (const designId of designIds) {
    const print = await readCommunityPrint(redis, designId, authorPublicId).catch(
      (error: unknown) => {
        logger.error('account-delete: community print read failed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    );

    await deleteCommunityPrint(redis, designId, authorPublicId, userId);
    await syncCommunityPrintCount(redis, designId).catch(() => undefined);

    if (print !== null && print.photos.length > 0) {
      // A design's cover can point at one of these photos; clearing it keeps
      // the gallery card from rendering a now-deleted image.
      await clearCommunityCoverIfFromPhotos(redis, designId, print.photos);
      await Promise.all(print.photos.map((url) => deleteBlobSafe(url, userId)));
    }
  }
}

async function readCommunityDesignSafe(
  designId: string,
  userId: string
): Promise<CommunityDesignRecord | null> {
  try {
    return await readCommunityDesignBlob(designId);
  } catch (error) {
    logger.error('account-delete: community record read failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function deleteBlobSafe(path: string, userId: string): Promise<void> {
  try {
    await deleteBlob(path);
  } catch (error) {
    logger.error('account-delete: blob delete failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue: leftover blobs are storage cost, not a correctness issue.
  }
}
