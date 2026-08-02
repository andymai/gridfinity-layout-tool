import { isValidShareId } from '../../../api/lib/shared.js';
import { readCommunityCards, setCommunityDesignStatus } from '../../../api/lib/communityStore.js';
import { communityDesignKey } from '../../../api/lib/redisKeys.js';
import type { Args } from '../lib/args.js';
import { purgeCommunityAssets } from '../lib/assets.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';

export async function hide(args: Args): Promise<number> {
  const id = args.positional[0];
  if (!id) {
    console.error('hide <id> is required');
    return 2;
  }
  if (!isValidShareId(id)) {
    console.error(`not a valid community design id: ${id}`);
    return 2;
  }

  const redis = connect();
  try {
    const [card] = await readCommunityCards(redis, [id]);
    if (!card) {
      console.error(`community design not found: ${id}`);
      return 1;
    }
    await setCommunityDesignStatus(redis, id, 'hidden');
    // hiddenReason drives the owner's Mine badge: a manual moderation hide
    // must not read as a pending report auto-hide (the reason-less default),
    // which promises a moderator review that already happened.
    await redis.hset(communityDesignKey(id), { hiddenReason: 'moderation' });
    // A10: this is the takedown path, so it deletes the CDN assets (fail loud).
    // Status is flipped first, so a retry after a delete error re-runs cleanly.
    await purgeCommunityAssets(id);
    console.log(colors.cyan(`hidden: ${id} (was ${card.status})`));
    return 0;
  } finally {
    await redis.quit();
  }
}
