import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let redisStore: Map<string, string>;
let redisHashes: Map<string, Map<string, string>>;

const mockRedis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return 'OK';
  }),
  hgetall: vi.fn(async (k: string) => {
    const h = redisHashes.get(k);
    return h ? Object.fromEntries(h) : {};
  }),
  pipeline: vi.fn(() => {
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

function makeReq(opts: { ifModifiedSince?: string } = {}): VercelRequest {
  const headers: Record<string, string> = {};
  if (opts.ifModifiedSince) headers['if-modified-since'] = opts.ifModifiedSince;
  return {
    method: 'GET',
    query: {},
    headers,
  } as unknown as VercelRequest;
}

async function seedEntry(
  kind: 'layouts' | 'designs',
  id: string,
  modifiedAt: number
): Promise<void> {
  const userIndex = await import('../lib/userIndex');
  await userIndex.upsertEntry(mockRedis as never, 'user-1', kind, id, {
    modifiedAt,
    sizeBytes: 100,
  });
}

beforeEach(() => {
  redisStore = new Map();
  redisHashes = new Map();
  vi.clearAllMocks();
});

describe('GET /api/sync/manifest', () => {
  it('returns empty manifest with indexUpdatedAt=0 for a fresh user', async () => {
    const { default: handler } = await import('./manifest');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    expect(res._body).toEqual({ layouts: {}, designs: {}, indexUpdatedAt: 0 });
  });

  it('returns the index hashes plus indexUpdatedAt', async () => {
    await seedEntry('layouts', 'lay-1', 1000);
    await seedEntry('designs', 'des-1', 2000);
    const { default: handler } = await import('./manifest');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
    const body = res._body as {
      layouts: Record<string, { modifiedAt: number }>;
      designs: Record<string, { modifiedAt: number }>;
      indexUpdatedAt: number;
    };
    expect(body.layouts['lay-1'].modifiedAt).toBe(1000);
    expect(body.designs['des-1'].modifiedAt).toBe(2000);
    expect(body.indexUpdatedAt).toBeGreaterThan(0);
  });

  it('returns 304 when If-Modified-Since matches the cached timestamp', async () => {
    await seedEntry('layouts', 'lay-1', 1000);
    const stamp = Number(redisStore.get('users:user-1:indexUpdatedAt'));
    expect(stamp).toBeGreaterThan(0);

    const { default: handler } = await import('./manifest');
    const res = makeRes();
    await handler(makeReq({ ifModifiedSince: String(stamp) }), res as unknown as VercelResponse);
    expect(res._status).toBe(304);
  });

  it('returns 200 when If-Modified-Since is older than the cached timestamp', async () => {
    await seedEntry('layouts', 'lay-1', 1000);
    const { default: handler } = await import('./manifest');
    const res = makeRes();
    await handler(makeReq({ ifModifiedSince: '0' }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
  });

  it('ignores a malformed If-Modified-Since header', async () => {
    await seedEntry('layouts', 'lay-1', 1000);
    const { default: handler } = await import('./manifest');
    const res = makeRes();
    await handler(makeReq({ ifModifiedSince: 'not-a-number' }), res as unknown as VercelResponse);
    expect(res._status).toBe(200);
  });

  it('returns 429 when rate-limited', async () => {
    const rateLimit = await import('../lib/rateLimit');
    (rateLimit.checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 30,
    });
    const { default: handler } = await import('./manifest');
    const res = makeRes();
    await handler(makeReq(), res as unknown as VercelResponse);
    expect(res._status).toBe(429);
  });
});
