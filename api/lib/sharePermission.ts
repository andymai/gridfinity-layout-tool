import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { shareHashKey, sharePermissionKey, sharePermissionVersionKey } from './redisKeys.js';
import type { ShareMetadata } from './shared.js';

type Permission = ShareMetadata['permission'];

// Vercel Blob takes up to 60s to propagate an overwrite through its CDN, and a
// public store has no read that bypasses it, so a share read right after an
// update can return the previous permission. The Redis copy only has to
// outlive that window.
export const SHARE_PERMISSION_TTL_SECONDS = 120;

// KEYS: permission, version, token hash. ARGV: token hash ('' for a share from
// before the hash moved to Redis), stamp, TTL, then the record's own.
// A record of an earlier share under the id must not land: DELETE removes the
// token hash, and POST sets a new one. Within one share, a write that lands
// over another carries a later stamp, so the record with the latest stamp
// names the stored blob. A record of an earlier share loses whatever its stamp;
// a record that names no share keeps the stamp order.
const FENCE_LUA = `
local holder = redis.call('GET', KEYS[3])
if ARGV[1] == '' then
  if holder then return 0 end
elseif holder ~= ARGV[1] then
  return 0
end
local recorded = redis.call('HMGET', KEYS[2], 'stamp', 'holder')
local last = tonumber(recorded[1])
if last and (not recorded[2] or recorded[2] == ARGV[1]) and last >= tonumber(ARGV[2]) then
  return 0
end
`;

const RECORD_PERMISSION_LUA = `${FENCE_LUA}
redis.call('HSET', KEYS[2], 'stamp', ARGV[2], 'holder', ARGV[1], 'etag', ARGV[4], 'permission', ARGV[5])
redis.call('EXPIRE', KEYS[2], ARGV[3])
redis.call('SET', KEYS[1], ARGV[5], 'EX', ARGV[3])
return 1
`;

// A write that landed but could not record. Its stamp stays, with no ETag or
// permission, so readers fall back to the blob and the late record of an older
// write still loses.
const FORGET_PERMISSION_LUA = `${FENCE_LUA}
redis.call('DEL', KEYS[1], KEYS[2])
redis.call('HSET', KEYS[2], 'stamp', ARGV[2], 'holder', ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return 1
`;

interface PermissionRedis extends Redis {
  recordSharePermission(
    permissionKey: string,
    versionKey: string,
    hashKey: string,
    tokenHash: string,
    stampMs: number,
    ttlSeconds: number,
    etag: string,
    permission: Permission
  ): Promise<number>;
  forgetSharePermission(
    permissionKey: string,
    versionKey: string,
    hashKey: string,
    tokenHash: string,
    stampMs: number,
    ttlSeconds: number
  ): Promise<number>;
}

function permissionClient(redis: Redis): PermissionRedis {
  const client = redis as PermissionRedis;
  if (typeof client.recordSharePermission !== 'function') {
    client.defineCommand('recordSharePermission', { numberOfKeys: 3, lua: RECORD_PERMISSION_LUA });
    client.defineCommand('forgetSharePermission', { numberOfKeys: 3, lua: FORGET_PERMISSION_LUA });
  }
  return client;
}

export interface SharePermissionWrite {
  readonly stampMs: number;
  /** ETag of the blob that the write stored. */
  readonly etag: string;
  readonly permission: Permission;
  /** The Redis token hash that let the write in; null when the hash is only in the blob. */
  readonly tokenHash: string | null;
}

/**
 * Records the permission of a write that landed: for reads ahead of the CDN,
 * and as the proof that a later write needs to keep it. A record that comes
 * after the record of a later write, or after its share was deleted, changes
 * nothing.
 */
export async function recordSharePermission(
  redis: Redis | null,
  shareId: string,
  write: SharePermissionWrite
): Promise<void> {
  if (!redis) return;
  const client = permissionClient(redis);
  const fence = [
    sharePermissionKey(shareId),
    sharePermissionVersionKey(shareId),
    shareHashKey(shareId),
    write.tokenHash ?? '',
    write.stampMs,
    SHARE_PERMISSION_TTL_SECONDS,
  ] as const;
  try {
    await client.recordSharePermission(...fence, write.etag, write.permission);
  } catch (error) {
    logger.warn('Failed to record a share permission', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
    await client.forgetSharePermission(...fence).catch(() => undefined);
  }
}

/**
 * The permission that the write which stored blob version `etag` recorded.
 * Null when the latest record names another version, or Redis fails.
 */
export async function recordedPermissionOf(
  redis: Redis,
  shareId: string,
  etag: string
): Promise<Permission | null> {
  try {
    const [recordedEtag, permission] = await redis.hmget(
      sharePermissionVersionKey(shareId),
      'etag',
      'permission'
    );
    if (recordedEtag !== etag) return null;
    return permission === 'view' || permission === 'edit' ? permission : null;
  } catch {
    return null;
  }
}
