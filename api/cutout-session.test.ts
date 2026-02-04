/**
 * Tests for the cutout session creation endpoint.
 * Verifies session creation, rate limiting, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function createMockRequest(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function createMockResponse(): VercelResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
  };
  return res as unknown as VercelResponse & { _status: number; _body: unknown };
}

describe('cutout-session handler', () => {
  let handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>;
  let mockRedis: {
    setex: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    mockRedis = {
      setex: vi.fn().mockResolvedValue('OK'),
    };

    vi.doMock('./lib/rateLimit.js', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
      getRedis: vi.fn().mockReturnValue(mockRedis),
      hashIP: vi.fn().mockReturnValue('hashedip123'),
    }));

    const mod = await import('./cutout-session');
    handler = mod.default;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-POST requests', async () => {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(405);
    expect(res._body).toEqual(expect.objectContaining({ code: 'METHOD_NOT_ALLOWED' }));
  });

  it('returns 429 when rate limited', async () => {
    vi.resetModules();
    vi.doMock('./lib/rateLimit.js', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: false, retryAfterSeconds: 30 }),
      getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
      getRedis: vi.fn().mockReturnValue(mockRedis),
      hashIP: vi.fn().mockReturnValue('hashedip123'),
    }));

    const mod = await import('./cutout-session');
    handler = mod.default;

    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(429);
    expect(res._body).toEqual(
      expect.objectContaining({
        code: 'RATE_LIMITED',
        retryAfter: 30,
      })
    );
  });

  it('returns 503 when Redis is unavailable', async () => {
    vi.resetModules();
    vi.doMock('./lib/rateLimit.js', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
      getRedis: vi.fn().mockReturnValue(null),
      hashIP: vi.fn().mockReturnValue('hashedip123'),
    }));

    const mod = await import('./cutout-session');
    handler = mod.default;

    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._body).toEqual(expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }));
  });

  it('creates a session with 128-bit session ID and secret', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(201);
    const body = res._body as {
      sessionId: string;
      sessionSecret: string;
      expiresAt: string;
      uploadUrl: string;
    };

    // Verify 128-bit (32 hex char) session ID
    expect(body.sessionId).toMatch(/^[a-f0-9]{32}$/);
    // Verify 128-bit session secret
    expect(body.sessionSecret).toMatch(/^[a-f0-9]{32}$/);
    expect(body.expiresAt).toBeDefined();
    expect(body.uploadUrl).toContain('/api/cutout-session/');
  });

  it('stores session with hashed IP and secret hash', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^cutout:session:[a-f0-9]{32}$/),
      600, // 10 minute TTL
      expect.stringContaining('"clientIPHash"') // Should contain hashed IP, not raw IP
    );

    // Verify raw IP is not stored
    const storedData = mockRedis.setex.mock.calls[0][2];
    expect(storedData).not.toContain('"clientIP"');
    expect(storedData).toContain('"secretHash"');
  });
});
