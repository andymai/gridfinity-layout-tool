/**
 * Tests for /api/sync/designs/[id]. The LWW + tombstone state machine is
 * shared with /api/sync/layouts so we don't re-cover every quadrant — the
 * focus here is the designer-specific validation contract.
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
    query: { id: opts.id ?? 'lszwz1k7v-8j2kqp1' },
    body: opts.body,
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

const VALID_DESIGN = {
  width: 2,
  depth: 2,
  height: 6,
  style: 'standard',
  scoop: true,
  base: {
    style: 'magnet',
    magnetDiameter: 6.2,
    magnetDepth: 2.4,
    screwDiameter: 3,
    stackingLip: true,
  },
  compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
  label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
  walls: { front: 0, back: 0, left: 0, right: 0 },
  inserts: [] as Record<string, unknown>[],
};

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

describe('PUT', () => {
  it('creates a new design entry on first write', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { design: VALID_DESIGN, modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(200);
    const body = res._body as { envelope: { schemaVersion: number; design: unknown } };
    expect(body.envelope.schemaVersion).toBe(1);
  });

  it('rejects an invalid BinParams payload with 400', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({
        method: 'PUT',
        body: { design: { ...VALID_DESIGN, width: 999 }, modifiedAt: 1000 },
      }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it('rejects when modifiedAt is missing or non-numeric', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { design: VALID_DESIGN, modifiedAt: 'now' } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });

  it('rejects 409 when remote is newer', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { design: VALID_DESIGN, modifiedAt: 5000 } }),
      makeRes() as unknown as VercelResponse
    );
    const res = makeRes();
    await handler(
      makeReq({ method: 'PUT', body: { design: VALID_DESIGN, modifiedAt: 1000 } }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(409);
  });
});

describe('GET / DELETE roundtrip', () => {
  it('round-trips PUT → GET → DELETE → GET=410', async () => {
    const { default: handler } = await import('./[id]');
    await handler(
      makeReq({ method: 'PUT', body: { design: VALID_DESIGN, modifiedAt: 1000 } }),
      makeRes() as unknown as VercelResponse
    );
    const getRes = makeRes();
    await handler(makeReq({ method: 'GET' }), getRes as unknown as VercelResponse);
    expect(getRes._status).toBe(200);
    const delRes = makeRes();
    await handler(makeReq({ method: 'DELETE' }), delRes as unknown as VercelResponse);
    expect(delRes._status).toBe(204);
    const goneRes = makeRes();
    await handler(makeReq({ method: 'GET' }), goneRes as unknown as VercelResponse);
    expect(goneRes._status).toBe(410);
  });
});

describe('id validation', () => {
  it('returns 400 for a malformed id', async () => {
    const { default: handler } = await import('./[id]');
    const res = makeRes();
    await handler(
      makeReq({ method: 'GET', id: '!!not-valid!!' }),
      res as unknown as VercelResponse
    );
    expect(res._status).toBe(400);
  });
});
