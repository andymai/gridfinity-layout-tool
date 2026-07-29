import Redis from 'ioredis';
import { requireEnv } from './env.js';

export function connect(): Redis {
  return new Redis(requireEnv('REDIS_URL'), {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    commandTimeout: 5000,
  });
}

/**
 * HGETALL many keys with a handful of round trips instead of one per key.
 * Against a remote Redis the serial version costs `keys × RTT`, which at
 * ~1k users dominated the whole audit and widened the blob↔index read gap
 * that produces in-flight false positives.
 */
export async function hgetallMany(
  redis: Redis,
  keys: readonly string[],
  chunkSize = 200,
  onChunk?: (done: number) => void
): Promise<Map<string, Record<string, string>>> {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error(`hgetallMany: chunkSize must be a positive integer, got ${chunkSize}`);
  }
  const out = new Map<string, Record<string, string>>();
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    const pipeline = redis.pipeline();
    for (const key of chunk) pipeline.hgetall(key);
    const results = await pipeline.exec();
    if (results === null) throw new Error('sync-admin: redis pipeline failed (connection lost)');
    results.forEach(([err, value], j) => {
      if (err) throw err;
      out.set(chunk[j], (value as Record<string, string>) ?? {});
    });
    onChunk?.(Math.min(i + chunkSize, keys.length));
  }
  return out;
}

/**
 * MATCH filters server-side but SCAN still walks the whole keyspace, so the
 * cursor cost tracks DBSIZE (~142k) rather than the ~1.2k keys that match.
 * Measured against production, per-call latency is round-trip-bound and flat
 * across this range — it does not degrade as COUNT grows — so the round trips
 * are pure overhead:
 *
 *   COUNT    calls   total    slowest call
 *     500      284   17.8s      117ms
 *    5000       29    1.8s       64ms
 *   10000       15    1.0s       84ms
 *   20000        8    0.5s       67ms
 *
 * 10000 takes nearly all of the win while keeping per-call server work modest,
 * which matters because this runs against the shared production instance.
 */
const SCAN_COUNT = 10_000;

export async function scanKeys(
  redis: Redis,
  pattern: string,
  count = SCAN_COUNT
): Promise<string[]> {
  // SCAN can yield the same key more than once during a single iteration;
  // a Set keeps the audit from double-counting.
  const out = new Set<string>();
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
    for (const k of batch) out.add(k);
    cursor = next;
  } while (cursor !== '0');
  return [...out];
}
