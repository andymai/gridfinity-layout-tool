import { analyze } from '../lib/findings.js';
import { buildInventory } from '../lib/inventory.js';
import { colors, formatFinding } from '../lib/output.js';
import { connect } from '../lib/redis.js';
import { categoryOf, suggestFor } from '../lib/suggest.js';
import type { Args } from '../lib/args.js';
import type { Finding } from '../lib/types.js';

export async function audit(args: Args): Promise<number> {
  const redis = connect();
  try {
    const inv = await buildInventory(redis, { user: args.user, kind: args.kind });
    const findings = await analyze(inv, { fetchPayloads: !args.noPayloadFetch });

    if (args.json) {
      const payload = {
        summary: summarize(inv, findings),
        findings: findings.map((f) => ({
          ...f,
          suggestions: args.suggest ? suggestFor(f) : undefined,
          category: categoryOf(f),
        })),
      };
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      printHuman(inv, findings, args.suggest);
    }

    return args.strict && findings.length > 0 ? 1 : 0;
  } finally {
    await redis.quit();
  }
}

function summarize(
  inv: ReturnType<typeof buildInventory> extends Promise<infer T> ? T : never,
  findings: Finding[]
) {
  return {
    blobs: inv.blobs.length,
    indexEntries: inv.indexRows.length,
    liveEntries: inv.indexRows.filter((r) => !r.tombstone).length,
    tombstones: inv.indexRows.filter((r) => r.tombstone).length,
    blobUsers: inv.blobUsers.size,
    redisUsers: inv.redisUsers.size,
    findings: {
      total: findings.length,
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warn').length,
      info: findings.filter((f) => f.severity === 'info').length,
      byKind: groupCount(findings, (f) => f.kind),
    },
  };
}

function groupCount<T, K extends string>(items: readonly T[], key: (t: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function printHuman(
  inv: {
    blobs: { length: number };
    indexRows: { tombstone: boolean }[];
    blobUsers: Set<string>;
    redisUsers: Set<string>;
  },
  findings: Finding[],
  withSuggestions: boolean
): void {
  const live = inv.indexRows.filter((r) => !r.tombstone).length;
  const tombs = inv.indexRows.length - live;
  console.log(colors.bold('=== sync-admin audit ==='));
  console.log(`Blobs scanned:   ${inv.blobs.length}`);
  console.log(`Index entries:   ${inv.indexRows.length}  (live: ${live}, tombstones: ${tombs})`);
  console.log(`Users:           ${inv.blobUsers.size} in blob, ${inv.redisUsers.size} in redis`);
  console.log(
    `Findings:        ${findings.length}  (errors: ${findings.filter((f) => f.severity === 'error').length}, warnings: ${findings.filter((f) => f.severity === 'warn').length}, info: ${findings.filter((f) => f.severity === 'info').length})`
  );

  if (findings.length === 0) {
    console.log(`\n${colors.cyan('✓ no findings')}`);
    return;
  }

  console.log('');
  for (const f of findings) {
    console.log(formatFinding(f));
    if (withSuggestions) {
      const lines = suggestFor(f);
      for (const line of lines) console.log(colors.dim('    ' + line));
      if (lines.length > 0) console.log('');
    }
  }
}
