import { TOMBSTONE_RETENTION_MS } from '../../../api/lib/userIndex.js';
import { buildInventory } from '../lib/inventory.js';
import { colors, formatTable } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import type { Args } from '../lib/args.js';
import type { Kind } from '../lib/types.js';

interface TombRow {
  uid: string;
  kind: Kind;
  id: string;
  deletedAt: number;
  ageMs: number;
  stale: boolean;
}

export async function tombstones(args: Args): Promise<number> {
  const redis = connect();
  try {
    // Tombstones live entirely in Redis; skip the Blob listing.
    const inv = await buildInventory(redis, {
      user: args.user,
      kind: args.kind,
      skipBlobs: true,
    });
    const staleAge = args.olderThanMs ?? TOMBSTONE_RETENTION_MS;
    const now = Date.now();
    const rows: TombRow[] = inv.indexRows
      .filter((r) => r.tombstone)
      .map((r) => {
        const deletedAt = r.entry.deletedAt ?? r.entry.modifiedAt;
        const ageMs = now - deletedAt;
        return { uid: r.uid, kind: r.kind, id: r.id, deletedAt, ageMs, stale: ageMs > staleAge };
      })
      .sort((a, b) => b.ageMs - a.ageMs);

    if (args.json) {
      process.stdout.write(
        JSON.stringify({ staleThresholdMs: staleAge, tombstones: rows }, null, 2) + '\n'
      );
    } else {
      console.log(
        colors.bold(
          `=== tombstones (${rows.length}, stale threshold ${Math.round(staleAge / 86400000)}d) ===`
        )
      );
      console.log(
        formatTable(
          ['uid', 'kind', 'id', 'deleted', 'age (d)', 'stale'],
          rows.map((r) => [
            r.uid.slice(0, 12) + '…',
            r.kind,
            r.id,
            new Date(r.deletedAt).toISOString().slice(0, 10),
            (r.ageMs / 86400000).toFixed(0),
            r.stale ? colors.yellow('yes') : 'no',
          ])
        )
      );
    }

    const staleCount = rows.filter((r) => r.stale).length;
    return args.strict && staleCount > 0 ? 1 : 0;
  } finally {
    await redis.quit();
  }
}
