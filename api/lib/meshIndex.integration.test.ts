/**
 * Mesh holds against a real Redis.
 *
 * The unit suite emulates the acquire and release scripts in JS, which proves
 * the intended semantics only. These run the scripts, including the atomic
 * quota reservation that concurrent uploads rely on.
 *
 * Requires REDIS_TEST_URL (CI supplies a redis:7-alpine service container).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Redis } from 'ioredis';
import {
  accountMeshHolder,
  acquireAccountMesh,
  getHeldMesh,
  getMeshUsage,
  releaseAccountMesh,
  releaseAllAccountMeshes,
} from './meshIndex.js';
import type { MeshHold } from './meshIndex.js';
import { MESH_QUOTA_BYTES, MESH_QUOTA_COUNT, checkMeshQuota } from './quota.js';
import { meshHoldersKey, sessionKey, userMeshesKey, userMeshUsageKey } from './redisKeys.js';

const REDIS_TEST_URL = process.env.REDIS_TEST_URL;

// A bare `describe` that never runs reads as a pass; fail loudly in CI instead.
if (!REDIS_TEST_URL && process.env.CI) {
  throw new Error('REDIS_TEST_URL must be set in CI: the integration project cannot be skipped');
}

describe.skipIf(!REDIS_TEST_URL)('mesh holds (real Redis)', () => {
  let redis: Redis;

  const HASH = 'a'.repeat(64);

  function hold(userId: string, hash: string, sizeBytes = 1000): MeshHold {
    return {
      userId,
      sessionToken: `tok-${userId}`,
      hash,
      held: { sizeBytes, url: `https://blob/meshes/${hash}` },
    };
  }

  beforeAll(() => {
    redis = new Redis(REDIS_TEST_URL as string);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
    await redis.set(sessionKey('tok-u1'), '{}');
    await redis.set(sessionKey('tok-u2'), '{}');
  });

  it('keeps the hold, the totals and the holder set agreeing through acquire and release', async () => {
    expect(await acquireAccountMesh(redis, hold('u1', HASH, 1234))).toEqual({ status: 'acquired' });
    expect(await acquireAccountMesh(redis, hold('u1', HASH, 1234))).toEqual({ status: 'held' });
    expect(await acquireAccountMesh(redis, hold('u2', HASH, 1234))).toEqual({ status: 'acquired' });

    expect(await getHeldMesh(redis, 'u1', HASH)).toEqual({
      sizeBytes: 1234,
      url: `https://blob/meshes/${HASH}`,
    });
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 1234, count: 1 });
    expect(await redis.scard(meshHoldersKey(HASH))).toBe(2);

    expect(await releaseAccountMesh(redis, 'u1', HASH)).toBe(1);
    expect(await releaseAccountMesh(redis, 'u1', HASH)).toBe(1);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
    expect(await releaseAccountMesh(redis, 'u2', HASH)).toBe(0);
    expect(await redis.exists(meshHoldersKey(HASH))).toBe(0);
  });

  it('records nothing for a session that no longer exists', async () => {
    await redis.del(sessionKey('tok-u1'));
    expect(await acquireAccountMesh(redis, hold('u1', HASH))).toEqual({ status: 'signed-out' });
    expect(await redis.exists(userMeshesKey('u1'), userMeshUsageKey('u1'))).toBe(0);
    expect(await redis.exists(meshHoldersKey(HASH))).toBe(0);
  });

  it('rejects past either cap with exactly the pre-check error', async () => {
    const nearBytes = { bytes: MESH_QUOTA_BYTES - 999, count: 1 };
    const nearCount = { bytes: 0, count: MESH_QUOTA_COUNT };
    await redis.hset(userMeshUsageKey('u1'), nearBytes);
    await redis.hset(userMeshUsageKey('u2'), nearCount);

    for (const [userId, usage, size] of [
      ['u1', nearBytes, 1000],
      ['u2', nearCount, 1],
    ] as const) {
      const expected = checkMeshQuota(usage, size);
      expect(expected.ok).toBe(false);
      expect(await acquireAccountMesh(redis, hold(userId, HASH, size))).toEqual({
        status: 'over-quota',
        error: expected.ok ? null : expected.error,
      });
    }
    expect(await redis.exists(meshHoldersKey(HASH))).toBe(0);
  });

  it('admits only what fits when uploads acquire at once', async () => {
    await redis.hset(userMeshUsageKey('u1'), { bytes: MESH_QUOTA_BYTES - 2500, count: 0 });
    const hashes = ['c', 'd', 'e', 'f', '1', '2'].map((c) => c.repeat(64));

    const results = await Promise.all(
      hashes.map((hash) => acquireAccountMesh(redis, hold('u1', hash, 1000)))
    );

    expect(results.filter((r) => r.status === 'acquired')).toHaveLength(2);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: MESH_QUOTA_BYTES - 500, count: 2 });
    expect(await redis.hlen(userMeshesKey('u1'))).toBe(2);
  });

  it('releases an unparseable entry and clamps the totals at zero', async () => {
    await redis.hset(userMeshesKey('u1'), HASH, 'not json');
    await redis.sadd(meshHoldersKey(HASH), accountMeshHolder('u1'));

    expect(await releaseAccountMesh(redis, 'u1', HASH)).toBe(0);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
    expect(await redis.hexists(userMeshesKey('u1'), HASH)).toBe(0);
  });

  it('releases every hold of an account larger than one scan batch', async () => {
    const hashes = Array.from({ length: 1200 }, (_, i) => i.toString(16).padStart(64, '0'));
    for (const hash of hashes) await acquireAccountMesh(redis, hold('u1', hash, 10));
    await acquireAccountMesh(redis, hold('u2', hashes[0], 10));

    await releaseAllAccountMeshes(redis, 'u1');

    expect(await redis.exists(userMeshesKey('u1'))).toBe(0);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
    expect(await redis.exists(meshHoldersKey(hashes[1199]))).toBe(0);
    expect(await redis.smembers(meshHoldersKey(hashes[0]))).toEqual([accountMeshHolder('u2')]);
  });
});
