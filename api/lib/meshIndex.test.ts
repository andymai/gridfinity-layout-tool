import { describe, it, expect, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import {
  accountMeshHolder,
  acquireAccountMesh,
  getHeldMesh,
  getHeldMeshes,
  releaseAccountMesh,
  releaseAllAccountMeshes,
} from './meshIndex';
import { meshHoldersKey, userMeshesKey } from './redisKeys';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const ENTRY = { sizeBytes: 1234, url: 'https://blob.example/meshes/a' };

type Reply = [Error | null, unknown];

class FakeRedis {
  hashes = new Map<string, Map<string, string>>();
  sets = new Map<string, Set<string>>();
  failNextExec: 'connection' | 'command' | null = null;

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key) ?? new Map<string, string>());
  }

  async hkeys(key: string): Promise<string[]> {
    return [...(this.hashes.get(key)?.keys() ?? [])];
  }

  hset(key: string, field: string, value: string): number {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    const added = hash.has(field) ? 0 : 1;
    hash.set(field, value);
    this.hashes.set(key, hash);
    return added;
  }

  hdel(key: string, field: string): number {
    const hash = this.hashes.get(key);
    const removed = hash?.delete(field) ? 1 : 0;
    if (hash?.size === 0) this.hashes.delete(key);
    return removed;
  }

  sadd(key: string, member: string): number {
    const set = this.sets.get(key) ?? new Set<string>();
    const added = set.has(member) ? 0 : 1;
    set.add(member);
    this.sets.set(key, set);
    return added;
  }

  srem(key: string, member: string): number {
    const set = this.sets.get(key);
    const removed = set?.delete(member) ? 1 : 0;
    if (set?.size === 0) this.sets.delete(key);
    return removed;
  }

  scard(key: string): number {
    return this.sets.get(key)?.size ?? 0;
  }

  pipeline(): Record<string, unknown> {
    const queue: (() => unknown)[] = [];
    const queued = (run: () => unknown): typeof chain => {
      queue.push(run);
      return chain;
    };
    const chain = {
      hset: (k: string, f: string, v: string) => queued(() => this.hset(k, f, v)),
      hdel: (k: string, f: string) => queued(() => this.hdel(k, f)),
      sadd: (k: string, m: string) => queued(() => this.sadd(k, m)),
      srem: (k: string, m: string) => queued(() => this.srem(k, m)),
      scard: (k: string) => queued(() => this.scard(k)),
      exec: async (): Promise<Reply[] | null> => {
        const failure = this.failNextExec;
        this.failNextExec = null;
        if (failure === 'connection') return null;
        if (failure === 'command') return queue.map(() => [new Error('WRONGTYPE'), null]);
        return queue.map((run) => [null, run()]);
      },
    };
    return chain;
  }
}

let fake: FakeRedis;
let redis: Redis;

beforeEach(() => {
  fake = new FakeRedis();
  redis = fake as unknown as Redis;
});

describe('acquireAccountMesh', () => {
  it('records the size and URL for the account and joins the holder set', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);

    expect(await getHeldMesh(redis, 'u1', HASH_A)).toEqual(ENTRY);
    expect(fake.sets.get(meshHoldersKey(HASH_A))).toEqual(new Set([accountMeshHolder('u1')]));
  });

  it('counts an account once however often it acquires', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);

    expect(fake.scard(meshHoldersKey(HASH_A))).toBe(1);
    expect(Object.keys(await getHeldMeshes(redis, 'u1'))).toEqual([HASH_A]);
  });

  it('throws when Redis drops the connection', async () => {
    fake.failNextExec = 'connection';
    await expect(acquireAccountMesh(redis, 'u1', HASH_A, ENTRY)).rejects.toThrow(
      'redis connection lost'
    );
  });

  it('throws when a command in the pipeline fails', async () => {
    fake.failNextExec = 'command';
    await expect(acquireAccountMesh(redis, 'u1', HASH_A, ENTRY)).rejects.toThrow('WRONGTYPE');
  });
});

describe('releaseAccountMesh', () => {
  it('frees the account entry and returns the holders left', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);
    await acquireAccountMesh(redis, 'u2', HASH_A, ENTRY);

    expect(await releaseAccountMesh(redis, 'u1', HASH_A)).toBe(1);
    expect(await getHeldMesh(redis, 'u1', HASH_A)).toBeNull();
    expect(await getHeldMesh(redis, 'u2', HASH_A)).toEqual(ENTRY);

    expect(await releaseAccountMesh(redis, 'u2', HASH_A)).toBe(0);
    expect(fake.sets.has(meshHoldersKey(HASH_A))).toBe(false);
  });

  it('is a no-op the second time, never counting below zero', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);
    await acquireAccountMesh(redis, 'u2', HASH_A, ENTRY);

    expect(await releaseAccountMesh(redis, 'u1', HASH_A)).toBe(1);
    expect(await releaseAccountMesh(redis, 'u1', HASH_A)).toBe(1);
    expect(await releaseAccountMesh(redis, 'u3', HASH_A)).toBe(1);
  });

  it('leaves the account other files', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);
    await acquireAccountMesh(redis, 'u1', HASH_B, ENTRY);

    await releaseAccountMesh(redis, 'u1', HASH_A);

    expect(Object.keys(await getHeldMeshes(redis, 'u1'))).toEqual([HASH_B]);
  });
});

describe('releaseAllAccountMeshes', () => {
  it('leaves every holder set the account joined, and only those', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);
    await acquireAccountMesh(redis, 'u1', HASH_B, ENTRY);
    await acquireAccountMesh(redis, 'u2', HASH_B, ENTRY);

    await releaseAllAccountMeshes(redis, 'u1');

    expect(fake.hashes.has(userMeshesKey('u1'))).toBe(false);
    expect(fake.sets.has(meshHoldersKey(HASH_A))).toBe(false);
    expect(fake.sets.get(meshHoldersKey(HASH_B))).toEqual(new Set([accountMeshHolder('u2')]));
  });

  it('does nothing for an account that holds no files', async () => {
    await expect(releaseAllAccountMeshes(redis, 'nobody')).resolves.toBeUndefined();
  });
});

describe('getHeldMeshes', () => {
  it('skips entries that do not parse', async () => {
    await acquireAccountMesh(redis, 'u1', HASH_A, ENTRY);
    fake.hset(userMeshesKey('u1'), HASH_B, '{"sizeBytes":"big"}');
    fake.hset(userMeshesKey('u1'), 'c'.repeat(64), 'not json');

    expect(await getHeldMeshes(redis, 'u1')).toEqual({ [HASH_A]: ENTRY });
    expect(await getHeldMesh(redis, 'u1', HASH_B)).toBeNull();
  });
});
