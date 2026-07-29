import { describe, it, expect } from 'vitest';
import type Redis from 'ioredis';
import { hgetallMany } from '../lib/redis';

/**
 * Pipeline stub recording how many batches were flushed, so the test can assert
 * the reads were actually batched rather than issued one per key.
 */
function redisStub(data: Record<string, Record<string, string>>) {
  const batches: string[][] = [];
  const redis = {
    pipeline() {
      const keys: string[] = [];
      return {
        hgetall(key: string) {
          keys.push(key);
        },
        async exec() {
          batches.push([...keys]);
          return keys.map((k) => [null, data[k] ?? {}] as [null, Record<string, string>]);
        },
      };
    },
  } as unknown as Redis;
  return { redis, batches };
}

describe('hgetallMany', () => {
  it('returns the same mapping a per-key serial read would', async () => {
    const data = {
      'users:a:index:layouts': { l1: '{"modifiedAt":1,"sizeBytes":2}' },
      'users:b:index:layouts': { l2: '{"modifiedAt":3,"sizeBytes":4}' },
      'users:c:index:layouts': {},
    };
    const { redis } = redisStub(data);

    const out = await hgetallMany(redis, Object.keys(data));

    expect(out.size).toBe(3);
    expect(out.get('users:a:index:layouts')).toEqual(data['users:a:index:layouts']);
    expect(out.get('users:b:index:layouts')).toEqual(data['users:b:index:layouts']);
    expect(out.get('users:c:index:layouts')).toEqual({});
  });

  it('batches keys into chunks instead of one round trip per key', async () => {
    const keys = Array.from({ length: 250 }, (_, i) => `users:u${i}:index:layouts`);
    const { redis, batches } = redisStub({});

    await hgetallMany(redis, keys, 100);

    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it('reports progress per flushed chunk', async () => {
    const keys = Array.from({ length: 5 }, (_, i) => `k${i}`);
    const { redis } = redisStub({});
    const seen: number[] = [];

    await hgetallMany(redis, keys, 2, (done) => seen.push(done));

    expect(seen).toEqual([2, 4, 5]);
  });

  it('handles an empty key list without a round trip', async () => {
    const { redis, batches } = redisStub({});

    const out = await hgetallMany(redis, []);

    expect(out.size).toBe(0);
    expect(batches).toHaveLength(0);
  });

  it('surfaces a per-command error rather than returning a partial map', async () => {
    const redis = {
      pipeline: () => ({
        hgetall() {},
        async exec() {
          return [[new Error('WRONGTYPE'), null]];
        },
      }),
    } as unknown as Redis;

    await expect(hgetallMany(redis, ['k'])).rejects.toThrow('WRONGTYPE');
  });

  it('throws when the pipeline itself fails', async () => {
    const redis = {
      pipeline: () => ({
        hgetall() {},
        async exec() {
          return null;
        },
      }),
    } as unknown as Redis;

    await expect(hgetallMany(redis, ['k'])).rejects.toThrow('pipeline failed');
  });
});
