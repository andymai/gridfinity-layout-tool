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
}));

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
    mocks.hset.mockResolvedValue(1);
    mocks.getRedis.mockReturnValue({ ping: mocks.ping, set: mocks.set, hset: mocks.hset });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59, resetAt: 0 });
  });

  afterEach(() => {
    delete process.env.KOFI_VERIFICATION_TOKEN;
  });

  it('records a valid donation', async () => {
    const res = await handle(payload());
    expect(res._status).toBe(200);
    expect(mocks.hset).toHaveBeenCalledTimes(1);
  });

  it('rejects a forged token without touching the store', async () => {
    const res = await handle(payload({ verification_token: 'wrong' }));
    expect(res._status).toBe(401);
    expect(mocks.hset).not.toHaveBeenCalled();
    // The whole point of verifying first: a forged request costs no Redis I/O.
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
  });

  it('503s when the token is not configured, rather than accepting unverified', async () => {
    delete process.env.KOFI_VERIFICATION_TOKEN;
    const res = await handle(payload());
    expect(res._status).toBe(503);
    expect(mocks.hset).not.toHaveBeenCalled();
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
    expect(mocks.hset).not.toHaveBeenCalled();
  });

  it('ignores a subscription renewal so regulars keep one bin', async () => {
    const res = await handle(
      payload({ is_subscription_payment: true, is_first_subscription_payment: false })
    );
    expect(res._status).toBe(200);
    expect(mocks.hset).not.toHaveBeenCalled();
  });

  it('stores a private supporter as anonymous rather than dropping them', async () => {
    await handle(payload({ is_public: false }));
    expect(mocks.hset).toHaveBeenCalledTimes(1);
    expect(mocks.hset.mock.calls[0][2]).toBe('');
  });

  it('never writes the email or amount', async () => {
    await handle(payload({ amount: '5.00', message: 'thanks!' }));
    const written = JSON.stringify(mocks.hset.mock.calls[0]);
    expect(written).not.toContain('jo@example.com');
    expect(written).not.toContain('5.00');
    expect(written).not.toContain('thanks!');
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
    expect(mocks.hset).not.toHaveBeenCalled();
  });

  it('rejects a non-POST method', async () => {
    const res = createResponse();
    const mod = await import('./kofi-webhook.js');
    await mod.default({ method: 'GET', headers: {} } as unknown as VercelRequest, res);
    expect(res._status).toBe(405);
  });
});
