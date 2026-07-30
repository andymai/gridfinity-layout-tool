/**
 * One-off backfill: grant a sliding TTL to `ml:*` aggregates written before
 * the ingest path expired them.
 *
 * Run AFTER deploying the ingest change. Ordering is what makes this safe:
 * once deployed, every write refreshes the TTL, so keys still receiving data
 * keep sliding forward and only the dormant tail actually expires. Run it
 * against a build that does not refresh and the whole corpus dies at T+90d.
 *
 *   pnpm backfill-ml-ttls            # dry run — report only
 *   pnpm backfill-ml-ttls --apply    # set TTLs
 */

import { ML_AGGREGATE_TTL_SECONDS, isExpiringAggregate } from '../api/lib/mlTelemetry/retention.js';
import { loadEnv } from './sync-admin/lib/env.js';
import { connect, scanKeys } from './sync-admin/lib/redis.js';

const CHUNK = 200;

function namespaceOf(key: string): string {
  const parts = key.split(':');
  return parts.length > 2 ? `${parts[0]}:${parts[1]}:*` : key;
}

async function ttlMany(
  redis: ReturnType<typeof connect>,
  keys: readonly string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    const pipeline = redis.pipeline();
    for (const key of chunk) pipeline.ttl(key);
    const results = await pipeline.exec();
    if (results === null) throw new Error('backfill-ml-ttls: redis pipeline failed');
    results.forEach(([err, value], j) => {
      if (err) throw err;
      out.set(chunk[j], value as number);
    });
  }
  return out;
}

async function main(): Promise<number> {
  const apply = process.argv.includes('--apply');
  loadEnv();
  const redis = connect();

  try {
    const keys = await scanKeys(redis, 'ml:*');
    const ttls = await ttlMany(redis, keys);

    const needsTtl: string[] = [];
    let alreadyExpiring = 0;
    let lifetime = 0;

    for (const key of keys) {
      if (!isExpiringAggregate(key)) {
        lifetime++;
        continue;
      }
      // -1 is "exists, no TTL"; -2 is "already gone" (expired mid-scan).
      if (ttls.get(key) === -1) needsTtl.push(key);
      else alreadyExpiring++;
    }

    const byNamespace = new Map<string, number>();
    for (const key of needsTtl) {
      const ns = namespaceOf(key);
      byNamespace.set(ns, (byNamespace.get(ns) ?? 0) + 1);
    }

    console.log(`scanned            ${keys.length} ml:* keys`);
    console.log(`already expiring   ${alreadyExpiring}`);
    console.log(`lifetime (skipped) ${lifetime}`);
    console.log(`needs TTL          ${needsTtl.length}`);
    console.log('');
    for (const [ns, n] of [...byNamespace].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`  ${ns.padEnd(28)} ${n}`);
    }

    if (!apply) {
      console.log(`\nDry run. Re-run with --apply to set a ${ML_AGGREGATE_TTL_SECONDS}s TTL.`);
      return 0;
    }

    let set = 0;
    for (let i = 0; i < needsTtl.length; i += CHUNK) {
      const chunk = needsTtl.slice(i, i + CHUNK);
      const pipeline = redis.pipeline();
      for (const key of chunk) pipeline.expire(key, ML_AGGREGATE_TTL_SECONDS);
      const results = await pipeline.exec();
      if (results === null) throw new Error('backfill-ml-ttls: redis pipeline failed');
      results.forEach(([err, value]) => {
        if (err) throw err;
        if (value === 1) set++;
      });
    }
    console.log(`\nSet TTL on ${set} keys.`);
    return 0;
  } finally {
    await redis.quit();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
