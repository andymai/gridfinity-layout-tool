/**
 * Tests for /api/sync/cutoutFolders/[id]. The LWW and tombstone rules are the
 * shared resource handler's; this covers the folder payload and the kill switch.
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
    query: { id: opts.id ?? DEFAULT_ID },
    body: opts.body,
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

const DEFAULT_ID = 'cfold_7a1e2b3c-4d5e-4f60-8a1b-2c3d4e5f6a7b';

beforeEach(() => {
  vi.stubEnv('CUTOUT_LIBRARY_SYNC_ENABLED', 'true');
  redisStore = new Map();
  redisHashes = new Map();
  blobStore.clear();
  vi.clearAllMocks();
});

async function send(method: string, body?: unknown, id?: string): Promise<MockRes> {
  const { default: handler } = await import('./[id]');
  const res = makeRes();
  await handler(makeReq({ method, id, body }), res as unknown as VercelResponse);
  return res;
}

const folder = (overrides: Record<string, unknown> = {}) => ({
  name: ' Sockets ',
  parentId: null,
  createdAt: '2026-11-22T10:00:00.000Z',
  ...overrides,
});

describe('PUT', () => {
  it('stores the name, parent and creation time', async () => {
    const res = await send('PUT', { cutoutFolder: folder(), modifiedAt: 1000 });
    expect(res._status).toBe(200);
    const stored = blobStore.get(`users/user-1/cutoutFolders/${DEFAULT_ID}.json`) as {
      cutoutFolder: unknown;
    };
    expect(stored.cutoutFolder).toEqual({
      name: 'Sockets',
      parentId: null,
      createdAt: '2026-11-22T10:00:00.000Z',
    });
  });

  it('refuses an empty name, a layout folder parent, and itself as its parent', async () => {
    expect(
      (await send('PUT', { cutoutFolder: folder({ name: ' ' }), modifiedAt: 1 }))._status
    ).toBe(400);
    expect(
      (await send('PUT', { cutoutFolder: folder({ parentId: 'folder_1_a' }), modifiedAt: 1 }))
        ._status
    ).toBe(400);
    expect(
      (await send('PUT', { cutoutFolder: folder({ parentId: DEFAULT_ID }), modifiedAt: 1 }))._status
    ).toBe(400);
  });
});

describe('kill switch', () => {
  it('answers 503 while CUTOUT_LIBRARY_SYNC_ENABLED is unset', async () => {
    vi.stubEnv('CUTOUT_LIBRARY_SYNC_ENABLED', '');
    const res = await send('PUT', { cutoutFolder: folder(), modifiedAt: 1000 });
    expect(res._status).toBe(503);
  });
});
