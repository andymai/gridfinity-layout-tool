/**
 * Tests for the share-report endpoint. Invariants: reports only count against
 * shares that exist, the counter increments atomically in Redis with a TTL,
 * and Redis being down degrades to logging (200) rather than failing the
 * report.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  head: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('@vercel/blob', () => ({
  head: mocks.head,
}));

function redisWithPipeline() {
  return {
    pipeline: () => ({
      incr: vi.fn(),
      expire: vi.fn(),
      exec: mocks.exec,
    }),
  };
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

const VALID_ID = 'abc123DEF456'; // legacy 12-char alphanumeric share id

async function handle(id: unknown, body: Record<string, unknown> = {}, method = 'POST') {
  const res = createResponse();
  const mod = await import('./[id].js');
  await mod.default({ method, query: { id }, headers: {}, body } as unknown as VercelRequest, res);
  return res;
}

describe('report/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue(redisWithPipeline());
    mocks.head.mockResolvedValue({ size: 1 });
    mocks.exec.mockResolvedValue([[null, 1]]);
  });

  it('rejects non-POST methods with 405', async () => {
    const res = await handle(VALID_ID, {}, 'GET');
    expect(res._status).toBe(405);
  });

  it('400s on a malformed share id before doing any work', async () => {
    const res = await handle('../../etc/passwd');
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(mocks.head).not.toHaveBeenCalled();
  });

  it('429s when the strict report rate limit trips', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 });
    const res = await handle(VALID_ID);
    expect(res._status).toBe(429);
    expect(res._body).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 3600 });
  });

  it('404s when the reported share does not exist', async () => {
    mocks.head.mockRejectedValue(new Error('not found'));
    const res = await handle(VALID_ID);
    expect(res._status).toBe(404);
    expect((res._body as { code: string }).code).toBe('NOT_FOUND');
  });

  it('accepts the report and increments the Redis counter', async () => {
    mocks.exec.mockResolvedValue([[null, 3]]);
    const res = await handle(VALID_ID, { reason: 'spam' });
    expect(res._status).toBe(200);
    expect((res._body as { success: boolean }).success).toBe(true);
    expect(mocks.exec).toHaveBeenCalledTimes(1);
  });

  it('still 200s when Redis is unavailable (logging-only degradation)', async () => {
    mocks.getRedis.mockReturnValue(null);
    const res = await handle(VALID_ID);
    expect(res._status).toBe(200);
    expect((res._body as { success: boolean }).success).toBe(true);
  });

  it('500s when the pipeline throws', async () => {
    mocks.exec.mockRejectedValue(new Error('redis down'));
    const res = await handle(VALID_ID);
    expect(res._status).toBe(500);
    expect((res._body as { code: string }).code).toBe('SERVER_ERROR');
  });
});
