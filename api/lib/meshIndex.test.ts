/**
 * The unit fake emulates the two Lua scripts in JS, which proves the intended
 * semantics only. `meshIndex.integration.test.ts` runs the scripts themselves.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import {
  accountMeshHolder,
  acquireAccountMesh,
  getHeldMesh,
  getMeshUsage,
  heldMeshUrls,
  holdShareMeshes,
  releaseAccountMesh,
  releaseAllAccountMeshes,
  releaseShareMeshes,
  shareMeshHolder,
  unheldMeshes,
} from './meshIndex';
import type { MeshHold } from './meshIndex';
import { MESH_QUOTA_BYTES, MESH_QUOTA_COUNT } from './quota';
import {
  meshHoldersKey,
  sessionKey,
  shareMeshesKey,
  userMeshesKey,
  userMeshUsageKey,
} from './redisKeys';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const TOKEN = 'tok-1';

class FakeRedis {
  strings = new Map<string, string>();
  hashes = new Map<string, Map<string, string>>();
  sets = new Map<string, Set<string>>();
  defineCommandCalls = 0;
  hscanCalls = 0;
  private scans = new Map<string, string[]>();
  meshAcquire?: (...args: (string | number)[]) => Promise<(string | number)[]>;
  meshRelease?: (...args: string[]) => Promise<number>;

  private hash(key: string): Map<string, string> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    this.hashes.set(key, hash);
    return hash;
  }

  private incr(key: string, field: string, by: number): number {
    const next = Number(this.hashes.get(key)?.get(field) ?? '0') + by;
    this.hash(key).set(field, String(next));
    return next;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    return fields.map((field) => this.hashes.get(key)?.get(field) ?? null);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    const added = members.filter((member) => !set.has(member)).length;
    for (const member of members) set.add(member);
    this.sets.set(key, set);
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])];
  }

  async del(key: string): Promise<number> {
    return this.sets.delete(key) ? 1 : 0;
  }

  async srem(key: string, member: string): Promise<number> {
    const set = this.sets.get(key);
    const removed = set?.delete(member) ? 1 : 0;
    if (set?.size === 0) this.sets.delete(key);
    return removed;
  }

  /** Iterates a snapshot taken at cursor 0, as HSCAN may return deleted fields but never skips. */
  async hscan(
    key: string,
    cursor: string,
    _token: 'COUNT',
    count: number
  ): Promise<[string, string[]]> {
    this.hscanCalls += 1;
    if (cursor === '0') this.scans.set(key, [...(this.hashes.get(key)?.keys() ?? [])]);
    const fields = this.scans.get(key) ?? [];
    const start = Number(cursor);
    const page = fields.slice(start, start + count);
    const next = start + count >= fields.length ? '0' : String(start + count);
    return [next, page.flatMap((field) => [field, this.hashes.get(key)?.get(field) ?? ''])];
  }

  defineCommand(name: string): void {
    this.defineCommandCalls += 1;
    if (name === 'meshAcquire') {
      this.meshAcquire = async (
        session,
        meshes,
        usage,
        holders,
        hash,
        entry,
        size,
        holder,
        maxBytes,
        maxCount
      ) => {
        if (!this.strings.has(String(session))) return ['signed-out'];
        if (this.hashes.get(String(meshes))?.has(String(hash))) return ['held'];
        const bytes = Number(this.hashes.get(String(usage))?.get('bytes') ?? '0');
        const count = Number(this.hashes.get(String(usage))?.get('count') ?? '0');
        if (count + 1 > Number(maxCount) || bytes + Number(size) > Number(maxBytes)) {
          return ['over-quota', bytes, count];
        }
        this.hash(String(meshes)).set(String(hash), String(entry));
        this.incr(String(usage), 'bytes', Number(size));
        this.incr(String(usage), 'count', 1);
        const set = this.sets.get(String(holders)) ?? new Set<string>();
        set.add(String(holder));
        this.sets.set(String(holders), set);
        return ['acquired'];
      };
    }
    if (name === 'meshRelease') {
      this.meshRelease = async (meshes, usage, holders, hash, holder) => {
        const raw = this.hashes.get(meshes)?.get(hash);
        if (raw !== undefined) {
          let size: number;
          try {
            size = Number((JSON.parse(raw) as { sizeBytes?: unknown }).sizeBytes) || 0;
          } catch {
            size = 0;
          }
          this.hashes.get(meshes)?.delete(hash);
          if (this.hashes.get(meshes)?.size === 0) this.hashes.delete(meshes);
          if (this.incr(usage, 'bytes', -size) < 0) this.hash(usage).set('bytes', '0');
          if (this.incr(usage, 'count', -1) < 0) this.hash(usage).set('count', '0');
        }
        const set = this.sets.get(holders);
        set?.delete(holder);
        if (set?.size === 0) this.sets.delete(holders);
        return this.sets.get(holders)?.size ?? 0;
      };
    }
  }
}

let fake: FakeRedis;
let redis: Redis;

function signIn(userId: string, token = TOKEN): void {
  fake.strings.set(sessionKey(token), JSON.stringify({ userId }));
}

function hold(userId: string, hash: string, sizeBytes = 1000, sessionToken = TOKEN): MeshHold {
  return { userId, sessionToken, hash, held: { sizeBytes, url: `https://blob/meshes/${hash}` } };
}

function seedUsage(userId: string, bytes: number, count: number): void {
  fake.hashes.set(
    userMeshUsageKey(userId),
    new Map([
      ['bytes', String(bytes)],
      ['count', String(count)],
    ])
  );
}

beforeEach(() => {
  fake = new FakeRedis();
  redis = fake as unknown as Redis;
  signIn('u1');
});

describe('acquireAccountMesh', () => {
  it('records the hold, adds it to the totals, and joins the holder set', async () => {
    expect(await acquireAccountMesh(redis, hold('u1', HASH_A, 1234))).toEqual({
      status: 'acquired',
    });

    expect(await getHeldMesh(redis, 'u1', HASH_A)).toEqual({
      sizeBytes: 1234,
      url: `https://blob/meshes/${HASH_A}`,
    });
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 1234, count: 1 });
    expect(fake.sets.get(meshHoldersKey(HASH_A))).toEqual(new Set([accountMeshHolder('u1')]));
  });

  it('answers held for a file the account already holds, counting it once', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    expect(await acquireAccountMesh(redis, hold('u1', HASH_A))).toEqual({ status: 'held' });
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 1000, count: 1 });
    expect(fake.sets.get(meshHoldersKey(HASH_A))?.size).toBe(1);
  });

  it('records nothing once the session behind the upload is gone', async () => {
    fake.strings.clear();
    expect(await acquireAccountMesh(redis, hold('u1', HASH_A))).toEqual({ status: 'signed-out' });
    expect(fake.hashes.size).toBe(0);
    expect(fake.sets.size).toBe(0);
  });

  it('rejects a file past the byte cap with the same error as the pre-check', async () => {
    seedUsage('u1', MESH_QUOTA_BYTES - 999, 1);
    expect(await acquireAccountMesh(redis, hold('u1', HASH_A, 1000))).toEqual({
      status: 'over-quota',
      error: {
        type: 'QUOTA_EXCEEDED',
        reason: 'bytes',
        current: MESH_QUOTA_BYTES + 1,
        limit: MESH_QUOTA_BYTES,
      },
    });
    expect(await getHeldMesh(redis, 'u1', HASH_A)).toBeNull();
    expect(fake.sets.has(meshHoldersKey(HASH_A))).toBe(false);
  });

  it('rejects one file past the count cap', async () => {
    seedUsage('u1', 0, MESH_QUOTA_COUNT);
    const result = await acquireAccountMesh(redis, hold('u1', HASH_A, 1));
    expect(result.status === 'over-quota' ? result.error.reason : result.status).toBe('count');
  });

  it('lets only what fits through when uploads land at once', async () => {
    seedUsage('u1', MESH_QUOTA_BYTES - 2500, 0);
    const hashes = ['c', 'd', 'e', 'f'].map((c) => c.repeat(64));

    const results = await Promise.all(
      hashes.map((hash) => acquireAccountMesh(redis, hold('u1', hash, 1000)))
    );

    expect(results.filter((r) => r.status === 'acquired')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'over-quota')).toHaveLength(2);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: MESH_QUOTA_BYTES - 500, count: 2 });
  });

  it('registers its scripts once per client', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    await releaseAccountMesh(redis, 'u1', HASH_A);
    expect(fake.defineCommandCalls).toBe(2);
  });
});

describe('releaseAccountMesh', () => {
  beforeEach(() => {
    signIn('u2', 'tok-2');
  });

  it('frees the hold and its totals, and returns the holders left', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A, 700));
    await acquireAccountMesh(redis, hold('u2', HASH_A, 700, 'tok-2'));

    expect(await releaseAccountMesh(redis, 'u1', HASH_A)).toBe(1);
    expect(await getHeldMesh(redis, 'u1', HASH_A)).toBeNull();
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
    expect(await getMeshUsage(redis, 'u2')).toEqual({ bytes: 700, count: 1 });

    expect(await releaseAccountMesh(redis, 'u2', HASH_A)).toBe(0);
    expect(fake.sets.has(meshHoldersKey(HASH_A))).toBe(false);
  });

  it('is a no-op the second time', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    await acquireAccountMesh(redis, hold('u2', HASH_A, 1000, 'tok-2'));

    expect(await releaseAccountMesh(redis, 'u1', HASH_A)).toBe(1);
    expect(await releaseAccountMesh(redis, 'u1', HASH_A)).toBe(1);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
  });

  it('never leaves the totals negative', async () => {
    fake.hashes.set(
      userMeshesKey('u1'),
      new Map([[HASH_A, JSON.stringify({ sizeBytes: 50, url: 'u' })]])
    );

    await releaseAccountMesh(redis, 'u1', HASH_A);

    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
  });
});

describe('releaseAllAccountMeshes', () => {
  it('releases every hold in batches, leaving other accounts alone', async () => {
    signIn('u2', 'tok-2');
    const hashes = Array.from({ length: 1200 }, (_, i) => i.toString(16).padStart(64, '0'));
    for (const hash of hashes) await acquireAccountMesh(redis, hold('u1', hash, 10));
    await acquireAccountMesh(redis, hold('u2', hashes[0], 10, 'tok-2'));

    await releaseAllAccountMeshes(redis, 'u1');

    expect(fake.hscanCalls).toBeGreaterThan(1);
    expect(fake.hashes.has(userMeshesKey('u1'))).toBe(false);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 0, count: 0 });
    expect(fake.sets.has(meshHoldersKey(hashes[1]))).toBe(false);
    expect(fake.sets.get(meshHoldersKey(hashes[0]))).toEqual(new Set([accountMeshHolder('u2')]));
  });

  it('does nothing for an account that holds no files', async () => {
    await expect(releaseAllAccountMeshes(redis, 'nobody')).resolves.toBeUndefined();
  });
});

describe('getHeldMesh / getMeshUsage', () => {
  it('reads a malformed entry as not held, and missing totals as zero', async () => {
    fake.hashes.set(userMeshesKey('u1'), new Map([[HASH_B, '{"sizeBytes":"big"}']]));
    expect(await getHeldMesh(redis, 'u1', HASH_B)).toBeNull();
    expect(await getMeshUsage(redis, 'u2')).toEqual({ bytes: 0, count: 0 });
  });
});

describe('unheldMeshes', () => {
  beforeEach(() => {
    vi.stubEnv('MESH_STORE_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers the hashes the account does not hold, once each', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    fake.hashes.get(userMeshesKey('u1'))?.set(HASH_B, '{"sizeBytes":"big"}');
    const HASH_C = 'c'.repeat(64);

    expect(await unheldMeshes(redis, 'u1', [HASH_A, HASH_B, HASH_C, HASH_C])).toEqual([
      HASH_B,
      HASH_C,
    ]);
    expect(await unheldMeshes(redis, 'u2', [HASH_A])).toEqual([HASH_A]);
  });

  it('answers every hash while the mesh store is off', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    vi.stubEnv('MESH_STORE_ENABLED', 'false');
    expect(await unheldMeshes(redis, 'u1', [HASH_A])).toEqual([HASH_A]);
  });

  it('reads nothing for a payload that names no mesh', async () => {
    const hmget = vi.spyOn(fake, 'hmget');
    expect(await unheldMeshes(redis, 'u1', [])).toEqual([]);
    expect(hmget).not.toHaveBeenCalled();
  });
});

describe('holdShareMeshes / releaseShareMeshes', () => {
  it('counts a share among the holders beside the account, once per file', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    await holdShareMeshes(redis, 'share1', [HASH_A, HASH_A, HASH_B]);

    expect(fake.sets.get(meshHoldersKey(HASH_A))).toEqual(
      new Set([accountMeshHolder('u1'), shareMeshHolder('share1')])
    );
    expect(fake.sets.get(meshHoldersKey(HASH_B))).toEqual(new Set([shareMeshHolder('share1')]));
  });

  it("lets go of every file the share ever named, and only the share's hold", async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    await holdShareMeshes(redis, 'share1', [HASH_A]);
    await holdShareMeshes(redis, 'share1', [HASH_B]);
    await releaseShareMeshes(redis, 'share1');

    expect(fake.sets.get(meshHoldersKey(HASH_A))).toEqual(new Set([accountMeshHolder('u1')]));
    expect(fake.sets.has(meshHoldersKey(HASH_B))).toBe(false);
    expect(fake.sets.has(shareMeshesKey('share1'))).toBe(false);
    expect(await getMeshUsage(redis, 'u1')).toEqual({ bytes: 1000, count: 1 });
  });
});

describe('heldMeshUrls', () => {
  beforeEach(() => {
    vi.stubEnv('MESH_STORE_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers the CDN URL of each file the account holds, skipping the rest', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    fake.hashes.get(userMeshesKey('u1'))?.set(HASH_B, '{"sizeBytes":"big"}');
    const HASH_C = 'c'.repeat(64);

    expect(await heldMeshUrls(redis, 'u1', [HASH_A, HASH_B, HASH_C])).toEqual(
      new Map([[HASH_A, `https://blob/meshes/${HASH_A}`]])
    );
  });

  it('answers none while the mesh store is off', async () => {
    await acquireAccountMesh(redis, hold('u1', HASH_A));
    vi.stubEnv('MESH_STORE_ENABLED', 'false');
    expect(await heldMeshUrls(redis, 'u1', [HASH_A])).toEqual(new Map());
  });
});
