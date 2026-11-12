import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { sharePermissionKey, sharePermissionVersionKey } from './redisKeys.js';
import type { ShareMetadata } from './shared.js';

type Permission = ShareMetadata['permission'];

// Vercel Blob takes up to 60s to propagate an overwrite through its CDN, and a
// public store has no read that bypasses it, so a share read right after an
// update can return the previous permission. The Redis copy only has to
// outlive that window.
export const SHARE_PERMISSION_TTL_SECONDS = 120;

// A write that lands over another one carries a later stamp, so the record
// with the latest stamp names the blob that the store holds. A record that
// comes late must not replace the record of a write that landed after it.
const RECORD_PERMISSION_LUA = `
local last = tonumber(redis.call('HGET', KEYS[2], 'stamp'))
if last and last >= tonumber(ARGV[1]) then return 0 end
redis.call('HSET', KEYS[2], 'stamp', ARGV[1], 'etag', ARGV[2], 'permission', ARGV[3])
redis.call('EXPIRE', KEYS[2], ARGV[4])
redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
return 1
`;

// A write that landed but could not record. Its stamp stays, with no ETag or
// permission, so readers fall back to the blob and the late record of an older
// write still loses. The record of a later write stays as it is.
const FORGET_PERMISSION_LUA = `
local last = tonumber(redis.call('HGET', KEYS[2], 'stamp'))
if last and last >= tonumber(ARGV[1]) then return 0 end
redis.call('DEL', KEYS[1], KEYS[2])
redis.call('HSET', KEYS[2], 'stamp', ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1
`;

interface PermissionRedis extends Redis {
  recordSharePermission(
    permissionKey: string,
    versionKey: string,
    stampMs: number,
    etag: string,
    permission: Permission,
    ttlSeconds: number
  ): Promise<number>;
  forgetSharePermission(
    permissionKey: string,
    versionKey: string,
    stampMs: number,
    ttlSeconds: number
  ): Promise<number>;
}

function permissionClient(redis: Redis): PermissionRedis {
  const client = redis as PermissionRedis;
  if (typeof client.recordSharePermission !== 'function') {
    client.defineCommand('recordSharePermission', { numberOfKeys: 2, lua: RECORD_PERMISSION_LUA });
    client.defineCommand('forgetSharePermission', { numberOfKeys: 2, lua: FORGET_PERMISSION_LUA });
  }
  return client;
}

export interface SharePermissionWrite {
  readonly stampMs: number;
  /** ETag of the blob that the write stored. */
  readonly etag: string;
  readonly permission: Permission;
}

/**
 * Records the permission of a write that landed: for reads ahead of the CDN,
 * and as the proof that a later write needs to keep it. A record that comes
 * after the record of a later write changes nothing.
 */
export async function recordSharePermission(
  redis: Redis | null,
  shareId: string,
  write: SharePermissionWrite
): Promise<void> {
  if (!redis) return;
  const client = permissionClient(redis);
  const permissionKey = sharePermissionKey(shareId);
  const versionKey = sharePermissionVersionKey(shareId);
  try {
    await client.recordSharePermission(
      permissionKey,
      versionKey,
      write.stampMs,
      write.etag,
      write.permission,
      SHARE_PERMISSION_TTL_SECONDS
    );
  } catch (error) {
    logger.warn('Failed to record a share permission', {
      id: shareId,
      error: error instanceof Error ? error.message : String(error),
    });
    await client
      .forgetSharePermission(permissionKey, versionKey, write.stampMs, SHARE_PERMISSION_TTL_SECONDS)
      .catch(() => undefined);
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
