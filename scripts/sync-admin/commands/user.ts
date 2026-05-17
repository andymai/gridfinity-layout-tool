import { analyze } from '../lib/findings.js';
import { buildInventory } from '../lib/inventory.js';
import { colors, formatFinding, formatTable } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import { suggestFor } from '../lib/suggest.js';
import type { Args } from '../lib/args.js';

export async function user(args: Args): Promise<number> {
  const uid = args.positional[0];
  if (!uid) {
    console.error('user <uid> is required');
    return 2;
  }
  const redis = connect();
  try {
    const inv = await buildInventory(redis, { user: uid, kind: args.kind });
    const findings = await analyze(inv, { fetchPayloads: !args.noPayloadFetch });

    if (args.json) {
      process.stdout.write(
        JSON.stringify(
          {
            uid,
            blobs: inv.blobs,
            indexRows: inv.indexRows,
            findings: findings.map((f) => ({
              ...f,
              suggestions: args.suggest ? suggestFor(f) : undefined,
            })),
          },
          null,
          2
        ) + '\n'
      );
    } else {
      printHuman(uid, inv, findings);
    }

    const hasErrors = findings.some((f) => f.severity === 'error' || f.severity === 'warn');
    return args.strict && hasErrors ? 1 : 0;
  } finally {
    await redis.quit();
  }
}

function printHuman(
  uid: string,
  inv: {
    blobs: { kind: string; id: string; size: number; uploadedAt: Date }[];
    indexRows: {
      kind: string;
      id: string;
      tombstone: boolean;
      entry: { modifiedAt: number; sizeBytes: number; deletedAt?: number };
    }[];
  },
  findings: readonly { severity: string }[]
): void {
  console.log(colors.bold(`=== user ${uid} ===`));
  const live = inv.indexRows.filter((r) => !r.tombstone);
  const tombs = inv.indexRows.filter((r) => r.tombstone);
  console.log(`Blobs:         ${inv.blobs.length}`);
  console.log(`Live entries:  ${live.length}`);
  console.log(`Tombstones:    ${tombs.length}`);
  console.log('');

  if (inv.blobs.length) {
    console.log(colors.bold('Blobs:'));
    console.log(
      formatTable(
        ['kind', 'id', 'size', 'uploaded'],
        inv.blobs.map((b) => [b.kind, b.id, b.size, b.uploadedAt.toISOString().slice(0, 10)])
      )
    );
    console.log('');
  }

  if (tombs.length) {
    console.log(colors.bold('Tombstones:'));
    console.log(
      formatTable(
        ['kind', 'id', 'deletedAt'],
        tombs.map((r) => [
          r.kind,
          r.id,
          new Date(r.entry.deletedAt ?? r.entry.modifiedAt).toISOString().slice(0, 10),
        ])
      )
    );
    console.log('');
  }

  if (findings.length) {
    console.log(colors.bold('Findings:'));
    for (const f of findings as Parameters<typeof formatFinding>[0][])
      console.log(formatFinding(f));
  } else {
    console.log(colors.cyan('✓ no findings'));
  }
}
