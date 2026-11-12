import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { shareRevisionKey } from './redisKeys.js';

/**
 * The key must outlive a write in flight plus the CDN's 60 s stale window.
 * After that, the body that the CDN serves carries the latest stamp, and the
 * caller's floor covers it.
 */
export const SHARE_REVISION_TTL_SECONDS = 24 * 60 * 60;

// A new counter starts unverified: its first floor can come from a stale CDN
// body, below a stamp that a writer with a fast clock stored before the
// counter existed. Every write takes its stamp here, so once one write that
// matched its body's ETag lands, the counter covers the blob for good.
const RESERVE_REVISION_LUA = `
local last = tonumber(redis.call('HGET', KEYS[1], 'stamp'))
local stamp = tonumber(ARGV[1])
local verified = 0
if last then
  stamp = math.max(stamp, last + 1)
  if redis.call('HGET', KEYS[1], 'verified') == '1' then verified = 1 end
else
  redis.call('HSET', KEYS[1], 'verified', '0')
end
redis.call('HSET', KEYS[1], 'stamp', string.format('%d', stamp))
redis.call('EXPIRE', KEYS[1], ARGV[2])
return {stamp, verified}
`;

const VERIFY_REVISION_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local last = tonumber(redis.call('HGET', KEYS[1], 'stamp')) or 0
if tonumber(ARGV[1]) > last then
  redis.call('HSET', KEYS[1], 'stamp', string.format('%d', tonumber(ARGV[1])))
end
redis.call('HSET', KEYS[1], 'verified', '1')
return 1
`;

interface RevisionRedis extends Redis {
  reserveShareRevision(key: string, floorMs: number, ttlSeconds: number): Promise<[number, number]>;
  verifyShareRevision(key: string, stampMs: number): Promise<number>;
}

export interface ShareRevision {
  readonly stampMs: number;
  /**
   * True when a write that matched its body's ETag landed since the counter
   * began, so the counter is at or past the stored blob's stamp.
   */
  readonly verified: boolean;
}

function revisionClient(redis: Redis): RevisionRedis {
  const client = redis as RevisionRedis;
  if (typeof client.reserveShareRevision !== 'function') {
    client.defineCommand('reserveShareRevision', { numberOfKeys: 1, lua: RESERVE_REVISION_LUA });
    client.defineCommand('verifyShareRevision', { numberOfKeys: 1, lua: VERIFY_REVISION_LUA });
  }
  return client;
}

/**
 * A `lastUpdatedAt` for a write to the share: `floorMs`, or later than every
 * stamp handed out before. A write reserves its stamp after it reads the blob
 * that it replaces, so a write that lands over another one always carries the
 * later stamp, whatever the server clocks and the CDN say.
 *
 * Null when Redis fails. A write must then not land: a stamp that the counter
 * does not know can put the counter behind the blob.
 */
export async function reserveShareRevision(
  redis: Redis,
  shareId: string,
  floorMs: number
): Promise<ShareRevision | null> {
  try {
    const [stamp, verified] = await revisionClient(redis).reserveShareRevision(
      shareRevisionKey(shareId),
      floorMs,
      SHARE_REVISION_TTL_SECONDS
    );
    if (!Number.isFinite(stamp)) return null;
    return { stampMs: Math.max(stamp, floorMs), verified: verified === 1 };
  } catch (error) {
    logger.warn('Failed to reserve a share revision', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Marks the counter verified, after a write that matched its body's ETag landed. */
export async function verifyShareRevision(
  redis: Redis,
  shareId: string,
  stampMs: number
): Promise<void> {
  try {
    await revisionClient(redis).verifyShareRevision(shareRevisionKey(shareId), stampMs);
  } catch (error) {
    logger.warn('Failed to verify a share revision', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
