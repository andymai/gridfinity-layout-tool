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
    }));

    const mod = await import('./cutout-session');
    handler = mod.default;

    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(503);
    expect(res._body).toEqual(expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }));
  });

  it('creates a session successfully', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(201);
    expect(res._body).toEqual(
      expect.objectContaining({
        sessionId: expect.stringMatching(/^[a-z0-9]{16}$/),
        expiresAt: expect.any(String),
        uploadUrl: expect.stringContaining('/api/cutout-session/'),
      })
    );
  });

  it('stores session in Redis with TTL', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(mockRedis.setex).toHaveBeenCalledWith(
      expect.stringMatching(/^cutout:session:[a-z0-9]{16}$/),
      600, // 10 minute TTL
      expect.any(String)
    );
  });
});
