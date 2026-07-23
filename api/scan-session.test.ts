/**
 * Tests for the phone-scan session creator. Invariants: sessions only open
 * when Redis can relay the outline (dead QR codes are worse than falling
 * back to manual upload), the record lands with the advertised TTL, and the
 * returned URL embeds the minted token.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SCAN_SESSION_TTL_SECONDS } from './lib/scanSession.js';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  set: vi.fn(),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
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

async function handle(method = 'POST') {
  const res = createResponse();
  const mod = await import('./scan-session.js');
  await mod.default({ method, headers: {} } as unknown as VercelRequest, res);
  return res;
}

describe('scan-session (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({ set: mocks.set });
    mocks.set.mockResolvedValue('OK');
  });

  it('rejects non-POST methods with 405', async () => {
    const res = await handle('GET');
    expect(res._status).toBe(405);
  });

  it('429s when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handle();
    expect(res._status).toBe(429);
    expect(res._body).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 60 });
  });

  it('503s without Redis so the client falls back to manual upload', async () => {
    mocks.getRedis.mockReturnValue(null);
    const res = await handle();
    expect(res._status).toBe(503);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('mints a token, stores a pending record with the advertised TTL, and returns the scan URL', async () => {
    const res = await handle();
    expect(res._status).toBe(201);

    const body = res._body as { token: string; url: string; expiresInSeconds: number };
    expect(body.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.url).toContain(`/scan/${body.token}`);
    expect(body.expiresInSeconds).toBe(SCAN_SESSION_TTL_SECONDS);

    expect(mocks.set).toHaveBeenCalledTimes(1);
    const [key, value, exFlag, ttl] = mocks.set.mock.calls[0] as [string, string, string, number];
    expect(key).toContain(body.token);
    expect(JSON.parse(value)).toMatchObject({ status: 'pending' });
    expect(exFlag).toBe('EX');
    expect(ttl).toBe(SCAN_SESSION_TTL_SECONDS);
  });

  it('500s when the Redis write throws', async () => {
    mocks.set.mockRejectedValue(new Error('write failed'));
    const res = await handle();
    expect(res._status).toBe(500);
    expect((res._body as { code: string }).code).toBe('SERVER_ERROR');
  });
});
