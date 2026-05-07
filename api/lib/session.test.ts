import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import {
  createSession,
  deleteSession,
  generateSessionToken,
  readSession,
  requireSession,
  type SessionRecord,
} from './session';

vi.mock('./rateLimit', () => ({
  getRedis: () => mockRedis,
}));

let mockRedis: Redis;

function makeRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const setKey = (k: string, v: string): 'OK' => {
    store.set(k, v);
    return 'OK';
  };
  const saddKey = (k: string, m: string): number => {
    const s = sets.get(k) ?? new Set<string>();
    s.add(m);
    sets.set(k, s);
    return 1;
  };
  const sremKeys = (k: string, ...members: string[]): number => {
    const s = sets.get(k);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) if (s.delete(m)) removed++;
    return removed;
  };
  return {
    store,
    sets,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => setKey(k, v)),
    del: vi.fn(async (k: string) => {
      const had = store.delete(k);
      return had ? 1 : 0;
    }),
    sadd: vi.fn(async (k: string, m: string) => saddKey(k, m)),
    srem: vi.fn(async (k: string, ...members: string[]) => sremKeys(k, ...members)),
    smembers: vi.fn(async (k: string) => Array.from(sets.get(k) ?? [])),
    pipeline: vi.fn(() => makePipelineMock(store, setKey, saddKey)),
  } as unknown as Redis & {
    store: Map<string, string>;
    sets: Map<string, Set<string>>;
  };
}

function makePipelineMock(
  store: Map<string, string>,
  setKey: (k: string, v: string) => 'OK',
  saddKey: (k: string, m: string) => number
) {
  const queue: Array<() => [Error | null, unknown]> = [];
  const pipe = {
    set: (k: string, v: string, ..._rest: unknown[]) => {
      queue.push(() => [null, setKey(k, v)]);
      return pipe;
    },
    sadd: (k: string, m: string) => {
      queue.push(() => [null, saddKey(k, m)]);
      return pipe;
    },
    exists: (k: string) => {
      queue.push(() => [null, store.has(k) ? 1 : 0]);
      return pipe;
    },
    exec: vi.fn(async () => queue.map((fn) => fn())),
  };
  return pipe;
}

interface MockRes {
  _status: number;
  _body: unknown;
  status(code: number): MockRes;
  json(body: unknown): MockRes;
}

function makeRes(): MockRes {
  return {
    _status: 0,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
}

function makeReq(opts: {
  method?: string;
  cookie?: string;
  origin?: string;
  host?: string;
  fetchSite?: string;
  xRequestedWith?: string;
}): VercelRequest {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin) headers.origin = opts.origin;
  if (opts.host) headers.host = opts.host;
  if (opts.fetchSite) headers['sec-fetch-site'] = opts.fetchSite;
  if (opts.xRequestedWith) headers['x-requested-with'] = opts.xRequestedWith;
  return { method: opts.method ?? 'GET', headers } as unknown as VercelRequest;
}

describe('generateSessionToken', () => {
  it('returns a 64-char lowercase hex string', () => {
    expect(generateSessionToken()).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns a fresh token each call', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });
});

describe('session crud', () => {
  beforeEach(() => {
    mockRedis = makeRedisMock();
  });

  it('round-trips a session record and indexes by user (pipelined)', async () => {
    const record: SessionRecord = {
      userId: 'u1',
      provider: 'google',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60,
    };
    await createSession(mockRedis, 'tok-1', record);
    // The session payload landed in the keyspace; the user is indexed.
    const ctx = mockRedis as unknown as {
      store: Map<string, string>;
      sets: Map<string, Set<string>>;
    };
    expect(ctx.store.get('session:tok-1')).toBeTypeOf('string');
    expect(ctx.sets.get('users:u1:sessions')?.has('tok-1')).toBe(true);
    // The pipeline path is used (not separate set + sadd).
    expect(mockRedis.pipeline).toHaveBeenCalled();

    const back = await readSession(mockRedis, 'tok-1');
    expect(back).toEqual(record);
  });

  it('prunes per-user session entries whose underlying key has expired', async () => {
    const ctx = mockRedis as unknown as {
      store: Map<string, string>;
      sets: Map<string, Set<string>>;
    };
    // Seed a stale token: it lives in the user's set but has no session: row.
    ctx.sets.set('users:u1:sessions', new Set(['stale-token']));
    const record: SessionRecord = {
      userId: 'u1',
      provider: 'google',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60,
    };
    await createSession(mockRedis, 'fresh-token', record);
    const set = ctx.sets.get('users:u1:sessions');
    expect(set?.has('stale-token')).toBe(false);
    expect(set?.has('fresh-token')).toBe(true);
  });

  it('returns null for a missing token', async () => {
    expect(await readSession(mockRedis, 'nope')).toBe(null);
  });

  it('returns null for an expired session', async () => {
    const record: SessionRecord = {
      userId: 'u1',
      provider: 'google',
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() - 1,
    };
    await createSession(mockRedis, 'old', record);
    expect(await readSession(mockRedis, 'old')).toBe(null);
  });

  it('returns null for malformed JSON in storage', async () => {
    (mockRedis as unknown as { store: Map<string, string> }).store.set('session:bad', 'not-json');
    expect(await readSession(mockRedis, 'bad')).toBe(null);
  });

  it('deleteSession unlinks the user session set entry', async () => {
    const record: SessionRecord = {
      userId: 'u1',
      provider: 'google',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60,
    };
    await createSession(mockRedis, 'tok', record);
    await deleteSession(mockRedis, 'tok');
    expect(mockRedis.del).toHaveBeenCalledWith('session:tok');
    expect(mockRedis.srem).toHaveBeenCalledWith('users:u1:sessions', 'tok');
  });
});

describe('requireSession', () => {
  beforeEach(() => {
    mockRedis = makeRedisMock();
    process.env.VERCEL_ENV = 'production';
  });

  async function seedSession(token: string): Promise<SessionRecord> {
    const record: SessionRecord = {
      userId: 'u1',
      provider: 'google',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60,
    };
    await createSession(mockRedis, token, record);
    return record;
  }

  it('returns the session for a valid GET request', async () => {
    await seedSession('tok');
    const req = makeReq({
      method: 'GET',
      cookie: '__Host-gflt_session=tok',
      fetchSite: 'same-origin',
    });
    const res = makeRes();
    const session = await requireSession(req, res as unknown as VercelResponse);
    expect(session?.userId).toBe('u1');
    expect(res._status).toBe(0);
  });

  it('rejects a cross-site request with 403', async () => {
    await seedSession('tok');
    const req = makeReq({
      method: 'GET',
      cookie: '__Host-gflt_session=tok',
      fetchSite: 'cross-site',
    });
    const res = makeRes();
    expect(await requireSession(req, res as unknown as VercelResponse)).toBe(null);
    expect(res._status).toBe(403);
  });

  it('rejects a mutating request without X-Requested-With with 403', async () => {
    await seedSession('tok');
    const req = makeReq({
      method: 'POST',
      cookie: '__Host-gflt_session=tok',
      fetchSite: 'same-origin',
    });
    const res = makeRes();
    expect(await requireSession(req, res as unknown as VercelResponse)).toBe(null);
    expect(res._status).toBe(403);
  });

  it('accepts a mutating request with X-Requested-With: gflt', async () => {
    await seedSession('tok');
    const req = makeReq({
      method: 'POST',
      cookie: '__Host-gflt_session=tok',
      fetchSite: 'same-origin',
      xRequestedWith: 'gflt',
    });
    const res = makeRes();
    const session = await requireSession(req, res as unknown as VercelResponse);
    expect(session?.userId).toBe('u1');
  });

  it('rejects when the session cookie is missing with 401', async () => {
    const req = makeReq({ method: 'GET', fetchSite: 'same-origin' });
    const res = makeRes();
    expect(await requireSession(req, res as unknown as VercelResponse)).toBe(null);
    expect(res._status).toBe(401);
  });

  it('rejects when the session token is unknown', async () => {
    const req = makeReq({
      method: 'GET',
      cookie: '__Host-gflt_session=nope',
      fetchSite: 'same-origin',
    });
    const res = makeRes();
    expect(await requireSession(req, res as unknown as VercelResponse)).toBe(null);
    expect(res._status).toBe(401);
  });
});
