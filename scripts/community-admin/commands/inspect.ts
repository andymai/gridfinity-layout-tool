import { isValidShareId } from '../../../api/lib/shared.js';
import { readCommunityCards, readCommunityDesignBlob } from '../../../api/lib/communityStore.js';
import { communityReportsKey } from '../../../api/lib/redisKeys.js';
import type { Args } from '../lib/args.js';
import { colors } from '../lib/output.js';
import { connect } from '../lib/redis.js';

export async function inspect(args: Args): Promise<number> {
  const id = args.positional[0];
  if (!id) {
    console.error('inspect <id> is required');
    return 2;
  }
  if (!isValidShareId(id)) {
    console.error(`not a valid community design id: ${id}`);
    return 2;
  }

  const redis = connect();
  try {
    const [record, cards, reporterIds] = await Promise.all([
      readCommunityDesignBlob(id),
      readCommunityCards(redis, [id]),
      redis.smembers(communityReportsKey(id)),
    ]);
    const card = cards[0] ?? null;

    if (!record && !card) {
      console.error(`community design not found: ${id}`);
      return 1;
    }

    if (args.json) {
      process.stdout.write(JSON.stringify({ record, card, reporterIds }, null, 2) + '\n');
      return 0;
    }

    console.log(colors.bold(`=== community design ${id} ===`));
    if (record) {
      console.log(`name:        ${record.name}`);
      console.log(`author:      ${record.authorName} (${record.authorPublicId})`);
      console.log(`category:    ${record.category}`);
      console.log(`techniques:  ${record.techniques.join(', ') || '(none)'}`);
      console.log(`status:      ${record.status}`);
      console.log(`featured:    ${record.featured ? 'yes' : 'no'}`);
      console.log(
        `lineage:     ${record.lineage ? `remix of ${record.lineage.parentId}` : '(original)'}`
      );
      console.log(`created:     ${new Date(record.createdAt).toISOString()}`);
      console.log(`updated:     ${new Date(record.updatedAt).toISOString()}`);
    } else {
      console.log(colors.yellow('design blob missing; showing card metadata only'));
    }
    if (card) {
      console.log(`likes:       ${card.likes}`);
      console.log(`remixes:     ${card.remixes}`);
      console.log(`exports:     ${card.exports}`);
    }
    console.log('');
    console.log(colors.bold(`reports: ${reporterIds.length}`));
    for (const userId of reporterIds) console.log(`  ${userId}`);
    if (reporterIds.length > 0) {
      console.log(
        colors.dim(
          '  (deny-list status cannot be checked from a design id: authorPublicId is a one-way hash of the userId)'
        )
      );
    }
    return 0;
  } finally {
    await redis.quit();
  }
}
