/**
 * Tests for /api/sync/folders/[id]. The LWW + tombstone state machine is the
 * shared resource handler's; this covers the folder payload contract.
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
    query: { id: opts.id ?? 'folder_1771464121030_9ltk1f' },
    body: opts.body,
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

async function put(body: unknown, id?: string): Promise<MockRes> {
  const { default: handler } = await import('./[id]');
  const res = makeRes();
  await handler(makeReq({ method: 'PUT', id, body }), res as unknown as VercelResponse);
  return res;
}

describe('PUT', () => {
  it('stores the name, parent and creation time in a schema-1 envelope', async () => {
    const res = await put({
      folder: { name: '  Study ', parentId: null, createdAt: 900 },
      modifiedAt: 1000,
    });
    expect(res._status).toBe(200);
    const body = res._body as { envelope: { schemaVersion: number; folder: unknown } };
    expect(body.envelope.schemaVersion).toBe(1);
    expect(body.envelope.folder).toEqual({ name: 'Study', parentId: null, createdAt: 900 });
  });

  it('keeps a parent pointer and a hex colour, and drops anything else', async () => {
    const res = await put({
      folder: {
        name: 'Desk',
        parentId: 'folder_1771464121030_abc',
        color: '#ff8800',
        createdAt: 900,
        layoutIds: ['x'],
      },
      modifiedAt: 1000,
    });
    expect(res._status).toBe(200);
    const stored = [...blobStore.values()][0] as { folder: Record<string, unknown> };
    expect(stored.folder).toEqual({
      name: 'Desk',
      parentId: 'folder_1771464121030_abc',
      color: '#ff8800',
      createdAt: 900,
    });
  });

  it('caps the name at 32 characters and falls back to modifiedAt for a missing createdAt', async () => {
    const res = await put({ folder: { name: 'x'.repeat(40) }, modifiedAt: 1000 });
    expect(res._status).toBe(200);
    const body = res._body as { envelope: { folder: { name: string; createdAt: number } } };
    expect(body.envelope.folder.name).toHaveLength(32);
    expect(body.envelope.folder.createdAt).toBe(1000);
  });

  it('rejects an empty name, a malformed parent, a non-object and a bad id', async () => {
    expect((await put({ folder: { name: '   ' }, modifiedAt: 1000 }))._status).toBe(400);
    expect((await put({ folder: { name: 'A', parentId: '../x' }, modifiedAt: 1000 }))._status).toBe(
      400
    );
    expect((await put({ folder: 'nope', modifiedAt: 1000 }))._status).toBe(400);
    expect((await put({ folder: { name: 'A' }, modifiedAt: 1000 }, 'notafolder'))._status).toBe(
      400
    );
  });
});

describe('GET / DELETE', () => {
  it('round-trips the envelope and tombstones on delete', async () => {
    await put({ folder: { name: 'Study', parentId: null, createdAt: 900 }, modifiedAt: 1000 });
    const { default: handler } = await import('./[id]');
    const got = makeRes();
    await handler(makeReq({ method: 'GET' }), got as unknown as VercelResponse);
    expect(got._status).toBe(200);
    expect((got._body as { envelope: { folder: { name: string } } }).envelope.folder.name).toBe(
      'Study'
    );

    const del = makeRes();
    await handler(makeReq({ method: 'DELETE' }), del as unknown as VercelResponse);
    expect(del._status).toBe(204);
    const after = makeRes();
    await handler(makeReq({ method: 'GET' }), after as unknown as VercelResponse);
    expect(after._status).toBe(410);
  });
});
