/**
 * Tests for /api/sync/layouts/[id]. Covers GET/PUT/DELETE plus the LWW +
 * tombstone state machine.
 *
 * Mocks happen at: rateLimit (Redis + checkRateLimit), session
 * (requireSession), blobStore (putJson/getJson/deleteBlob). We don't
 * mock userIndex / quota — they run against the same in-memory Redis,
 * exercising the full state-write path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let redisStore: Map<string, string>;
let redisHashes: Map<string, Map<string, string>>;

const blobStore = new Map<string, unknown>();

const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  hget: vi.fn(async (k: string, f: string) => redisHashes.get(k)?.get(f) ?? null),
  hset: vi.fn(async (k: string, f: string, v: string) => {
    const h = redisHashes.get(k) ?? new Map<string, string>();
    h.set(f, v);
    redisHashes.set(k, h);
    return 1;
  }),
  hgetall: vi.fn(async (k: string) => {
    const h = redisHashes.get(k);
    return h ? Object.fromEntries(h) : {};
  }),
  pipeline: vi.fn(() => makePipeline()),
};

function makePipeline() {
  const queue: Array<() => [Error | null, unknown]> = [];
  const pipe = {
    set: (k: string, v: string) => {
      queue.push(() => {
        redisStore.set(k, v);
        return [null, 'OK'];
      });
      return pipe;
    },
    hset: (k: string, f: string, v: string) => {
      queue.push(() => {
        const h = redisHashes.get(k) ?? new Map<string, string>();
        h.set(f, v);
        redisHashes.set(k, h);
        return [null, 1];
      });
      return pipe;
    },
    exec: vi.fn(async () => queue.map((fn) => fn())),
  };
  return pipe;
}

vi.mock('../../lib/rateLimit', () => ({
  getRedis: () => mockRedis,
  getClientIP: () => '127.0.0.1',
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock('../../lib/session', () => ({
  requireSession: vi.fn(async () => ({
    userId: 'user-1',
    provider: 'google',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  })),
}));

vi.mock('../../lib/blobStore', () => ({
  putJson: vi.fn(async (path: string, value: unknown) => {
    blobStore.set(path, value);
    return { url: `https://blob/${path}` };
  }),
  getJson: vi.fn(async (path: string) => blobStore.get(path) ?? null),
  deleteBlob: vi.fn(async (path: string) => {
    blobStore.delete(path);
  }),
  headBlob: vi.fn(async () => null),
}));

interface MockRes {
  _status: number;
  _body: unknown;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  end(): MockRes;
  setHeader(): MockRes;
}

function makeRes(): MockRes {
  return {
    _status: 0,
    _body: null,
    _ended: false,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    end() {
      this._ended = true;
      return this;
    },
    setHeader() {
      return this;
    },
  };
}

function makeReq(opts: { method?: string; id?: string; body?: unknown }): VercelRequest {
  return {
    method: opts.method ?? 'GET',
    // Default to a valid base36-timestamp id: timestamp + '-' + 7-char random.
    query: { id: opts.id ?? 'lszwz1k7v-8j2kqp1' },
    body: opts.body,
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

const VALID_LAYOUT = {
  version: '1.0',
  name: 'Test Layout',
  drawer: { width: 5, depth: 5, height: 3 },
  bins: [],
  layers: [{ id: 'layer-1', name: 'Layer 1', height: 2 }],
  categories: [{ id: 'cat-1', name: 'Default', color: '#ff0000' }],
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
};

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

describe('GET', () => {
  it('returns 404 when no entry exists', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(404);
  });

  it('returns the envelope and index entry for a live layout', async () => {
    // Seed a live layout.
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({
        method: 'PUT',
        body: { layout: VALID_LAYOUT, modifiedAt: 1000 },
      }),
      makeRes() as unknown as VercelResponse
    );

    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    const body = res._body as {
      envelope: { modifiedAt: number };
      indexEntry: { modifiedAt: number };
    };
    expect(body.envelope.modifiedAt).toBe(1000);
    expect(body.indexEntry.modifiedAt).toBe(1000);
  });

  it('returns 410 Gone when the entry is tombstoned', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);

    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(410);
  });
});

describe('PUT — LWW + tombstone', () => {
  it('creates a new entry on first write', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
  });

  it('rejects with 409 when the existing entry is newer (stale write)', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 5000 } }),
      makeRes() as unknown as VercelResponse
    );

    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(409);
    const body = res._body as { stored: { modifiedAt: number } };
    expect(body.stored.modifiedAt).toBe(5000);
  });

  it('accepts a write whose modifiedAt is newer than the existing entry', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );

    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 2000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
  });

  it('rejects with 410 when a stale edit would resurrect a newer tombstone', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    // Delete (tombstone now ~ Date.now())
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);
    // Stale edit (modifiedAt < tombstone) → 410.
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 500 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(410);
  });

  it('allows a newer-than-tombstone edit to resurrect the entry', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: Date.now() + 60_000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
  });

  it('equal-ms LWW: tiebreaker is deterministic and complementary across orderings', async () => {
    const { default: handler } = await import('./[id]');
    const A = { ...VALID_LAYOUT, name: 'Aardvark' };
    const B = { ...VALID_LAYOUT, name: 'Zebra' };

    await handler(
      makeReq({ method: 'PUT', body: { layout: A, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    const res1 = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: B, modifiedAt: 1000 } }),
      res1 as unknown as VercelResponse
    );

    redisStore = new Map();
    redisHashes = new Map();
    blobStore.clear();
    await handler(
      makeReq({ method: 'PUT', body: { layout: B, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    const res2 = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: A, modifiedAt: 1000 } }),
      res2 as unknown as VercelResponse
    );

    // Asymmetry across orderings proves determinism: auto-409 yields [409,409], unconditional [200,200].
    const statuses = [res1._status, res2._status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('equal-ms LWW: identical payloads return 409 (no unnecessary write)', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(409);
  });

  it('rejects 400 when modifiedAt is missing or non-numeric', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 'now' } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });
});

describe('DELETE', () => {
  it('returns 204 and tombstones an existing layout', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res as unknown as VercelResponse);
    expect(res._status).toBe(204);

    // GET now yields 410.
    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(410);
  });

  it('is idempotent: 204 even when nothing exists', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(makeReq({ method: 'DELETE' }), res as unknown as VercelResponse);
    expect(res._status).toBe(204);
  });

  it('is idempotent on repeated DELETE: skips deleteBlob on already-tombstoned entries', async () => {
    const { default: handler } = await import('./[id]');
    const blobStoreMod = await import('../../lib/blobStore');
    const deleteBlobMock = blobStoreMod.deleteBlob as ReturnType<typeof vi.fn>;

    // First delete (live → tombstone) hits deleteBlob once.
    await handler(
      makeReq({ method: 'PUT', body: { layout: VALID_LAYOUT, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    await handler(makeReq({ method: 'DELETE' }), makeRes() as unknown as VercelResponse);
    const callsAfterFirst = deleteBlobMock.mock.calls.length;

    // Second delete (already tombstoned) must NOT touch deleteBlob.
    const secondRes = makeRes();
    await handler(makeReq({ method: 'DELETE' }), secondRes as unknown as VercelResponse);
    expect(secondRes._status).toBe(204);
    expect(deleteBlobMock.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('id validation', () => {
  it('returns 400 for a malformed id', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'GET', id: 'not!a$valid_id' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it('accepts a UUID', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'GET', id: '12345678-1234-1234-1234-123456789abc' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(404); // valid id, just no entry
  });
});

describe('rate limiting', () => {
  it('returns 429 when the limiter rejects', async () => {
    const rateLimit = await import('../../lib/rateLimit');
    (rateLimit.checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 30,
    });
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });
});

describe('auth', () => {
  it('does nothing when requireSession returns null (handler returns)', async () => {
    const session = await import('../../lib/session');
    (session.requireSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    // requireSession is responsible for sending the 401 response — handler
    // just bails. This test asserts the handler doesn't proceed past auth.
    await handler(makeReq({ method: 'GET' }), res as unknown as VercelResponse);
    expect(res._status).toBe(0);
  });
});
