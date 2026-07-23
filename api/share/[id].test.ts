/**
 * Tests for share GET/PUT/DELETE. The load-bearing invariants:
 *  - GET never leaks sensitive metadata (delete-token hash, report count,
 *    legacy lastAccessedAt) and never blocks on the lastAccessed write
 *  - PUT/DELETE require the delete token, verified against the REAL
 *    hashToken/timingSafeCompare implementations (Redis hash first, blob
 *    fallback for pre-migration shares)
 *  - rewrites drop the legacy lastAccessedAt field and preserve createdAt
 *  - DELETE accepts the token from header or body and cleans up all three
 *    Redis keys alongside the blob
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hashToken } from '../lib/shared.js';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  put: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
  validateShareLayout: vi.fn(),
  isValidationError: vi.fn(),
  filterLayoutContent: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('@vercel/blob', () => ({
  put: mocks.put,
  head: mocks.head,
  del: mocks.del,
}));

vi.mock('../lib/validation.js', () => ({
  validateShareLayout: mocks.validateShareLayout,
  isValidationError: mocks.isValidationError,
}));

vi.mock('../lib/contentFilter.js', () => ({
  filterLayoutContent: mocks.filterLayoutContent,
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

const VALID_ID = 'abc123DEF456';
const TOKEN = 'correct-token';

function shareBlob(metadata: Record<string, unknown> = {}) {
  return {
    layout: { name: 'Drawer' },
    metadata: {
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUpdatedAt: '2026-01-02T00:00:00.000Z',
      permission: 'view',
      authorName: 'Jo',
      ...metadata,
    },
  };
}

function primeBlobFetch(data: unknown) {
  mocks.head.mockResolvedValue({ url: 'https://blob.example/shares/x.json' });
  mocks.fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
}

async function handle(
  method: string,
  over: { id?: unknown; body?: unknown; headers?: Record<string, string> } = {}
) {
  const res = createResponse();
  const mod = await import('./[id].js');
  await mod.default(
    {
      method,
      query: { id: over.id ?? VALID_ID },
      headers: over.headers ?? {},
      body: over.body ?? {},
    } as unknown as VercelRequest,
    res
  );
  return res;
}

describe('share/[id]', () => {
  let correctHash: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.TOKEN_SALT = 'test-salt';
    correctHash = await hashToken(TOKEN);
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({
      get: mocks.redisGet,
      set: mocks.redisSet,
      del: mocks.redisDel,
    });
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.redisDel.mockResolvedValue(1);
    mocks.put.mockResolvedValue({ url: 'blob://ok' });
    mocks.del.mockResolvedValue(undefined);
    mocks.validateShareLayout.mockReturnValue({ layout: { name: 'Updated' } });
    mocks.isValidationError.mockReturnValue(false);
    mocks.filterLayoutContent.mockReturnValue({ passed: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TOKEN_SALT;
  });

  it('400s on a malformed id for every method', async () => {
    const res = await handle('GET', { id: '../evil' });
    expect(res._status).toBe(400);
  });

  it('405s unsupported methods', async () => {
    const res = await handle('PATCH');
    expect(res._status).toBe(405);
  });

  describe('GET', () => {
    it('404s when the blob is missing', async () => {
      mocks.head.mockRejectedValue(new Error('gone'));
      const res = await handle('GET');
      expect(res._status).toBe(404);
    });

    it('returns the layout but strips sensitive metadata fields', async () => {
      primeBlobFetch(
        shareBlob({
          deleteTokenHash: 'secret-hash',
          reportCount: 3,
          lastAccessedAt: '2026-01-03T00:00:00.000Z',
        })
      );
      const res = await handle('GET');
      expect(res._status).toBe(200);
      const body = res._body as { layout: unknown; metadata: Record<string, unknown> };
      expect(body.layout).toEqual({ name: 'Drawer' });
      expect(body.metadata.deleteTokenHash).toBeUndefined();
      expect(body.metadata.reportCount).toBeUndefined();
      expect(body.metadata.lastAccessedAt).toBeUndefined();
      expect(body.metadata.permission).toBe('view');
    });

    it('records lastAccessedAt in Redis fire-and-forget (a failure never breaks the GET)', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisSet.mockRejectedValue(new Error('redis down'));
      const res = await handle('GET');
      expect(res._status).toBe(200);
      expect(mocks.redisSet).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT', () => {
    it('401s without a delete token', async () => {
      const res = await handle('PUT', { body: {} });
      expect(res._status).toBe(401);
    });

    it('401s on a wrong token via the real constant-time comparison', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('PUT', { body: { deleteToken: 'wrong-token' } });
      expect(res._status).toBe(401);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it('accepts the correct token from the Redis-stored hash', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });
      expect(res._status).toBe(200);
      expect((res._body as { permission: string }).permission).toBe('edit');
    });

    it('falls back to the blob hash for pre-migration shares', async () => {
      primeBlobFetch(shareBlob({ deleteTokenHash: correctHash }));
      mocks.redisGet.mockResolvedValue(null);
      const res = await handle('PUT', { body: { deleteToken: TOKEN } });
      expect(res._status).toBe(200);
    });

    it('404s when no hash exists anywhere', async () => {
      primeBlobFetch(shareBlob());
      const res = await handle('PUT', { body: { deleteToken: TOKEN } });
      expect(res._status).toBe(404);
    });

    it('rejects an invalid permission value', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'admin' } });
      expect(res._status).toBe(400);
    });

    it('permission-only updates rewrite the blob without validating a layout', async () => {
      primeBlobFetch(shareBlob({ lastAccessedAt: 'stale', deleteTokenHash: correctHash }));
      const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });
      expect(res._status).toBe(200);
      expect(mocks.validateShareLayout).not.toHaveBeenCalled();
      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as {
        metadata: Record<string, unknown>;
      };
      // Legacy lastAccessedAt must be dropped on rewrite; createdAt preserved.
      expect(written.metadata.lastAccessedAt).toBeUndefined();
      expect(written.metadata.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(written.metadata.permission).toBe('edit');
    });

    it('full updates validate and content-filter the new layout', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      mocks.filterLayoutContent.mockReturnValue({ passed: false, reason: 'profanity' });
      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'bad' } },
      });
      expect(res._status).toBe(400);
      expect((res._body as { code: string }).code).toBe('CONTENT_BLOCKED');
      expect(mocks.put).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it('accepts the token from the x-delete-token header', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('DELETE', { headers: { 'x-delete-token': TOKEN } });
      expect(res._status).toBe(200);
      expect(mocks.del).toHaveBeenCalledWith(`shares/${VALID_ID}.json`);
      // All three Redis keys cleaned up alongside the blob.
      expect(mocks.redisDel).toHaveBeenCalledTimes(1);
      expect(mocks.redisDel.mock.calls[0]).toHaveLength(3);
    });

    it('accepts the token from the body', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('DELETE', { body: { deleteToken: TOKEN } });
      expect(res._status).toBe(200);
    });

    it('401s on a wrong token and leaves the blob alone', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('DELETE', { headers: { 'x-delete-token': 'wrong' } });
      expect(res._status).toBe(401);
      expect(mocks.del).not.toHaveBeenCalled();
    });

    it('401s with no token at all', async () => {
      const res = await handle('DELETE');
      expect(res._status).toBe(401);
    });
  });
});
