/**
 * Tests for the phone-scan handoff endpoint. Invariants: uploads only land in
 * still-live sessions and never extend the advertised TTL (KEEPTTL), polling
 * delivers a ready result idempotently, and corrupt records read as expired
 * rather than 500.
 */

import { randomUUID } from 'crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  exists: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  validateScanSvg: vi.fn(),
}));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('../lib/scanSession.js', async (importOriginal) => ({
  ...(await importOriginal()),
  validateScanSvg: mocks.validateScanSvg,
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

const TOKEN = randomUUID();

async function handle(method: string, token: unknown = TOKEN, body: unknown = {}) {
  const res = createResponse();
  const mod = await import('./[token].js');
  await mod.default(
    { method, query: { token }, headers: {}, body } as unknown as VercelRequest,
    res
  );
  return res;
}

describe('scan-session/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({ exists: mocks.exists, get: mocks.get, set: mocks.set });
    mocks.exists.mockResolvedValue(1);
    mocks.set.mockResolvedValue('OK');
    mocks.validateScanSvg.mockReturnValue({ valid: true, svg: '<svg/>' });
  });

  it('400s on a malformed token before touching Redis', async () => {
    const res = await handle('GET', 'not-a-uuid');
    expect(res._status).toBe(400);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('503s when Redis is unavailable', async () => {
    mocks.getRedis.mockReturnValue(null);
    const res = await handle('GET');
    expect(res._status).toBe(503);
  });

  describe('POST (phone upload)', () => {
    it('404s with EXPIRED when the session is gone', async () => {
      mocks.exists.mockResolvedValue(0);
      const res = await handle('POST');
      expect(res._status).toBe(404);
      expect((res._body as { code: string }).code).toBe('EXPIRED');
    });

    it('rejects an invalid SVG with the validator status (413 for size)', async () => {
      mocks.validateScanSvg.mockReturnValue({
        valid: false,
        error: 'SVG too large',
        code: 'SIZE_LIMIT',
      });
      const res = await handle('POST');
      expect(res._status).toBe(413);
    });

    it('stores the ready record with KEEPTTL so retries cannot extend the session', async () => {
      const res = await handle('POST', TOKEN, { svg: '<svg/>' });
      expect(res._status).toBe(200);
      const [key, value, flag] = mocks.set.mock.calls[0] as [string, string, string];
      expect(key).toContain(TOKEN);
      expect(JSON.parse(value)).toMatchObject({ status: 'ready', svg: '<svg/>' });
      expect(flag).toBe('KEEPTTL');
    });

    it('429s uploads when rate limited', async () => {
      mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
      const res = await handle('POST');
      expect(res._status).toBe(429);
    });
  });

  describe('GET (desktop poll)', () => {
    it('reports pending while the phone has not uploaded', async () => {
      mocks.get.mockResolvedValue(JSON.stringify({ status: 'pending', createdAt: 'x' }));
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect((res._body as { status: string }).status).toBe('pending');
    });

    it('delivers a ready result and keeps it available for retry (idempotent)', async () => {
      mocks.get.mockResolvedValue(
        JSON.stringify({ status: 'ready', svg: '<svg/>', createdAt: 'x' })
      );
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(res._body).toMatchObject({ status: 'ready', svg: '<svg/>' });
      // Idempotent delivery: the record must NOT be consumed on read.
      expect(mocks.set).not.toHaveBeenCalled();
    });

    it('404s with EXPIRED when the session vanished', async () => {
      mocks.get.mockResolvedValue(null);
      const res = await handle('GET');
      expect(res._status).toBe(404);
      expect((res._body as { code: string }).code).toBe('EXPIRED');
    });

    it('treats a corrupt record as expired rather than 500', async () => {
      mocks.get.mockResolvedValue('{not json');
      const res = await handle('GET');
      expect(res._status).toBe(404);
      expect((res._body as { code: string }).code).toBe('EXPIRED');
    });
  });

  it('405s other methods listing GET, POST', async () => {
    const res = await handle('DELETE');
    expect(res._status).toBe(405);
  });
});
