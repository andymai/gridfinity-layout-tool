import { analyzeWithReverify } from '../lib/findings.js';
import { buildInventory } from '../lib/inventory.js';
import { colors, formatFinding } from '../lib/output.js';
import { createProgress } from '../lib/progress.js';
import { connect } from '../lib/redis.js';
import { categoryOf, suggestFor } from '../lib/suggest.js';
import type { Args } from '../lib/args.js';
import type { Finding } from '../lib/types.js';

/** Findings that should fail `--strict`. Info is housekeeping, not a defect. */
export function failsStrict(findings: readonly Finding[]): boolean {
  return findings.some((f) => f.severity === 'error' || f.severity === 'warn');
}

export async function audit(args: Args): Promise<number> {
  const redis = connect();
  const progress = createProgress(true);
  try {
    const inv = await buildInventory(redis, { user: args.user, kind: args.kind, progress });
    const { findings, suppressed } = await analyzeWithReverify(inv, {
      fetchPayloads: !args.noPayloadFetch,
      reverifyWith: args.noReverify ? undefined : redis,
      progress,
    });

    if (args.json) {
      const payload = {
        summary: summarize(inv, findings, suppressed),
        findings: findings.map((f) => ({
          ...f,
          suggestions: args.suggest ? suggestFor(f) : undefined,
          category: categoryOf(f),
        })),
        suppressed: suppressed.map((f) => ({ ...f, category: categoryOf(f) })),
      };
      process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    } else {
      printHuman(inv, findings, suppressed, args.suggest);
    }

    return args.strict && failsStrict(findings) ? 1 : 0;
  } finally {
    await redis.quit();
  }
}

function summarize(
  inv: ReturnType<typeof buildInventory> extends Promise<infer T> ? T : never,
  findings: Finding[],
  suppressed: Finding[]
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
    suppressed: {
      total: suppressed.length,
      byKind: groupCount(suppressed, (f) => f.kind),
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
  suppressed: Finding[],
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
  if (suppressed.length > 0) {
    console.log(
      colors.dim(`Suppressed:      ${suppressed.length}  (re-verified as in-flight writes)`)
    );
  }

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
