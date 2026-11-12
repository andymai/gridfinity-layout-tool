import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { shareRevisionKey } from './redisKeys.js';

/**
 * The key must outlive a write in flight plus the CDN's 60 s stale window.
 * After that, the body that the CDN serves carries the latest stamp, and the
 * caller's floor covers it.
 */
export const SHARE_REVISION_TTL_SECONDS = 24 * 60 * 60;

const RESERVE_REVISION_LUA = `
local last = tonumber(redis.call('GET', KEYS[1]) or '0') or 0
local stamp = math.max(tonumber(ARGV[1]), last + 1)
redis.call('SET', KEYS[1], string.format('%d', stamp), 'EX', ARGV[2])
return stamp
`;

interface RevisionRedis extends Redis {
  reserveShareRevision(key: string, floorMs: number, ttlSeconds: number): Promise<number>;
}

/**
 * A `lastUpdatedAt` for a write to the share, in epoch ms: `floorMs`, or later
 * than every stamp handed out before. A write reserves its stamp after it reads
 * the blob that it replaces, so a write that lands over another one always
 * carries the later stamp, whatever the server clocks and the CDN say.
 *
 * Without Redis, or when the call fails, this is `floorMs`.
 */
export async function reserveShareRevision(
  redis: Redis | null,
  shareId: string,
  floorMs: number
): Promise<number> {
  if (!redis) return floorMs;
  try {
    const client = redis as RevisionRedis;
    if (typeof client.reserveShareRevision !== 'function') {
      client.defineCommand('reserveShareRevision', { numberOfKeys: 1, lua: RESERVE_REVISION_LUA });
    }
    const stamp = await client.reserveShareRevision(
      shareRevisionKey(shareId),
      floorMs,
      SHARE_REVISION_TTL_SECONDS
    );
    return Number.isFinite(stamp) ? Math.max(stamp, floorMs) : floorMs;
  } catch (error) {
    logger.warn('Failed to reserve a share revision', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
    return floorMs;
  }
}
