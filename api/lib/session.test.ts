import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Redis } from 'ioredis';
import {
  createSession,
  deleteSession,
  generateSessionToken,
  readSession,
  requireSession,
  SESSION_TTL_SECONDS,
  type SessionRecord,
} from './session';

vi.mock('./rateLimit', () => ({
  getRedis: () => mockRedis,
}));

let mockRedis: Redis;

function makeRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    store,
    sets,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (k: string) => {
      const had = store.delete(k);
      return had ? 1 : 0;
    }),
    sadd: vi.fn(async (k: string, m: string) => {
      const s = sets.get(k) ?? new Set<string>();
      s.add(m);
      sets.set(k, s);
      return 1;
    }),
    srem: vi.fn(async (k: string, m: string) => {
      sets.get(k)?.delete(m);
      return 1;
    }),
  } as unknown as Redis & {
    store: Map<string, string>;
    sets: Map<string, Set<string>>;
  };
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

  it('round-trips a session record and indexes by user', async () => {
    const record: SessionRecord = {
      userId: 'u1',
      provider: 'google',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60,
    };
    await createSession(mockRedis, 'tok-1', record);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'session:tok-1',
      expect.any(String),
      'EX',
      SESSION_TTL_SECONDS
    );
    expect(mockRedis.sadd).toHaveBeenCalledWith('users:u1:sessions', 'tok-1');

    const back = await readSession(mockRedis, 'tok-1');
    expect(back).toEqual(record);
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
