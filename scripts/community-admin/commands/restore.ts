import { isValidShareId } from '../../../api/lib/shared.js';
import {
  clearModerationTombstone,
  readCommunityCards,
  setCommunityDesignStatus,
} from '../../../api/lib/communityStore.js';
import {
  communityDesignKey,
  communityReportReasonKey,
  communityReportsKey,
} from '../../../api/lib/redisKeys.js';
import type { Args } from '../lib/args.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';

export async function restore(args: Args): Promise<number> {
  const id = args.positional[0];
  if (!id) {
    console.error('restore <id> is required');
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
    await setCommunityDesignStatus(redis, id, 'live');
    // A stale reason would mislabel the owner badge if the design is later
    // hidden again through a path that does not write its own reason.
    await redis.hdel(communityDesignKey(id), 'hiddenReason');
    // A5: clear the reports set and the reason tallies too. Without this, the
    // reports that crossed the auto-hide threshold survive the restore and a
    // single fresh report instantly re-hides the just-restored design.
    await redis.del(communityReportsKey(id), communityReportReasonKey(id));
    // Same reasoning as the reports: a restore is a judgement that the content
    // is acceptable, so the content tombstone has to go too. Leaving it would
    // restore the design while still barring the author from re-publishing it.
    await clearModerationTombstone(redis, id);
    console.log(colors.cyan(`restored to live: ${id} (was ${card.status})`));
    return 0;
  } finally {
    await redis.quit();
  }
}
