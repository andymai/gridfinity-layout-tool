import { isValidShareId } from '../../../api/lib/shared.js';
import { deleteBlob } from '../../../api/lib/blobStore.js';
import { readCommunityCards, readCommunityDesignBlob } from '../../../api/lib/communityStore.js';
import { communityLikedKey } from '../../../api/lib/redisKeys.js';
import { logger } from '../../../api/lib/logger.js';
import type { Args } from '../lib/args.js';
import { colors } from '../lib/output.js';
import { planPurgeCleanup } from '../lib/purgePlan.js';
import { connect } from '../lib/redis.js';

export async function purge(args: Args): Promise<number> {
  const id = args.positional[0];
  if (!id) {
    console.error('purge <id> is required');
    return 2;
  }
  if (!isValidShareId(id)) {
    console.error(`not a valid community design id: ${id}`);
    return 2;
  }
  if (!args.yes) {
    console.error('purge is irreversible; re-run with --yes to confirm');
    return 2;
  }

  const redis = connect();
  try {
    const [record, cards] = await Promise.all([
      readCommunityDesignBlob(id),
      readCommunityCards(redis, [id]),
    ]);
    const card = cards[0] ?? null;
    if (!record && !card) {
      console.error(`community design not found: ${id}`);
      return 1;
    }

    const plan = planPurgeCleanup(id, record, card);

    // The takedown deletes every asset blob AND still completes the redis
    // cleanup below so the design leaves the gallery even if a blob delete
    // fails. But a failed delete FAILS LOUD (non-zero exit) instead of a silent
    // success, so the operator knows a world-readable blob may still be live.
    let blobDeleteFailed = false;
    for (const path of plan.blobPaths) {
      try {
        await deleteBlob(path);
      } catch (error) {
        blobDeleteFailed = true;
        logger.error('community-admin purge: blob delete failed', {
          id,
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // The cascade to each liker's reverse index needs the live membership of
    // plan.likesKey, so it can't be part of the static plan (see purgePlan.ts).
    const likerIds = await redis.smembers(plan.likesKey);

    const pipeline = redis.pipeline();
    pipeline.del(plan.hashKey);
    for (const key of plan.indexKeys) pipeline.zrem(key, id);
    if (plan.authorKey) pipeline.srem(plan.authorKey, id);
    if (plan.parentChildKey) pipeline.srem(plan.parentChildKey, id);
    pipeline.del(plan.reportsKey);
    pipeline.del(plan.reportReasonKey);
    pipeline.del(plan.likesKey);
    pipeline.del(plan.childrenKey);
    for (const userId of likerIds) pipeline.srem(communityLikedKey(userId), id);
    const results = await pipeline.exec();
    if (results === null) {
      throw new Error('purge pipeline failed: redis connection lost');
    }
    for (const [error] of results) {
      if (error) throw new Error(`purge pipeline failed: ${error.message}`);
    }

    console.log(colors.cyan(`purged: ${id}`));
    if (!plan.authorKey) {
      console.log(
        colors.yellow('  author unresolved: community:author:{publicId} was not cleaned')
      );
    }
    console.log(
      colors.dim(
        '  community:published:{userId} cannot be cleaned from a design id alone (authorPublicId is a one-way hash); the author keeps a phantom quota slot until the record is resolved out of band'
      )
    );
    if (blobDeleteFailed) {
      console.error(
        colors.yellow(
          '  one or more asset blobs failed to delete; a world-readable blob may still be live. Check the logs and delete it out of band.'
        )
      );
      return 1;
    }
    return 0;
  } finally {
    await redis.quit();
  }
}
