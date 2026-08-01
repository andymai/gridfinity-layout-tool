import Redis from 'ioredis';
import { requireEnv } from './env.js';

export function connect(): Redis {
  return new Redis(requireEnv('REDIS_URL'), {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    commandTimeout: 5000,
  });
}

/** Mirrors scanKeys in scripts/sync-admin/lib/redis.ts; see that file for the COUNT tuning rationale. */
const SCAN_COUNT = 10_000;

export async function scanKeys(
  redis: Redis,
  pattern: string,
  count = SCAN_COUNT
): Promise<string[]> {
  const out = new Set<string>();
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
    for (const k of batch) out.add(k);
    cursor = next;
  } while (cursor !== '0');
  return [...out];
}
