import { communityDenylistKey } from '../../../api/lib/redisKeys.js';
import type { Args } from '../lib/args.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';

export async function undenylist(args: Args): Promise<number> {
  const userId = args.positional[0];
  if (!userId) {
    console.error('undenylist <userId> is required');
    return 2;
  }

  const redis = connect();
  try {
    const removed = await redis.srem(communityDenylistKey(), userId);
    if (removed === 0) {
      console.log(colors.dim(`${userId} was not on the deny-list`));
      return 0;
    }
    console.log(colors.cyan(`removed from deny-list: ${userId}`));
    console.log(
      colors.dim(
        'their previously hidden designs are not auto-restored; use `restore <id>` per design'
      )
    );
    return 0;
  } finally {
    await redis.quit();
  }
}
