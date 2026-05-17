import Redis from 'ioredis';
import { requireEnv } from './env.js';

export function connect(): Redis {
  return new Redis(requireEnv('REDIS_URL'), {
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    commandTimeout: 5000,
  });
}

export async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const out: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
    out.push(...batch);
    cursor = next;
  } while (cursor !== '0');
  return out;
}
