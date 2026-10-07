import type { Redis } from 'ioredis';
import { MESH_QUOTA_BYTES, MESH_QUOTA_COUNT, checkMeshQuota, type QuotaError } from './quota.js';
import { meshHoldersKey, sessionKey, userMeshesKey, userMeshUsageKey } from './redisKeys.js';

/**
 * The two scripts below are the only writers of `users:{uid}:meshes`, its
 * running totals in `users:{uid}:meshUsage`, and `mesh:holders:{hash}`. That is
 * what keeps the totals equal to the hash without ever scanning it.
 */

export interface HeldMesh {
  readonly sizeBytes: number;
  readonly url: string;
}

export interface MeshUsage {
  readonly bytes: number;
  readonly count: number;
}

export function accountMeshHolder(userId: string): string {
  return `user:${userId}`;
}

/**
 * Rejects on the same comparisons as `checkMeshQuota` and returns the usage it
 * read, so the caller rebuilds the identical error from it.
 */
const MESH_ACQUIRE_LUA = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'signed-out'}
end
if redis.call('HEXISTS', KEYS[2], ARGV[1]) == 1 then
  return {'held'}
end
local size = tonumber(ARGV[3])
local bytes = tonumber(redis.call('HGET', KEYS[3], 'bytes') or '0')
local count = tonumber(redis.call('HGET', KEYS[3], 'count') or '0')
if count + 1 > tonumber(ARGV[6]) or bytes + size > tonumber(ARGV[5]) then
  return {'over-quota', bytes, count}
end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
redis.call('HINCRBY', KEYS[3], 'bytes', size)
redis.call('HINCRBY', KEYS[3], 'count', 1)
redis.call('SADD', KEYS[4], ARGV[4])
return {'acquired'}
`;

/** The below-zero clamps cover drifted totals: a release must never leave them negative. */
const MESH_RELEASE_LUA = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if raw then
  local ok, entry = pcall(cjson.decode, raw)
  local size = ok and type(entry) == 'table' and tonumber(entry.sizeBytes) or 0
  redis.call('HDEL', KEYS[1], ARGV[1])
  if redis.call('HINCRBY', KEYS[2], 'bytes', -size) < 0 then
    redis.call('HSET', KEYS[2], 'bytes', 0)
  end
  if redis.call('HINCRBY', KEYS[2], 'count', -1) < 0 then
    redis.call('HSET', KEYS[2], 'count', 0)
  end
end
redis.call('SREM', KEYS[3], ARGV[2])
return redis.call('SCARD', KEYS[3])
`;

interface MeshRedis extends Redis {
  meshAcquire(
    sessionKey: string,
    meshesKey: string,
    usageKey: string,
    holdersKey: string,
    hash: string,
    entry: string,
    sizeBytes: number,
    holder: string,
    maxBytes: number,
    maxCount: number
  ): Promise<(string | number)[]>;
  meshRelease(
    meshesKey: string,
    usageKey: string,
    holdersKey: string,
    hash: string,
    holder: string
  ): Promise<number>;
}

// Registered lazily on whatever client `getRedis()` hands back, and per
// instance, for the same reason as `ensureLikeToggle` in communityStore.ts.
function ensureMeshScripts(redis: Redis): MeshRedis {
  const client = redis as MeshRedis;
  if (typeof client.meshAcquire !== 'function') {
    client.defineCommand('meshAcquire', { numberOfKeys: 4, lua: MESH_ACQUIRE_LUA });
    client.defineCommand('meshRelease', { numberOfKeys: 3, lua: MESH_RELEASE_LUA });
  }
  return client;
}

function parseHeldMesh(raw: string): HeldMesh | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null) return null;
    const { sizeBytes, url } = value as Partial<HeldMesh>;
    if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes < 0) return null;
    if (typeof url !== 'string') return null;
    return { sizeBytes, url };
  } catch {
    return null;
  }
}

export async function getHeldMesh(
  redis: Redis,
  userId: string,
  hash: string
): Promise<HeldMesh | null> {
  const raw = await redis.hget(userMeshesKey(userId), hash);
  return raw === null ? null : parseHeldMesh(raw);
}

export async function getMeshUsage(redis: Redis, userId: string): Promise<MeshUsage> {
  const [bytes, count] = await redis.hmget(userMeshUsageKey(userId), 'bytes', 'count');
  return { bytes: Number(bytes ?? 0), count: Number(count ?? 0) };
}

export interface MeshHold {
  readonly userId: string;
  readonly sessionToken: string;
  readonly hash: string;
  readonly held: HeldMesh;
}

export type MeshAcquireResult =
  | { readonly status: 'acquired' | 'held' | 'signed-out' }
  | { readonly status: 'over-quota'; readonly error: QuotaError };

/**
 * Checking the quota and recording the hold in one script is what stops
 * concurrent uploads of different files from all passing on the same usage.
 * The session check shares the step because account deletion removes sessions
 * before it releases holds, so a request authenticated before a deletion
 * cannot record a hold after it.
 */
export async function acquireAccountMesh(redis: Redis, hold: MeshHold): Promise<MeshAcquireResult> {
  const [status, bytes, count] = await ensureMeshScripts(redis).meshAcquire(
    sessionKey(hold.sessionToken),
    userMeshesKey(hold.userId),
    userMeshUsageKey(hold.userId),
    meshHoldersKey(hold.hash),
    hold.hash,
    JSON.stringify(hold.held),
    hold.held.sizeBytes,
    accountMeshHolder(hold.userId),
    MESH_QUOTA_BYTES,
    MESH_QUOTA_COUNT
  );
  if (status === 'acquired' || status === 'held' || status === 'signed-out') return { status };
  const verdict = checkMeshQuota(
    { bytes: Number(bytes), count: Number(count) },
    hold.held.sizeBytes
  );
  if (verdict.ok) throw new Error(`Mesh acquire returned ${String(status)} within the quota`);
  return { status: 'over-quota', error: verdict.error };
}

export async function releaseAccountMesh(
  redis: Redis,
  userId: string,
  hash: string
): Promise<number> {
  return ensureMeshScripts(redis).meshRelease(
    userMeshesKey(userId),
    userMeshUsageKey(userId),
    meshHoldersKey(hash),
    hash,
    accountMeshHolder(userId)
  );
}

/** Batched so an account at the mesh count cap is released inside one function's time limit. */
const RELEASE_BATCH = 500;

export async function releaseAllAccountMeshes(redis: Redis, userId: string): Promise<void> {
  let cursor = '0';
  do {
    const [next, entries] = await redis.hscan(
      userMeshesKey(userId),
      cursor,
      'COUNT',
      RELEASE_BATCH
    );
    cursor = next;
    const hashes = entries.filter((_, i) => i % 2 === 0);
    await Promise.all(hashes.map((hash) => releaseAccountMesh(redis, userId, hash)));
  } while (cursor !== '0');
}
