/**
 * Tests for /api/sync/account DELETE — the cascading account-deletion
 * endpoint. The most important property to verify is idempotency: the
 * same request repeated after partial failure must produce the same
 * end-state without throwing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let redisStore: Map<string, string>;
let redisHashes: Map<string, Map<string, string>>;
let redisSets: Map<string, Set<string>>;
let blobStore: Map<string, unknown>;

const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  del: vi.fn(async (...keys: string[]) => {
    let count = 0;
    for (const k of keys) {
      if (redisStore.delete(k)) count++;
      if (redisHashes.delete(k)) count++;
      if (redisSets.delete(k)) count++;
    }
    return count;
  }),
  smembers: vi.fn(async (k: string) => Array.from(redisSets.get(k) ?? [])),
  sadd: vi.fn(async (k: string, m: string) => {
    const s = redisSets.get(k) ?? new Set<string>();
    s.add(m);
    redisSets.set(k, s);
    return 1;
  }),
  hkeys: vi.fn(async (k: string) => Array.from(redisHashes.get(k)?.keys() ?? [])),
  hset: vi.fn(async (k: string, f: string, v: string) => {
    const h = redisHashes.get(k) ?? new Map<string, string>();
    h.set(f, v);
    redisHashes.set(k, h);
    return 1;
  }),
};

vi.mock('../lib/rateLimit', () => ({
  getRedis: () => mockRedis,
  getClientIP: () => '127.0.0.1',
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  })),
}));

vi.mock('../lib/session', () => ({
  requireSession: vi.fn(async () => ({
    userId: 'user-1',
    provider: 'google',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  })),
}));

const deleteBlobMock = vi.fn(async (path: string) => {
  blobStore.delete(path);
});

vi.mock('../lib/blobStore', () => ({
  putJson: vi.fn(),
  getJson: vi.fn(),
  deleteBlob: (path: string) => deleteBlobMock(path),
  headBlob: vi.fn(),
}));

interface MockRes {
  _status: number;
  _body: unknown;
  _headers: Record<string, string | string[] | number>;
  _ended: boolean;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
  end(): MockRes;
  setHeader(k: string, v: string | string[] | number): MockRes;
  getHeader(k: string): string | string[] | number | undefined;
}

function makeRes(): MockRes {
  return {
    _status: 0,
    _body: null,
    _headers: {},
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
    setHeader(k, v) {
      this._headers[k] = v;
      return this;
    },
    getHeader(k) {
      return this._headers[k];
    },
  };
}

function makeReq(opts: { method?: string } = {}): VercelRequest {
  return {
    method: opts.method ?? 'DELETE',
    query: {},
    headers: { 'sec-fetch-site': 'same-origin', 'x-requested-with': 'gflt' },
  } as unknown as VercelRequest;
}

function setHash(key: string, fields: Record<string, string>) {
  redisHashes.set(key, new Map(Object.entries(fields)));
}

function setSet(key: string, members: string[]) {
  redisSets.set(key, new Set(members));
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  redisSets = new Map();
  blobStore = new Map();
  vi.clearAllMocks();
  deleteBlobMock.mockImplementation(async (path: string) => {
    blobStore.delete(path);
  });
});

describe('DELETE /api/sync/account', () => {
  it('cascades to sessions, blobs, and KV keys', async () => {
    setSet('users:user-1:sessions', ['tok-a', 'tok-b']);
    redisStore.set('session:tok-a', 'a');
    redisStore.set('session:tok-b', 'b');
    redisStore.set('users:user-1:profile', '{}');
    redisStore.set('users:user-1:indexUpdatedAt', '12345');
    setHash('users:user-1:index:layouts', { 'lay-1': '{}', 'lay-2': '{}' });
    setHash('users:user-1:index:designs', { 'des-1': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});
    blobStore.set('users/user-1/layouts/lay-2.json', {});
    blobStore.set('users/user-1/designs/des-1.json', {});

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);

    expect(res._status).toBe(204);

    // Sessions deleted.
    expect(redisStore.has('session:tok-a')).toBe(false);
    expect(redisStore.has('session:tok-b')).toBe(false);

    // KV state gone.
    expect(redisStore.has('users:user-1:profile')).toBe(false);
    expect(redisStore.has('users:user-1:indexUpdatedAt')).toBe(false);
    expect(redisHashes.has('users:user-1:index:layouts')).toBe(false);
    expect(redisHashes.has('users:user-1:index:designs')).toBe(false);
    expect(redisSets.has('users:user-1:sessions')).toBe(false);

    // Blobs gone.
    expect(blobStore.size).toBe(0);

    // Cookie cleared.
    const cookieHeader = res._headers['Set-Cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader.map(String) : [String(cookieHeader)];
    expect(cookies.some((c) => c.includes('Max-Age=0'))).toBe(true);
  });

  it('is idempotent — replaying after partial failure is safe', async () => {
    // Run the cascade once.
    setSet('users:user-1:sessions', ['tok-a']);
    redisStore.set('session:tok-a', 'a');
    setHash('users:user-1:index:layouts', { 'lay-1': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});

    const { default: handler } = await import('./account');
    const firstRes = makeRes();
    await handler(makeReq(), firstRes as unknown as VercelResponse);
    expect(firstRes._status).toBe(204);

    // Replay with everything already gone — should still 204.
    const replayRes = makeRes();
    await handler(makeReq(), replayRes as unknown as VercelResponse);
    expect(replayRes._status).toBe(204);
  });

  it('continues the cascade when a single blob delete fails', async () => {
    setHash('users:user-1:index:layouts', { 'lay-1': '{}', 'lay-2': '{}' });
    blobStore.set('users/user-1/layouts/lay-1.json', {});
    blobStore.set('users/user-1/layouts/lay-2.json', {});

    deleteBlobMock.mockImplementationOnce(async () => {
      throw new Error('blob storage transient');
    });

    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);

    expect(res._status).toBe(204);
    // KV state still cleared even though a blob failed.
    expect(redisHashes.has('users:user-1:index:layouts')).toBe(false);
  });

  it('returns 405 for non-DELETE methods', async () => {
    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq({ method: 'POST' }), res as unknown as VercelResponse);
    expect(res._status).toBe(405);
  });

  it('returns 429 when rate-limited', async () => {
    const rateLimit = await import('../lib/rateLimit');
    (rateLimit.checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 30,
    });
    const { default: handler } = await import('./account');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });
});
