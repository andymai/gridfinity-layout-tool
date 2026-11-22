import { buildInventory } from '../lib/inventory.js';
import { ALL_KINDS } from '../lib/kinds.js';
import { colors, formatTable } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import type { Args } from '../lib/args.js';
import type { Inventory, Kind } from '../lib/types.js';

interface KindStats {
  count: number;
  bytes: number;
}

interface UserStats {
  uid: string;
  byKind: Record<Kind, KindStats>;
  tombstones: number;
  oldestItem: number;
  totalBytes: number;
}

const kb = (bytes: number): string => (bytes / 1024).toFixed(1);

export async function users(args: Args): Promise<number> {
  const redis = connect();
  try {
    const inv = await buildInventory(redis, { kind: args.kind });
    const stats = computeStats(inv);
    const shown = args.kind ? [args.kind] : ALL_KINDS;

    if (args.json) {
      process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
    } else {
      console.log(colors.bold(`=== users (${stats.length}) ===`));
      console.log(
        formatTable(
          ['uid', ...shown, 'total KB', 'tombs', 'oldest'],
          stats.map((s) => [
            s.uid.slice(0, 16) + '…',
            ...shown.map((kind) => {
              const { count, bytes } = s.byKind[kind];
              return count === 0 ? '—' : `${count} (${kb(bytes)} KB)`;
            }),
            kb(s.totalBytes),
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

export function computeStats(inv: Inventory): UserStats[] {
  const map = new Map<string, UserStats>();
  const get = (uid: string): UserStats => {
    let s = map.get(uid);
    if (!s) {
      const byKind = Object.fromEntries(
        ALL_KINDS.map((kind) => [kind, { count: 0, bytes: 0 }])
      ) as Record<Kind, KindStats>;
      s = { uid, byKind, tombstones: 0, oldestItem: 0, totalBytes: 0 };
      map.set(uid, s);
    }
    return s;
  };

  // Seed from index rows so users whose blobs are all missing (or who only
  // have tombstones) are still represented in the table.
  for (const r of inv.indexRows) {
    const s = get(r.uid);
    if (r.tombstone) s.tombstones++;
  }
  for (const b of inv.blobs) {
    const s = get(b.uid);
    s.byKind[b.kind].count++;
    s.byKind[b.kind].bytes += b.size;
    s.totalBytes += b.size;
    const ms = b.uploadedAt.getTime();
    if (s.oldestItem === 0 || ms < s.oldestItem) s.oldestItem = ms;
  }

  return [...map.values()].sort((a, b) => b.totalBytes - a.totalBytes);
}
