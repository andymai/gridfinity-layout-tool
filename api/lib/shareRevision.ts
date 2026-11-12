import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { shareRevisionKey } from './redisKeys.js';

/**
 * The key must outlive a write in flight plus the CDN's 60 s stale window.
 * After that, the body that the CDN serves carries the latest stamp, and the
 * caller's floor covers it.
 */
export const SHARE_REVISION_TTL_SECONDS = 24 * 60 * 60;

// A missing counter stays missing: a floor taken from a stale CDN body must
// not seed it. Only `seedShareRevision`, after a write proves the floor, can.
const RESERVE_REVISION_LUA = `
local last = redis.call('GET', KEYS[1])
if not last then return false end
local stamp = math.max(tonumber(ARGV[1]), (tonumber(last) or 0) + 1)
redis.call('SET', KEYS[1], string.format('%d', stamp), 'EX', ARGV[2])
return stamp
`;

const SEED_REVISION_LUA = `
local last = tonumber(redis.call('GET', KEYS[1]) or '0') or 0
local stamp = math.max(tonumber(ARGV[1]), last)
redis.call('SET', KEYS[1], string.format('%d', stamp), 'EX', ARGV[2])
return stamp
`;

interface RevisionRedis extends Redis {
  reserveShareRevision(key: string, floorMs: number, ttlSeconds: number): Promise<number | null>;
  seedShareRevision(key: string, stampMs: number, ttlSeconds: number): Promise<number>;
}

function revisionClient(redis: Redis): RevisionRedis {
  const client = redis as RevisionRedis;
  if (typeof client.reserveShareRevision !== 'function') {
    client.defineCommand('reserveShareRevision', { numberOfKeys: 1, lua: RESERVE_REVISION_LUA });
    client.defineCommand('seedShareRevision', { numberOfKeys: 1, lua: SEED_REVISION_LUA });
  }
  return client;
}

/**
 * A `lastUpdatedAt` for a write to the share, in epoch ms: `floorMs`, or later
 * than every stamp handed out before. A write reserves its stamp after it reads
 * the blob that it replaces, so a write that lands over another one always
 * carries the later stamp, whatever the server clocks and the CDN say.
 *
 * Null when the share has no counter, or Redis is absent or fails. The caller
 * then stamps `floorMs` and must write only over the body that set the floor.
 */
export async function reserveShareRevision(
  redis: Redis | null,
  shareId: string,
  floorMs: number
): Promise<number | null> {
  if (!redis) return null;
  try {
    const stamp = await revisionClient(redis).reserveShareRevision(
      shareRevisionKey(shareId),
      floorMs,
      SHARE_REVISION_TTL_SECONDS
    );
    return stamp !== null && Number.isFinite(stamp) ? Math.max(stamp, floorMs) : null;
  } catch (error) {
    logger.warn('Failed to reserve a share revision', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Raises the share's counter to at least `stampMs`, the stamp of a write that landed. */
export async function seedShareRevision(
  redis: Redis | null,
  shareId: string,
  stampMs: number
): Promise<void> {
  if (!redis) return;
  try {
    await revisionClient(redis).seedShareRevision(
      shareRevisionKey(shareId),
      stampMs,
      SHARE_REVISION_TTL_SECONDS
    );
  } catch (error) {
    logger.warn('Failed to seed a share revision', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
