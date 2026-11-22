/**
 * Tests for /api/sync/cutoutItems/[id]. The LWW and tombstone rules are the
 * shared resource handler's; this covers the item payload and the kill switch.
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

const DEFAULT_ID = 'clib_0b5f1c9e-3c1a-4a7e-9d2b-6f1e2a3b4c5d';

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

const cutout = {
  id: 'a',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: 'Tape',
  groupId: null,
};

const item = (overrides: Record<string, unknown> = {}) => ({
  name: '  Tape roll ',
  folderId: null,
  createdAt: '2026-11-22T10:00:00.000Z',
  content: { params: { cutouts: [cutout], cutoutGroupNames: {}, ignored: true } },
  ...overrides,
});

describe('PUT', () => {
  it('stores the cleaned item in a schema-1 envelope and indexes it', async () => {
    const res = await send('PUT', { cutoutItem: item(), modifiedAt: 1000 });
    expect(res._status).toBe(200);
    const stored = blobStore.get(`users/user-1/cutoutItems/${DEFAULT_ID}.json`) as {
      cutoutItem: { name: string; content: { params: Record<string, unknown> } };
      schemaVersion: number;
    };
    expect(stored.schemaVersion).toBe(1);
    expect(stored.cutoutItem.name).toBe('Tape roll');
    expect(Object.keys(stored.cutoutItem.content.params).sort()).toEqual([
      'cutoutGroupNames',
      'cutouts',
    ]);
    expect(redisHashes.get('users:user-1:index:cutoutItems')?.has(DEFAULT_ID)).toBe(true);
  });

  it('refuses an item with no cutouts, a bad folder, or a broken cutout', async () => {
    const empty = await send('PUT', {
      cutoutItem: item({ content: { params: { cutouts: [] } } }),
      modifiedAt: 1000,
    });
    expect(empty._status).toBe(400);
    const folder = await send('PUT', {
      cutoutItem: item({ folderId: 'folder_1' }),
      modifiedAt: 1000,
    });
    expect(folder._status).toBe(400);
    const broken = await send('PUT', {
      cutoutItem: item({ content: { params: { cutouts: [{ ...cutout, color: 'red' }] } } }),
      modifiedAt: 1000,
    });
    expect(broken._status).toBe(400);
  });

  it('refuses a mesh ref the account does not hold', async () => {
    const res = await send('PUT', {
      cutoutItem: item({
        content: {
          params: {
            cutouts: [{ ...cutout, shape: 'mesh', meshId: 'm1' }],
            meshAssets: {
              m1: {
                name: 'tool',
                hash: 'a'.repeat(64),
                triangleCount: 12,
                sizeMm: { x: 10, y: 10, z: 10 },
                bytes: 600,
              },
            },
          },
        },
      }),
      modifiedAt: 1000,
    });
    expect(res._status).toBe(424);
  });

  it('refuses an id that is not a library item id', async () => {
    const res = await send('PUT', { cutoutItem: item(), modifiedAt: 1000 }, 'folder_1');
    expect(res._status).toBe(400);
  });
});

describe('kill switch', () => {
  it('answers 503 to every method unless CUTOUT_LIBRARY_SYNC_ENABLED is true', async () => {
    vi.stubEnv('CUTOUT_LIBRARY_SYNC_ENABLED', '1');
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await send(method, { cutoutItem: item(), modifiedAt: 1000 });
      expect(res._status).toBe(503);
    }
    expect(blobStore.size).toBe(0);
  });
});
