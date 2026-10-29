/**
 * Tests for the Ko-fi webhook receiver.
 *
 * The invariant under test is "never lose a supporter": Ko-fi's feed has no
 * replay, so every non-success answer has to be one Ko-fi will retry, and a
 * forged delivery must never reach the store.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  ping: vi.fn(),
  set: vi.fn(),
  hset: vi.fn(),
  hget: vi.fn(),
  donorCompareAndSet: vi.fn(),
  hincrby: vi.fn(),
}));

/** The `supporters:donors` hash, so a repeat payment can read what an earlier one wrote. */
const donors = new Map<string, string>();
const written = (): Record<string, unknown> => {
  expect(donors.size).toBe(1);
  return JSON.parse([...donors.values()][0]) as Record<string, unknown>;
};

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

function createRequest(
  data: Record<string, unknown>,
  contentType = 'application/x-www-form-urlencoded'
): VercelRequest {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.1', 'content-type': contentType },
    body: { data: JSON.stringify(data) },
  } as unknown as VercelRequest;
}

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

const payload = (over: Record<string, unknown> = {}) => ({
  verification_token: 'right-token',
  message_id: 'm-1',
  from_name: 'Jo Example',
  email: 'jo@example.com',
  is_public: true,
  ...over,
});

async function handle(data: Record<string, unknown>) {
  const res = createResponse();
  const mod = await import('./kofi-webhook.js');
  await mod.default(createRequest(data), res);
  return res;
}

describe('kofi-webhook', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.KOFI_VERIFICATION_TOKEN = 'right-token';
    process.env.TOKEN_SALT = 'salt';
    mocks.ping.mockResolvedValue('PONG');
    mocks.set.mockResolvedValue('OK');
    donors.clear();
    mocks.hset.mockImplementation(async (_key: string, field: string, value: string) => {
      donors.set(field, value);
      return 1;
    });
    mocks.hget.mockImplementation(async (_key: string, field: string) => donors.get(field) ?? null);
    mocks.donorCompareAndSet.mockImplementation(
      async (_key: string, field: string, prev: string, next: string) => {
        if ((donors.get(field) ?? '') !== prev) return 0;
        donors.set(field, next);
        return 1;
      }
    );
    mocks.hincrby.mockResolvedValue(1);
    mocks.getRedis.mockReturnValue({
      ping: mocks.ping,
      set: mocks.set,
      hset: mocks.hset,
      hget: mocks.hget,
      donorCompareAndSet: mocks.donorCompareAndSet,
      hincrby: mocks.hincrby,
    });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59, resetAt: 0 });
  });

  afterEach(() => {
    delete process.env.KOFI_VERIFICATION_TOKEN;
  });

  it('records a valid donation', async () => {
    const res = await handle(payload());
    expect(res._status).toBe(200);
    expect(donors.size).toBe(1);
  });

  it('rejects a forged token without touching the store', async () => {
    const res = await handle(payload({ verification_token: 'wrong' }));
    expect(res._status).toBe(401);
    expect(donors.size).toBe(0);
    // The whole point of verifying first: a forged request costs no Redis I/O.
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('503s when the token is not configured, rather than accepting unverified', async () => {
    delete process.env.KOFI_VERIFICATION_TOKEN;
    const res = await handle(payload());
    expect(res._status).toBe(503);
    expect(donors.size).toBe(0);
  });

  it('400s on a malformed payload', async () => {
    const res = createResponse();
    const mod = await import('./kofi-webhook.js');
    await mod.default(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: { data: 'not json' },
      } as unknown as VercelRequest,
      res
    );
    expect(res._status).toBe(400);
  });

  it('503s when REDIS_URL is not configured', async () => {
    mocks.getRedis.mockReturnValue(null);
    const res = await handle(payload());
    expect(res._status).toBe(503);
  });

  // The regression that matters: checkRateLimit fails closed on a Redis error,
  // returning allowed:false exactly like a genuine rejection. Answering 429 to
  // an outage risks Ko-fi not retrying, and this feed has no replay.
  it('503s (not 429) when Redis is unreachable', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 });
    mocks.ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await handle(payload());

    expect(res._status).toBe(503);
    expect((res._body as { code: string }).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('429s when genuinely rate limited and Redis is healthy', async () => {
    mocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: 0,
      retryAfterSeconds: 30,
    });

    const res = await handle(payload());

    expect(res._status).toBe(429);
    expect((res._body as { code: string }).code).toBe('RATE_LIMITED');
  });

  it('deduplicates a retried delivery', async () => {
    mocks.set.mockResolvedValue(null); // SET NX returns null when the key exists
    const res = await handle(payload());
    expect(res._status).toBe(200);
    expect((res._body as { deduped: boolean }).deduped).toBe(true);
    expect(donors.size).toBe(0);
  });

  it('ignores a subscription renewal so regulars keep one bin', async () => {
    const res = await handle(
      payload({ is_subscription_payment: true, is_first_subscription_payment: false })
    );
    expect(res._status).toBe(200);
    expect(donors.size).toBe(0);
  });

  it('stores a private supporter as anonymous with no message', async () => {
    await handle(payload({ is_public: false, message: 'secret note' }));
    const record = written();
    expect(record.n).toBe('');
    expect(record.m).toBeUndefined();
  });

  it('stores a public supporter as a record with name, date, and message', async () => {
    await handle(payload({ timestamp: '2026-07-01T13:04:30Z', message: 'thanks!' }));
    const record = written();
    expect(record.n).toBe('Jo Example');
    expect(record.t).toBe('2026-07-01T13:04:30.000Z');
    expect(record.m).toBe('thanks!');
  });

  it('never writes the email or amount into the donor record', async () => {
    // Pin the timestamp: without it the record's joinedAt defaults to now, and an
    // ISO string like "…:X5.001Z" can coincidentally contain "5.00" (seconds
    // ending in 5, ms starting 00), flaking the substring assertion below.
    await handle(payload({ amount: '5.00', timestamp: '2026-07-01T13:04:30Z' }));
    const stored = JSON.stringify([...donors]);
    expect(stored).not.toContain('jo@example.com');
    expect(stored).not.toContain('5.00');
  });

  describe('a repeat tip from someone already on the wall', () => {
    const first = payload({ timestamp: '2026-07-01T13:04:30Z', message: 'first words' });
    const again = (over: Record<string, unknown> = {}) =>
      payload({ message_id: 'm-2', timestamp: '2026-09-01T10:00:00Z', ...over });

    it('keeps their message when the new tip has none', async () => {
      await handle(first);
      await handle(again());
      expect(written().m).toBe('first words');
    });

    it('keeps their earliest join date', async () => {
      await handle(first);
      await handle(again({ message: 'more words' }));
      expect(written().t).toBe('2026-07-01T13:04:30.000Z');
    });

    it('takes the new message from a public tip', async () => {
      await handle(first);
      await handle(again({ message: 'more words' }));
      expect(written().m).toBe('more words');
    });

    it('never publishes a private tip message over a public record', async () => {
      await handle(first);
      await handle(again({ is_public: false, message: 'private words' }));
      expect(written()).toMatchObject({ n: 'Jo Example', m: 'first words' });
    });

    it('keeps a self-service rename', async () => {
      await handle(first);
      const [field] = [...donors.keys()];
      donors.set(field, JSON.stringify({ n: 'Jo E.', t: '2026-07-01T13:04:30.000Z' }));
      await handle(again({ from_name: 'Jo Example' }));
      expect(written().n).toBe('Jo E.');
    });

    it('keeps them anonymous after they opted out', async () => {
      await handle(first);
      const [field] = [...donors.keys()];
      donors.set(field, JSON.stringify({ n: '', t: '2026-07-01T13:04:30.000Z' }));
      await handle(again({ message: 'more words' }));
      expect(written()).toMatchObject({ n: '' });
      expect(written().m).toBeUndefined();
    });

    it('leaves an undated legacy record undated', async () => {
      await handle(first);
      const [field] = [...donors.keys()];
      donors.set(field, 'Jo Example');
      await handle(again());
      expect(written().t).toBeUndefined();
    });

    it('merges an edit that lands between the read and the write', async () => {
      await handle(first);
      const [field] = [...donors.keys()];
      mocks.hget.mockImplementationOnce(async () => {
        const seen = donors.get(field) ?? null;
        donors.set(field, JSON.stringify({ n: 'Jo E.', t: '2026-07-01T13:04:30.000Z' }));
        return seen;
      });
      await handle(again({ message: 'more words' }));
      expect(written()).toMatchObject({ n: 'Jo E.', m: 'more words' });
    });
  });

  it('folds the amount into a collect-only per-currency total', async () => {
    await handle(payload({ amount: '5.00', currency: 'usd' }));
    expect(mocks.hincrby).toHaveBeenCalledWith('supporters:totals', 'USD', 500);
  });

  it('skips the total when the amount is missing or unparseable', async () => {
    await handle(payload({ amount: 'free', currency: 'USD' }));
    expect(mocks.hincrby).not.toHaveBeenCalled();
  });

  it('counts a renewal toward the total even though it creates no bin', async () => {
    await handle(
      payload({
        is_subscription_payment: true,
        is_first_subscription_payment: false,
        amount: '3.00',
        currency: 'EUR',
      })
    );
    expect(mocks.hincrby).toHaveBeenCalledWith('supporters:totals', 'EUR', 300);
    expect(donors.size).toBe(0);
  });

  it.each([
    ['form-encoded, as Ko-fi sends', 'application/x-www-form-urlencoded'],
    ['form-encoded with a charset', 'application/x-www-form-urlencoded; charset=utf-8'],
    ['json, in case Ko-fi ever switches', 'application/json'],
  ])('accepts %s', async (_label, contentType) => {
    const res = createResponse();
    const mod = await import('./kofi-webhook.js');
    await mod.default(createRequest(payload(), contentType), res);
    expect(res._status).toBe(200);
  });

  it('415s an unparseable content type', async () => {
    const res = createResponse();
    const mod = await import('./kofi-webhook.js');
    await mod.default(createRequest(payload(), 'text/plain'), res);
    expect(res._status).toBe(415);
    expect(donors.size).toBe(0);
  });

  it('rejects a non-POST method', async () => {
    const res = createResponse();
    const mod = await import('./kofi-webhook.js');
    await mod.default({ method: 'GET', headers: {} } as unknown as VercelRequest, res);
    expect(res._status).toBe(405);
  });
});
