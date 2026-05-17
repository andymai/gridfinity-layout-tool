import { buildInventory } from '../lib/inventory.js';
import { colors, formatTable } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import type { Args } from '../lib/args.js';
import type { Inventory } from '../lib/types.js';

interface UserStats {
  uid: string;
  layoutsCount: number;
  layoutsBytes: number;
  designsCount: number;
  designsBytes: number;
  tombstones: number;
  oldestItem: number;
  totalBytes: number;
}

export async function users(args: Args): Promise<number> {
  const redis = connect();
  try {
    const inv = await buildInventory(redis, { kind: args.kind });
    const stats = computeStats(inv);

    if (args.json) {
      process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
    } else {
      console.log(colors.bold(`=== users (${stats.length}) ===`));
      console.log(
        formatTable(
          ['uid', 'layouts', 'layouts KB', 'designs', 'designs KB', 'tombs', 'oldest'],
          stats.map((s) => [
            s.uid.slice(0, 16) + '…',
            s.layoutsCount,
            (s.layoutsBytes / 1024).toFixed(1),
            s.designsCount,
            (s.designsBytes / 1024).toFixed(1),
            s.tombstones,
            s.oldestItem ? new Date(s.oldestItem).toISOString().slice(0, 10) : '—',
          ])
        )
      );
    }
    return 0;
  } finally {
    await redis.quit();
  }
}

function computeStats(inv: Inventory): UserStats[] {
  const map = new Map<string, UserStats>();
  const get = (uid: string): UserStats => {
    let s = map.get(uid);
    if (!s) {
      s = {
        uid,
        layoutsCount: 0,
        layoutsBytes: 0,
        designsCount: 0,
        designsBytes: 0,
        tombstones: 0,
        oldestItem: 0,
        totalBytes: 0,
      };
      map.set(uid, s);
    }
    return s;
  };

  for (const b of inv.blobs) {
    const s = get(b.uid);
    if (b.kind === 'layouts') {
      s.layoutsCount++;
      s.layoutsBytes += b.size;
    } else {
      s.designsCount++;
      s.designsBytes += b.size;
    }
    s.totalBytes += b.size;
    const ms = b.uploadedAt.getTime();
    if (s.oldestItem === 0 || ms < s.oldestItem) s.oldestItem = ms;
  }
  for (const r of inv.indexRows) {
    if (r.tombstone) get(r.uid).tombstones++;
  }

  return [...map.values()].sort((a, b) => b.totalBytes - a.totalBytes);
}
