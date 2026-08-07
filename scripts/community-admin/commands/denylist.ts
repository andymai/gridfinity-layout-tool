import { deriveAuthorPublicId } from '../../../api/lib/communityIds.js';
import {
  readCommunityCards,
  recordModerationTombstone,
  setCommunityDesignStatus,
} from '../../../api/lib/communityStore.js';
import {
  communityAuthorKey,
  communityDenylistKey,
  communityDesignKey,
} from '../../../api/lib/redisKeys.js';
import type { Args } from '../lib/args.js';
import { purgeCommunityAssets } from '../lib/assets.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';

export async function denylist(args: Args): Promise<number> {
  const userId = args.positional[0];
  if (!userId) {
    console.error('denylist <userId> is required');
    return 2;
  }

  // TOKEN_SALT is required at CLI startup, so this only returns null if the
  // env var was cleared mid-run.
  const authorPublicId = deriveAuthorPublicId(userId);
  if (!authorPublicId) {
    console.error('TOKEN_SALT is not set; cannot derive the author public id');
    return 2;
  }

  const redis = connect();
  try {
    await redis.sadd(communityDenylistKey(), userId);

    const designIds = await redis.smembers(communityAuthorKey(authorPublicId));
    const cards = await readCommunityCards(redis, designIds);
    const liveIds: string[] = [];
    for (const card of cards) {
      if (card && card.status === 'live') liveIds.push(card.id);
    }
    // hiddenReason drives the owner's Mine badge: a deny-list hide must read
    // differently from a report auto-hide (community-showcase-plan.md §2.6).
    // A10: the deny-list sweep is a takedown, so it also deletes each hidden
    // design's CDN assets (fail loud).
    await Promise.all(
      liveIds.map(async (id) => {
        await setCommunityDesignStatus(redis, id, 'hidden');
        await redis.hset(communityDesignKey(id), { hiddenReason: 'denylist' });
        await recordModerationTombstone(redis, id);
        await purgeCommunityAssets(id);
      })
    );

    console.log(colors.cyan(`denylisted: ${userId}`));
    console.log(`hid ${liveIds.length} live design(s): ${liveIds.join(', ') || '(none)'}`);
    return 0;
  } finally {
    await redis.quit();
  }
}
