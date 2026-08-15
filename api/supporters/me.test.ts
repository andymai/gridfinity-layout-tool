/**
 * Tests for the signed-in supporter endpoint. Two invariants carry the weight:
 * GET must answer 200 for anonymous callers (this is fetched on page load, and
 * a 4xx logs a console error that trips the post-promote smoke check), and a
 * PATCH must re-run the SAME content gauntlet the Ko-fi webhook does, because
 * it is a second door onto the same public text.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supportersDonorsKey, userProfileKey } from '../lib/redisKeys.js';
import { deriveDonorId, serializeDonorRecord } from '../lib/supporters.js';
import { supportersUserKey } from '../lib/redisKeys.js';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  readSession: vi.fn(),
  requireSession: vi.fn(),
  readSessionCookie: vi.fn(),
}));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('../lib/session.js', () => ({
  readSession: mocks.readSession,
  requireSession: mocks.requireSession,
  checkCsrfDefense: () => true,
}));

vi.mock('../lib/cookies.js', () => ({
  readSessionCookie: mocks.readSessionCookie,
}));

function createResponse() {
  const res = {
    _status: 0,
    _body: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader() {
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as VercelResponse & { _status: number; _body: unknown };
}

function makeRedis() {
  const store = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();
  const sets = new Map<string, Set<string>>();
  const hashOf = (k: string) => {
    const h = hashes.get(k) ?? new Map<string, string>();
    hashes.set(k, h);
    return h;
  };
  return {
    store,
    hashes,
    sets,
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string, ...args: string[]) => {
      if (args.includes('NX') && store.has(k)) return null;
      store.set(k, v);
      return 'OK';
    },
    del: async (...keys: string[]) => keys.filter((k) => store.delete(k)).length,
    sadd: async (k: string, ...m: string[]) => {
      const s = sets.get(k) ?? new Set<string>();
      m.forEach((x) => s.add(x));
      sets.set(k, s);
      return m.length;
    },
    srem: async (k: string, ...m: string[]) => {
      const s = sets.get(k);
      return s ? m.filter((x) => s.delete(x)).length : 0;
    },
    hget: async (k: string, f: string) => hashOf(k).get(f) ?? null,
    hset: async (k: string, f: string, v: string) => {
      hashOf(k).set(f, v);
      return 1;
    },
    hmget: async (k: string, ...fields: string[]) => {
      const h = hashOf(k);
      return fields.map((f) => h.get(f) ?? null);
    },
  };
}

const USER_ID = 'user-1';
const KOFI_EMAIL = 'kofi@example.com';
let redis: ReturnType<typeof makeRedis>;

async function handle(req: Partial<VercelRequest>) {
  const { default: handler } = await import('./me.js');
  const res = createResponse();
  await handler({ headers: {}, query: {}, ...req } as VercelRequest, res);
  return res;
}

/** Seed a Ko-fi donor record and the profile candidates that would match it. */
function seedSupporter(name: string | null = 'Jo', message?: string) {
  const donorId = deriveDonorId(KOFI_EMAIL);
  if (!donorId) throw new Error('salt not set');
  redis.hashes.set(
    supportersDonorsKey(),
    new Map([
      [donorId, serializeDonorRecord({ name, joinedAt: '2026-01-02T03:04:05.000Z', message })],
    ])
  );
  redis.store.set(
    userProfileKey(USER_ID),
    JSON.stringify({ userId: USER_ID, email: KOFI_EMAIL, donorCandidates: [donorId] })
  );
  return donorId;
}

describe('GET /api/supporters/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_SALT = 'test-salt';
    redis = makeRedis();
    mocks.getRedis.mockReturnValue(redis);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.readSessionCookie.mockReturnValue('token');
    mocks.readSession.mockResolvedValue({ userId: USER_ID });
  });

  it('answers 200 rather than 401 for a caller with no session cookie', async () => {
    mocks.readSessionCookie.mockReturnValue(null);
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({ supporter: false });
  });

  it('answers 200 for an expired session', async () => {
    mocks.readSession.mockResolvedValue(null);
    const res = await handle({ method: 'GET' });
    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({ supporter: false });
  });

  it('reports a signed-in non-supporter as not a supporter', async () => {
    redis.store.set(userProfileKey(USER_ID), JSON.stringify({ userId: USER_ID, email: 'x@y.z' }));
    const res = await handle({ method: 'GET' });
    expect(res._body).toMatchObject({ supporter: false });
  });

  it('links lazily from the stored candidates, covering support given after sign-in', async () => {
    seedSupporter('Jo', 'Nice tool');
    const res = await handle({ method: 'GET' });
    expect(res._body).toMatchObject({
      supporter: true,
      name: 'Jo',
      message: 'Nice tool',
      badgePublic: true,
      joinedAt: '2026-01-02T03:04:05.000Z',
    });
    // The link is persisted, so the next read costs no re-match.
    expect(redis.store.get(supportersUserKey(USER_ID))).toBeTruthy();
  });

  it('reports an anonymous supporter as a supporter with no name', async () => {
    seedSupporter(null);
    const res = await handle({ method: 'GET' });
    expect(res._body).toMatchObject({ supporter: true, name: null, message: null });
  });
});

describe('PATCH /api/supporters/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_SALT = 'test-salt';
    redis = makeRedis();
    mocks.getRedis.mockReturnValue(redis);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.readSessionCookie.mockReturnValue('token');
    mocks.readSession.mockResolvedValue({ userId: USER_ID });
    mocks.requireSession.mockResolvedValue({ userId: USER_ID });
  });

  it('rejects a caller with no linked donor record', async () => {
    redis.store.set(userProfileKey(USER_ID), JSON.stringify({ userId: USER_ID, email: 'x@y.z' }));
    const res = await handle({ method: 'PATCH', body: { name: 'Jo' } });
    expect(res._status).toBe(403);
  });

  it('renames the bin', async () => {
    const donorId = seedSupporter('Jo');
    const res = await handle({ method: 'PATCH', body: { name: 'Joanne' } });
    expect(res._status).toBe(200);
    expect(res._body).toMatchObject({ name: 'Joanne' });
    expect(redis.hashes.get(supportersDonorsKey())?.get(donorId)).toContain('Joanne');
  });

  it('keeps the join date, which the wall counts on', async () => {
    seedSupporter('Jo');
    const res = await handle({ method: 'PATCH', body: { name: 'Joanne' } });
    expect(res._body).toMatchObject({ joinedAt: '2026-01-02T03:04:05.000Z' });
  });

  it('drops the message when the bin goes anonymous, even if one was sent', async () => {
    seedSupporter('Jo', 'Nice tool');
    const res = await handle({ method: 'PATCH', body: { name: '', message: 'still here' } });
    expect(res._body).toMatchObject({ name: null, message: null });
  });

  it('re-runs the content filter that the webhook applies', async () => {
    seedSupporter('Jo');
    const res = await handle({ method: 'PATCH', body: { name: 'kys' } });
    expect(res._status).toBe(400);
    expect(res._body).toMatchObject({ code: 'CONTENT_BLOCKED' });
  });

  it('strips invisible characters rather than storing them', async () => {
    const donorId = seedSupporter('Jo');
    await handle({ method: 'PATCH', body: { name: 'J​o‮e' } });
    const stored = redis.hashes.get(supportersDonorsKey())?.get(donorId) ?? '';
    expect(stored).not.toContain('​');
    expect(stored).not.toContain('‮');
  });

  it('retracts the public badge', async () => {
    seedSupporter('Jo');
    const res = await handle({ method: 'PATCH', body: { badgePublic: false } });
    expect(res._body).toMatchObject({ badgePublic: false });
  });

  it('rejects a non-string name instead of coercing it', async () => {
    seedSupporter('Jo');
    const res = await handle({ method: 'PATCH', body: { name: 42 } });
    expect(res._status).toBe(400);
    expect(res._body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rate-limits edits, the one path that writes user text to a public page', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handle({ method: 'PATCH', body: { name: 'Jo' } });
    expect(res._status).toBe(429);
  });
});

describe('method handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis = makeRedis();
    mocks.getRedis.mockReturnValue(redis);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it('rejects anything but GET and PATCH', async () => {
    const res = await handle({ method: 'DELETE' });
    expect(res._status).toBe(405);
  });
});
