import type { Redis } from 'ioredis';
import { MESH_QUOTA_BYTES, MESH_QUOTA_COUNT, checkMeshQuota, type QuotaError } from './quota.js';
import {
  meshHoldersKey,
  sessionKey,
  shareMeshesKey,
  userMeshesKey,
  userMeshUsageKey,
} from './redisKeys.js';

/**
 * The two scripts below are the only writers of `users:{uid}:meshes`, its
 * running totals in `users:{uid}:meshUsage`, and an account's members of
 * `mesh:holders:{hash}`. That is what keeps the totals equal to the hash
 * without ever scanning it. A share's members carry no totals, so plain set
 * writes add and drop them.
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

export function shareMeshHolder(shareId: string): string {
  return `share:${shareId}`;
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

/**
 * KEYS[1] is the share's own set, KEYS[2..] the holder sets of the files in
 * ARGV[2..]; ARGV[1] is the share's holder name. One step, so the share's set
 * never names a file without its hold, or the reverse.
 */
const SHARE_HOLD_LUA = `
for i = 2, #KEYS do
  redis.call('SADD', KEYS[1], ARGV[i])
  redis.call('SADD', KEYS[i], ARGV[1])
end
return #KEYS - 1
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
  shareHold(numberOfKeys: number, ...keysAndArgs: string[]): Promise<number>;
}

// Registered lazily on whatever client `getRedis()` hands back, and per
// instance, for the same reason as `ensureLikeToggle` in communityStore.ts.
function ensureMeshScripts(redis: Redis): MeshRedis {
  const client = redis as MeshRedis;
  if (typeof client.meshAcquire !== 'function') {
    client.defineCommand('meshAcquire', { numberOfKeys: 4, lua: MESH_ACQUIRE_LUA });
    client.defineCommand('meshRelease', { numberOfKeys: 3, lua: MESH_RELEASE_LUA });
  }
  if (typeof client.shareHold !== 'function') {
    client.defineCommand('shareHold', { lua: SHARE_HOLD_LUA });
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

export async function listHeldMeshes(redis: Redis, userId: string): Promise<Map<string, HeldMesh>> {
  const held = new Map<string, HeldMesh>();
  for (const [hash, raw] of Object.entries(await redis.hgetall(userMeshesKey(userId)))) {
    const mesh = parseHeldMesh(raw);
    if (mesh) held.set(hash, mesh);
  }
  return held;
}

export function meshStoreEnabled(): boolean {
  return process.env.MESH_STORE_ENABLED === 'true';
}

/** The hashes this account does not hold: all of them while the mesh store is off. */
export async function unheldMeshes(
  redis: Redis,
  userId: string,
  hashes: readonly string[]
): Promise<string[]> {
  const unique = [...new Set(hashes)];
  if (unique.length === 0 || !meshStoreEnabled()) return unique;
  const held = await redis.hmget(userMeshesKey(userId), ...unique);
  return unique.filter((_, i) => {
    const raw = held[i];
    return raw === null || parseHeldMesh(raw) === null;
  });
}

/** The CDN URL of each file in `hashes` this account holds: none while the mesh store is off. */
export async function heldMeshUrls(
  redis: Redis,
  userId: string,
  hashes: readonly string[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unique = [...new Set(hashes)];
  if (unique.length === 0 || !meshStoreEnabled()) return urls;
  const held = await redis.hmget(userMeshesKey(userId), ...unique);
  unique.forEach((hash, i) => {
    const raw = held[i];
    const mesh = raw === null ? null : parseHeldMesh(raw);
    if (mesh) urls.set(hash, mesh.url);
  });
  return urls;
}

function shareScriptArgs(shareId: string, hashes: readonly string[]): [number, ...string[]] {
  return [
    hashes.length + 1,
    shareMeshesKey(shareId),
    ...hashes.map(meshHoldersKey),
    shareMeshHolder(shareId),
    ...hashes,
  ];
}

/**
 * Count a share among the holders of each file it names, so the files outlive
 * the sharer's own account holding them. Holds only grow, deletion included:
 * an update racing another, or racing the share's deletion, can write the
 * share back, so letting go is left to a cleanup that finds the share's blob
 * gone. The share's own set records every hold for that cleanup.
 */
export async function holdShareMeshes(
  redis: Redis,
  shareId: string,
  hashes: readonly string[]
): Promise<void> {
  const unique = [...new Set(hashes)];
  if (unique.length === 0) return;
  await ensureMeshScripts(redis).shareHold(...shareScriptArgs(shareId, unique));
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
