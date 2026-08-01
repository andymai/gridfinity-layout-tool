import { isValidShareId } from '../../../api/lib/shared.js';
import { readCommunityCards, setCommunityDesignStatus } from '../../../api/lib/communityStore.js';
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
    console.log(colors.cyan(`restored to live: ${id} (was ${card.status})`));
    return 0;
  } finally {
    await redis.quit();
  }
}
