import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { checkQuota, getQuotaCaps } from './quota';
import { tombstone, upsertEntry } from './userIndex';

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
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => setKey(k, v)),
    hset: vi.fn(async (k: string, field: string, val: string) => hsetKey(k, field, val)),
    hget: vi.fn(async (k: string, field: string) => hashes.get(k)?.get(field) ?? null),
    hgetall: vi.fn(async (k: string) => {
      const h = hashes.get(k);
      if (!h) return {};
      return Object.fromEntries(h);
    }),
    pipeline: vi.fn(() => {
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
    }),
  } as unknown as Redis;
}

describe('checkQuota', () => {
  beforeEach(() => {
    mockRedis = makeRedisMock();
  });

  it('allows the first PUT when the index is empty', async () => {
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'put',
      sizeBytes: 1000,
    });
    expect(result.ok).toBe(true);
  });

  it('blocks PUT when adding would exceed the count cap', async () => {
    const { maxCount } = getQuotaCaps('layouts');
    for (let i = 0; i < maxCount; i++) {
      await upsertEntry(mockRedis, 'u1', 'layouts', `lay-${i}`, {
        modifiedAt: i,
        sizeBytes: 100,
      });
    }
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'put',
      sizeBytes: 100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('count');
      expect(result.error.current).toBe(maxCount + 1);
    }
  });

  it('blocks PUT when adding would exceed the bytes cap', async () => {
    const { maxBytes } = getQuotaCaps('layouts');
    await upsertEntry(mockRedis, 'u1', 'layouts', 'big', {
      modifiedAt: 1,
      sizeBytes: maxBytes - 100,
    });
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'put',
      sizeBytes: 200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('bytes');
  });

  it('allows replacing an existing entry without consuming an extra slot', async () => {
    const { maxCount } = getQuotaCaps('layouts');
    for (let i = 0; i < maxCount; i++) {
      await upsertEntry(mockRedis, 'u1', 'layouts', `lay-${i}`, {
        modifiedAt: i,
        sizeBytes: 100,
      });
    }
    // Already at the count cap, but replacing — should pass.
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'put',
      sizeBytes: 200,
      replacingId: 'lay-5',
    });
    expect(result.ok).toBe(true);
  });

  it('replacing frees the old size before adding the new size', async () => {
    const { maxBytes } = getQuotaCaps('layouts');
    await upsertEntry(mockRedis, 'u1', 'layouts', 'item', {
      modifiedAt: 1,
      sizeBytes: maxBytes - 100,
    });
    // Replace with something just under the cap — net change is small enough.
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'put',
      sizeBytes: maxBytes - 50,
      replacingId: 'item',
    });
    expect(result.ok).toBe(true);
  });

  it('tombstoned entries do not count toward the quota', async () => {
    const { maxCount } = getQuotaCaps('layouts');
    for (let i = 0; i < maxCount; i++) {
      await upsertEntry(mockRedis, 'u1', 'layouts', `lay-${i}`, {
        modifiedAt: i,
        sizeBytes: 100,
      });
    }
    await tombstone(mockRedis, 'u1', 'layouts', 'lay-0', 99999);
    // After deletion, count is at maxCount-1 — a new PUT should pass.
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'put',
      sizeBytes: 100,
    });
    expect(result.ok).toBe(true);
  });

  it('delete intents are never quota-blocked', async () => {
    const result = await checkQuota(mockRedis, 'u1', 'layouts', {
      op: 'delete',
      id: 'whatever',
    });
    expect(result.ok).toBe(true);
  });

  it('layouts and designs have independent quotas', async () => {
    const { maxCount } = getQuotaCaps('layouts');
    for (let i = 0; i < maxCount; i++) {
      await upsertEntry(mockRedis, 'u1', 'layouts', `lay-${i}`, {
        modifiedAt: i,
        sizeBytes: 100,
      });
    }
    // Layouts at cap — but a design should still go through.
    const result = await checkQuota(mockRedis, 'u1', 'designs', {
      op: 'put',
      sizeBytes: 100,
    });
    expect(result.ok).toBe(true);
  });
});
