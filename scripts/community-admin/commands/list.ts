import type { Redis } from 'ioredis';
import { readCommunityCards } from '../../../api/lib/communityStore.js';
import type { CommunityCardRecord } from '../../../api/lib/communityStore.js';
import { communityReportsKey } from '../../../api/lib/redisKeys.js';
import type { Args } from '../lib/args.js';
import { colors, formatTable } from '../lib/output.js';
import { connect, scanKeys } from '../lib/redis.js';

const LIST_MODES = ['flagged', 'hidden', 'all'] as const;
type ListMode = (typeof LIST_MODES)[number];

interface ListRow extends CommunityCardRecord {
  reportCount: number;
}

async function loadRows(redis: Redis): Promise<ListRow[]> {
  const keys = await scanKeys(redis, 'community:design:*');
  const ids = keys.map((key) => key.slice('community:design:'.length));
  const cards = await readCommunityCards(redis, ids);

  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.scard(communityReportsKey(id));
  const reportResults = (await pipeline.exec()) ?? [];

  const rows: ListRow[] = [];
  cards.forEach((card, i) => {
    if (!card) return;
    const [error, count] = reportResults[i] ?? [null, 0];
    rows.push({ ...card, reportCount: error ? 0 : Number(count ?? 0) });
  });
  return rows;
}

function rowsForMode(rows: readonly ListRow[], mode: ListMode): ListRow[] {
  if (mode === 'hidden') return rows.filter((r) => r.status === 'hidden');
  if (mode === 'flagged') return rows.filter((r) => r.status === 'live' && r.reportCount > 0);
  return [...rows];
}

export async function list(args: Args): Promise<number> {
  const mode = (args.positional[0] ?? 'all') as ListMode;
  if (!LIST_MODES.includes(mode)) {
    console.error(`list <mode> must be one of: ${LIST_MODES.join(', ')}`);
    return 2;
  }

  const redis = connect();
  try {
    const rows = await loadRows(redis);
    const counts = {
      live: rows.filter((r) => r.status === 'live').length,
      hidden: rows.filter((r) => r.status === 'hidden').length,
      removed: rows.filter((r) => r.status === 'removed').length,
      flagged: rows.filter((r) => r.status === 'live' && r.reportCount > 0).length,
    };
    const matched = rowsForMode(rows, mode);

    if (args.json) {
      process.stdout.write(JSON.stringify({ counts, mode, designs: matched }, null, 2) + '\n');
      return 0;
    }

    console.log(
      colors.bold(
        `=== community designs: ${counts.live + counts.hidden + counts.removed} total ===`
      )
    );
    console.log(
      `live: ${counts.live}  hidden: ${counts.hidden}  removed: ${counts.removed}  flagged: ${counts.flagged}`
    );
    console.log('');
    if (matched.length === 0) {
      console.log(colors.dim(`(no designs in mode "${mode}")`));
      return 0;
    }
    console.log(
      formatTable(
        ['id', 'status', 'reports', 'featured', 'author', 'name'],
        matched.map((r) => [
          r.id,
          r.status,
          r.reportCount,
          r.featured ? 'yes' : '',
          r.authorName,
          r.name,
        ])
      )
    );
    return 0;
  } finally {
    await redis.quit();
  }
}
