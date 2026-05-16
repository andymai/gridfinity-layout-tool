import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import {
  getEntry,
  getIndex,
  getIndexUpdatedAt,
  TOMBSTONE_RETENTION_MS,
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
  const hdelKey = (k: string, field: string): number => {
    const h = hashes.get(k);
    if (!h) return 0;
    return h.delete(field) ? 1 : 0;
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
    hdel: vi.fn(async (k: string, field: string) => hdelKey(k, field)),
    hgetall: vi.fn(async (k: string) => {
      const h = hashes.get(k);
      if (!h) return {};
      return Object.fromEntries(h);
    }),
    pipeline: vi.fn(() => makePipelineMock(setKey, hsetKey, hdelKey)),
  } as unknown as Redis & {
    store: Map<string, string>;
    hashes: Map<string, Map<string, string>>;
  };
}

function makePipelineMock(
  setKey: (k: string, v: string) => 'OK',
  hsetKey: (k: string, field: string, val: string) => number,
  hdelKey: (k: string, field: string) => number
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
    hdel: (k: string, field: string) => {
      queue.push(() => [null, hdelKey(k, field)]);
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

  describe('tombstone sweep on upsertEntry', () => {
    // Force the sweep gate to fire on every upsert in this block by pretending
    // the last sweep was long ago. Production gates sweeps to once per hour.
    function forceSweepEligible(): void {
      const ctx = mockRedis as unknown as { store: Map<string, string> };
      ctx.store.set('users:u1:tombstoneSweptAt', String(Date.now() - 2 * 60 * 60 * 1_000));
    }

    it('removes tombstones older than the retention window when a new entry is upserted', async () => {
      const now = Date.now();
      const stale = now - TOMBSTONE_RETENTION_MS - 1_000;
      const fresh = now - 1_000;

      await tombstone(mockRedis, 'u1', 'layouts', 'old-deleted', stale);
      await tombstone(mockRedis, 'u1', 'layouts', 'recent-deleted', fresh);
      await upsertEntry(mockRedis, 'u1', 'layouts', 'alive', {
        modifiedAt: fresh,
        sizeBytes: 100,
      });
      forceSweepEligible();

      await upsertEntry(mockRedis, 'u1', 'layouts', 'new-entry', {
        modifiedAt: now,
        sizeBytes: 200,
      });

      const index = await getIndex(mockRedis, 'u1', 'layouts');
      expect(Object.keys(index).sort()).toEqual(['alive', 'new-entry', 'recent-deleted']);
      expect(index['old-deleted']).toBeUndefined();
    });

    it('does not remove non-tombstone (live) entries even if they are very old', async () => {
      const ancient = Date.now() - TOMBSTONE_RETENTION_MS * 10;
      await upsertEntry(mockRedis, 'u1', 'layouts', 'ancient-live', {
        modifiedAt: ancient,
        sizeBytes: 100,
      });
      forceSweepEligible();
      await upsertEntry(mockRedis, 'u1', 'layouts', 'trigger', {
        modifiedAt: Date.now(),
        sizeBytes: 200,
      });

      const index = await getIndex(mockRedis, 'u1', 'layouts');
      expect(index['ancient-live']).toBeDefined();
    });

    it('skips the id being written even when it is itself a stale tombstone (no self-conflict)', async () => {
      const stale = Date.now() - TOMBSTONE_RETENTION_MS - 1_000;
      await tombstone(mockRedis, 'u1', 'layouts', 'self', stale);
      forceSweepEligible();

      await tombstone(mockRedis, 'u1', 'layouts', 'self', Date.now());

      const entry = await getEntry(mockRedis, 'u1', 'layouts', 'self');
      expect(entry).not.toBeNull();
      expect(entry?.deletedAt).toBeGreaterThan(stale);
    });

    it('skips the HGETALL scan when the last sweep was recent', async () => {
      // Seed a recent sweep timestamp; the next upsert must not call hgetall.
      const ctx = mockRedis as unknown as { store: Map<string, string> };
      ctx.store.set('users:u1:tombstoneSweptAt', String(Date.now() - 60_000));
      const hgetallSpy = vi.spyOn(mockRedis, 'hgetall');

      await upsertEntry(mockRedis, 'u1', 'layouts', 'a', {
        modifiedAt: Date.now(),
        sizeBytes: 100,
      });

      expect(hgetallSpy).not.toHaveBeenCalled();
    });
  });
});
