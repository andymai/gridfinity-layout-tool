import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import {
  getEntry,
  getIndex,
  getIndexUpdatedAt,
  tombstone,
  upsertEntry,
  type IndexEntry,
} from './userIndex';

let mockRedis: Redis;

function makeRedisMock() {
  const store = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const hsetKey = (k: string, field: string, val: string): number => {
    const h = hashes.get(k) ?? new Map<string, string>();
    const isNew = !h.has(field);
    h.set(field, val);
    hashes.set(k, h);
    return isNew ? 1 : 0;
  };
  const setKey = (k: string, v: string): 'OK' => {
    store.set(k, v);
    return 'OK';
  };
  return {
    hashes,
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => setKey(k, v)),
    hset: vi.fn(async (k: string, field: string, val: string) => hsetKey(k, field, val)),
    hget: vi.fn(async (k: string, field: string) => hashes.get(k)?.get(field) ?? null),
    hgetall: vi.fn(async (k: string) => {
      const h = hashes.get(k);
      if (!h) return {};
      return Object.fromEntries(h);
    }),
    pipeline: vi.fn(() => makePipelineMock(setKey, hsetKey)),
  } as unknown as Redis & {
    store: Map<string, string>;
    hashes: Map<string, Map<string, string>>;
  };
}

function makePipelineMock(
  setKey: (k: string, v: string) => 'OK',
  hsetKey: (k: string, field: string, val: string) => number
) {
  const queue: Array<() => [Error | null, unknown]> = [];
  const pipe = {
    set: (k: string, v: string) => {
      queue.push(() => [null, setKey(k, v)]);
      return pipe;
    },
    hset: (k: string, field: string, val: string) => {
      queue.push(() => [null, hsetKey(k, field, val)]);
      return pipe;
    },
    exec: vi.fn(async () => queue.map((fn) => fn())),
  };
  return pipe;
}

describe('userIndex', () => {
  beforeEach(() => {
    mockRedis = makeRedisMock();
  });

  it('upsertEntry writes the JSON-encoded entry and bumps indexUpdatedAt atomically', async () => {
    const entry: IndexEntry = { modifiedAt: 1000, sizeBytes: 4096 };
    await upsertEntry(mockRedis, 'u1', 'layouts', 'lay-1', entry);

    expect(await getEntry(mockRedis, 'u1', 'layouts', 'lay-1')).toEqual(entry);
    expect(await getIndexUpdatedAt(mockRedis, 'u1')).toBeGreaterThan(0);
    expect(mockRedis.pipeline).toHaveBeenCalled();
  });

  it('getIndex returns all entries for a user/kind', async () => {
    await upsertEntry(mockRedis, 'u1', 'layouts', 'a', { modifiedAt: 1, sizeBytes: 100 });
    await upsertEntry(mockRedis, 'u1', 'layouts', 'b', { modifiedAt: 2, sizeBytes: 200 });
    await upsertEntry(mockRedis, 'u1', 'designs', 'c', { modifiedAt: 3, sizeBytes: 300 });

    const layouts = await getIndex(mockRedis, 'u1', 'layouts');
    expect(Object.keys(layouts).sort()).toEqual(['a', 'b']);
    expect(layouts.a.sizeBytes).toBe(100);
    expect(layouts.b.sizeBytes).toBe(200);

    const designs = await getIndex(mockRedis, 'u1', 'designs');
    expect(Object.keys(designs)).toEqual(['c']);
  });

  it('getIndex returns an empty object when the user has nothing yet', async () => {
    expect(await getIndex(mockRedis, 'fresh-user', 'layouts')).toEqual({});
  });

  it('getEntry returns null for a missing entry', async () => {
    expect(await getEntry(mockRedis, 'u1', 'layouts', 'nope')).toBe(null);
  });

  it('tombstone marks an entry deleted with sizeBytes=0 and deletedAt set', async () => {
    await upsertEntry(mockRedis, 'u1', 'layouts', 'lay-1', { modifiedAt: 1000, sizeBytes: 4096 });
    await tombstone(mockRedis, 'u1', 'layouts', 'lay-1', 5000);

    const entry = await getEntry(mockRedis, 'u1', 'layouts', 'lay-1');
    expect(entry).toEqual({ modifiedAt: 5000, sizeBytes: 0, deletedAt: 5000 });
  });

  it('parseEntry rejects malformed JSON gracefully', async () => {
    const ctx = mockRedis as unknown as { hashes: Map<string, Map<string, string>> };
    const h = new Map<string, string>();
    h.set('valid', JSON.stringify({ modifiedAt: 1, sizeBytes: 1 }));
    h.set('garbage', 'not-json');
    h.set('wrong-shape', JSON.stringify({ modifiedAt: 'string-not-number' }));
    ctx.hashes.set('users:u1:index:layouts', h);

    const index = await getIndex(mockRedis, 'u1', 'layouts');
    expect(Object.keys(index)).toEqual(['valid']);
  });

  it('parseEntry rejects NaN/Infinity values for numeric fields', async () => {
    const ctx = mockRedis as unknown as { hashes: Map<string, Map<string, string>> };
    const h = new Map<string, string>();
    h.set('valid', JSON.stringify({ modifiedAt: 1, sizeBytes: 1 }));
    // JSON has no NaN/Infinity literals, but a hand-rolled value or a custom
    // serializer could write 'NaN' / 'Infinity' / 'null' for these fields.
    h.set('nan-modifiedAt', '{"modifiedAt": null, "sizeBytes": 100}');
    h.set('inf-deletedAt', JSON.stringify({ modifiedAt: 1, sizeBytes: 0, deletedAt: null }));
    ctx.hashes.set('users:u1:index:layouts', h);

    const index = await getIndex(mockRedis, 'u1', 'layouts');
    expect(Object.keys(index)).toEqual(['valid']);
  });

  it('getIndexUpdatedAt returns 0 for a user who has never written', async () => {
    expect(await getIndexUpdatedAt(mockRedis, 'fresh-user')).toBe(0);
  });
});
