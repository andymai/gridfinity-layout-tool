/**
 * Tests for the public supporter-list endpoint. The invariant under test:
 * any failure must return non-200 so the client keeps its bundled fallback
 * list (a stale page beats an empty baseplate), and the payload is edge-
 * cacheable on success.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  readSupporters: vi.fn(),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('./lib/supporters.js', () => ({
  readSupporters: mocks.readSupporters,
}));

function createResponse() {
  const res = {
    _status: 0,
    _body: null as unknown,
    _headers: {} as Record<string, string>,
    _ended: false,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
      return res;
    },
    end() {
      res._ended = true;
      return res;
    },
  };
  return res as unknown as VercelResponse & {
    _status: number;
    _body: unknown;
    _headers: Record<string, string>;
  };
}

async function handle(method = 'GET') {
  const res = createResponse();
  const mod = await import('./supporters.js');
  await mod.default({ method, headers: {} } as unknown as VercelRequest, res);
  return res;
}

describe('supporters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({});
    mocks.readSupporters.mockResolvedValue({ supporters: [] });
  });

  it('rejects non-GET methods with 405', async () => {
    const res = await handle('POST');
    expect(res._status).toBe(405);
    expect((res._body as { code: string }).code).toBe('METHOD_NOT_ALLOWED');
  });

  it('429s with retryAfter when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const res = await handle();
    expect(res._status).toBe(429);
    expect(res._body).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 42 });
  });

  it('503s when Redis is unavailable so the client keeps its fallback list', async () => {
    mocks.getRedis.mockReturnValue(null);
    const res = await handle();
    expect(res._status).toBe(503);
    expect((res._body as { code: string }).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('returns the supporter payload with an edge-cache header on success', async () => {
    const payload = { supporters: [{ name: 'Jo', joinedAt: '2026-01-01' }] };
    mocks.readSupporters.mockResolvedValue(payload);
    const res = await handle();
    expect(res._status).toBe(200);
    expect(res._body).toEqual(payload);
    expect(res._headers['Cache-Control']).toContain('s-maxage=60');
  });

  it('500s (not 200-with-empty) when the store read throws', async () => {
    mocks.readSupporters.mockRejectedValue(new Error('boom'));
    const res = await handle();
    expect(res._status).toBe(500);
    expect((res._body as { code: string }).code).toBe('SERVER_ERROR');
  });
});
