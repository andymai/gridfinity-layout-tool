import type { ChainableCommander, Redis } from 'ioredis';
import { meshHoldersKey, userMeshesKey } from './redisKeys.js';

/**
 * Who holds which stored mesh file.
 *
 * Per account, `users:{uid}:meshes` maps each held hash to its size (summed by
 * the mesh quota, so a file costs an account its bytes once however many
 * designs use it) and its Blob URL. Per file, `mesh:holders:{hash}` is the set
 * of holders; when it empties, nothing references the file.
 */

export interface HeldMesh {
  readonly sizeBytes: number;
  readonly url: string;
}

export function accountMeshHolder(userId: string): string {
  return `user:${userId}`;
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

/** Every file an account holds, keyed by hash. Malformed entries are skipped. */
export async function getHeldMeshes(
  redis: Redis,
  userId: string
): Promise<Record<string, HeldMesh>> {
  const raw = await redis.hgetall(userMeshesKey(userId));
  const out: Record<string, HeldMesh> = {};
  for (const [hash, encoded] of Object.entries(raw)) {
    const parsed = parseHeldMesh(encoded);
    if (parsed) out[hash] = parsed;
  }
  return out;
}

async function execPipeline(pipeline: ChainableCommander, context: string): Promise<unknown[]> {
  const results = await pipeline.exec();
  if (results === null) throw new Error(`${context}: redis connection lost`);
  return results.map(([error, value]) => {
    if (error) throw new Error(`${context}: ${error.message}`);
    return value;
  });
}

/** Record that an account holds a stored file. Repeating it changes nothing. */
export async function acquireAccountMesh(
  redis: Redis,
  userId: string,
  hash: string,
  held: HeldMesh
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.hset(userMeshesKey(userId), hash, JSON.stringify(held));
  pipeline.sadd(meshHoldersKey(hash), accountMeshHolder(userId));
  await execPipeline(pipeline, 'Mesh acquire failed');
}

/**
 * Drop an account's hold on a file, which frees its quota, and return how many
 * holders the file has left. Zero means nothing references it. Repeating a
 * release changes nothing and returns the same count.
 */
export async function releaseAccountMesh(
  redis: Redis,
  userId: string,
  hash: string
): Promise<number> {
  const pipeline = redis.pipeline();
  pipeline.hdel(userMeshesKey(userId), hash);
  pipeline.srem(meshHoldersKey(hash), accountMeshHolder(userId));
  pipeline.scard(meshHoldersKey(hash));
  const results = await execPipeline(pipeline, 'Mesh release failed');
  return Number(results[2]);
}

/** Release every file an account holds, for account deletion. */
export async function releaseAllAccountMeshes(redis: Redis, userId: string): Promise<void> {
  const hashes = await redis.hkeys(userMeshesKey(userId));
  await Promise.all(hashes.map((hash) => releaseAccountMesh(redis, userId, hash)));
}
