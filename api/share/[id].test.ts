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
 *  - PUT writes only over the blob it read, and takes its stamp from the
 *    shared reservation after that read, so the write that lands last
 *    carries the latest lastUpdatedAt
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type * as Validation from '../lib/validation.js';
import type * as ContentFilter from '../lib/contentFilter.js';
import type * as Blob from '@vercel/blob';
import { BlobPreconditionFailedError } from '@vercel/blob';
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
  reserveShareRevision: vi.fn(),
  seedShareRevision: vi.fn(),
  validateShareLayout: vi.fn(),
  isValidationError: vi.fn(),
  filterLayoutContent: vi.fn(),
  fetch: vi.fn(),
  resolveShareMeshFiles: vi.fn(),
  holdShareMeshes: vi.fn(),
}));

vi.mock('../lib/shareMeshes.js', () => ({ resolveShareMeshFiles: mocks.resolveShareMeshFiles }));
vi.mock('../lib/meshIndex.js', () => ({ holdShareMeshes: mocks.holdShareMeshes }));

vi.mock('../lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('@vercel/blob', async (importOriginal) => ({
  ...(await importOriginal<typeof Blob>()),
  put: mocks.put,
  head: mocks.head,
  del: mocks.del,
}));

vi.mock('../lib/validation.js', async (importOriginal) => ({
  ...(await importOriginal<typeof Validation>()),
  validateShareLayout: mocks.validateShareLayout,
  isValidationError: mocks.isValidationError,
}));

vi.mock('../lib/contentFilter.js', async (importOriginal) => ({
  ...(await importOriginal<typeof ContentFilter>()),
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

const BLOB_URL = 'https://blob.example/shares/x.json';
const UPLOADED_AT = new Date('2026-01-02T00:00:00.000Z');

/** The revision scripts' semantics, as `shareRevision.integration.test.ts` runs them. */
const revisions = new Map<string, number>();
const REVISION_KEY = `share:revision:abc123DEF456`;
function reserve(key: string, floorMs: number): Promise<number | null> {
  const last = revisions.get(key);
  if (last === undefined) return Promise.resolve(null);
  const stamp = Math.max(floorMs, last + 1);
  revisions.set(key, stamp);
  return Promise.resolve(stamp);
}
function seed(key: string, stampMs: number): Promise<number> {
  const stamp = Math.max(stampMs, revisions.get(key) ?? 0);
  revisions.set(key, stamp);
  return Promise.resolve(stamp);
}

function blobResponse(data: unknown, etag?: string) {
  return {
    ok: true,
    headers: new Headers(etag ? { etag } : {}),
    json: () => Promise.resolve(data),
  };
}

function primeBlobFetch(data: unknown, etag = '"etag-1"') {
  mocks.head.mockResolvedValue({ url: BLOB_URL, etag, uploadedAt: UPLOADED_AT });
  mocks.fetch.mockResolvedValue(blobResponse(data, etag));
}

function primeBlobChange(first: unknown, second: unknown) {
  mocks.head
    .mockResolvedValueOnce({ url: BLOB_URL, etag: '"etag-1"', uploadedAt: UPLOADED_AT })
    .mockResolvedValue({ url: BLOB_URL, etag: '"etag-2"', uploadedAt: UPLOADED_AT });
  mocks.fetch
    .mockResolvedValueOnce(blobResponse(first, '"etag-1"'))
    .mockResolvedValue(blobResponse(second, '"etag-2"'));
}

function writtenAt(call: number) {
  return JSON.parse(mocks.put.mock.calls[call][1] as string) as {
    layout: Record<string, unknown>;
    metadata: { lastUpdatedAt: string; permission: string };
  };
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
      reserveShareRevision: mocks.reserveShareRevision,
      seedShareRevision: mocks.seedShareRevision,
    });
    revisions.clear();
    mocks.reserveShareRevision.mockImplementation(reserve);
    mocks.seedShareRevision.mockImplementation(seed);
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue('OK');
    mocks.redisDel.mockResolvedValue(1);
    mocks.put.mockResolvedValue({ url: 'blob://ok' });
    mocks.del.mockResolvedValue(undefined);
    mocks.validateShareLayout.mockReturnValue({ layout: { name: 'Updated' } });
    mocks.isValidationError.mockReturnValue(false);
    mocks.filterLayoutContent.mockReturnValue({ passed: true });
    mocks.resolveShareMeshFiles.mockResolvedValue({});
    mocks.holdShareMeshes.mockResolvedValue(undefined);
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

    it('reports a permission change the blob CDN has not caught up with yet', async () => {
      primeBlobFetch(shareBlob({ permission: 'view' }));
      mocks.redisGet.mockImplementation((key: string) =>
        Promise.resolve(key === `share:permission:${VALID_ID}` ? 'edit' : null)
      );
      const res = await handle('GET');
      expect((res._body as { metadata: { permission: string } }).metadata.permission).toBe('edit');
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

    it('records the new permission in Redis so reads inside the CDN propagation window see it', async () => {
      primeBlobFetch(shareBlob({ deleteTokenHash: correctHash }));
      const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });
      expect(res._status).toBe(200);
      expect(mocks.redisSet).toHaveBeenCalledWith(
        `share:permission:${VALID_ID}`,
        'edit',
        'EX',
        expect.any(Number)
      );
    });

    it('a layout update keeps a permission change the blob CDN still serves stale', async () => {
      primeBlobFetch(shareBlob({ permission: 'view' }));
      mocks.redisGet.mockImplementation((key: string) =>
        Promise.resolve(
          key === `share:permission:${VALID_ID}`
            ? 'edit'
            : key === `share:hash:${VALID_ID}`
              ? correctHash
              : null
        )
      );
      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
      });
      expect(res._status).toBe(200);
      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as {
        metadata: Record<string, unknown>;
      };
      expect(written.metadata.permission).toBe('edit');
    });

    it('drops the Redis permission when recording it fails, so an older value cannot outlive the blob', async () => {
      primeBlobFetch(shareBlob({ deleteTokenHash: correctHash }));
      mocks.redisSet.mockRejectedValue(new Error('redis down'));
      const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'view' } });
      expect(res._status).toBe(200);
      expect(mocks.redisDel).toHaveBeenCalledWith(`share:permission:${VALID_ID}`);
    });

    it('stores a full update without the library folder placement', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      mocks.validateShareLayout.mockReturnValue({
        layout: { name: 'Updated', folderId: 'folder_1_abc' },
      });
      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
      });
      expect(res._status).toBe(200);
      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as {
        layout: Record<string, unknown>;
      };
      expect(written.layout).toEqual({ name: 'Updated' });
    });

    it('returns the lastUpdatedAt it wrote, so a collab room can record the revision', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
      });
      expect(res._status).toBe(200);
      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as {
        metadata: { lastUpdatedAt: string };
      };
      expect(written.metadata.lastUpdatedAt).not.toBe('2026-01-02T00:00:00.000Z');
      expect((res._body as { lastUpdatedAt: string }).lastUpdatedAt).toBe(
        written.metadata.lastUpdatedAt
      );
    });

    it('returns the lastUpdatedAt a permission-only update wrote', async () => {
      primeBlobFetch(shareBlob({ deleteTokenHash: correctHash }));
      const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });
      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as {
        metadata: { lastUpdatedAt: string };
      };
      expect((res._body as { lastUpdatedAt: string }).lastUpdatedAt).toBe(
        written.metadata.lastUpdatedAt
      );
    });

    describe('a write that another write beats', () => {
      it('stamps a write later than the stored blob when the CDN serves an older body', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
          vi.setSystemTime(new Date('2026-03-01T00:00:05.000Z'));
          primeBlobFetch(shareBlob({ lastUpdatedAt: '2026-03-01T00:00:00.000Z' }), '"etag-new"');
          mocks.head.mockResolvedValue({
            url: BLOB_URL,
            etag: '"etag-new"',
            uploadedAt: new Date('2026-03-01T00:00:07.000Z'),
          });
          mocks.redisGet.mockResolvedValue(correctHash);
          await handle('PUT', { body: { deleteToken: TOKEN, layout: { name: 'Updated' } } });

          expect(mocks.put.mock.calls[0][2]).toMatchObject({ ifMatch: '"etag-new"' });
          expect(writtenAt(0).metadata.lastUpdatedAt).toBe('2026-03-01T00:00:07.001Z');
        } finally {
          vi.useRealTimers();
        }
      });

      it('stamps a write later than one a server with a fast clock stamped, while the CDN serves an older body', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
          vi.setSystemTime(new Date('2026-03-01T10:00:06.000Z'));
          revisions.set(REVISION_KEY, Date.parse('2026-03-01T10:00:10.000Z'));
          primeBlobFetch(shareBlob({ lastUpdatedAt: '2026-03-01T10:00:00.000Z' }), '"etag-old"');
          mocks.head.mockResolvedValue({
            url: BLOB_URL,
            etag: '"etag-new"',
            uploadedAt: new Date('2026-03-01T10:00:05.000Z'),
          });
          mocks.redisGet.mockResolvedValue(correctHash);
          const res = await handle('PUT', {
            body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
          });

          expect(mocks.put.mock.calls[0][2]).toMatchObject({ ifMatch: '"etag-new"' });
          expect(writtenAt(0).metadata.lastUpdatedAt).toBe('2026-03-01T10:00:10.001Z');
          expect((res._body as { lastUpdatedAt: string }).lastUpdatedAt).toBe(
            '2026-03-01T10:00:10.001Z'
          );
        } finally {
          vi.useRealTimers();
        }
      });

      describe('with no revision counter yet', () => {
        it('writes a full update only over the body that set its floor, and seeds the counter', async () => {
          vi.useFakeTimers({ toFake: ['Date'] });
          try {
            vi.setSystemTime(new Date('2026-03-01T10:00:06.000Z'));
            mocks.head.mockResolvedValue({
              url: BLOB_URL,
              etag: '"etag-new"',
              uploadedAt: new Date('2026-03-01T10:00:05.000Z'),
            });
            mocks.fetch
              .mockResolvedValueOnce(
                blobResponse(shareBlob({ lastUpdatedAt: '2026-03-01T10:00:00.000Z' }), '"etag-old"')
              )
              .mockResolvedValue(
                blobResponse(shareBlob({ lastUpdatedAt: '2026-03-01T10:00:10.000Z' }), '"etag-new"')
              );
            mocks.put.mockImplementation(
              (_path: string, _body: string, options: { ifMatch: string }) =>
                options.ifMatch === '"etag-new"'
                  ? Promise.resolve({ url: 'blob://ok' })
                  : Promise.reject(new BlobPreconditionFailedError())
            );
            mocks.redisGet.mockResolvedValue(correctHash);
            const res = await handle('PUT', {
              body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
            });

            expect(res._status).toBe(200);
            expect(
              mocks.put.mock.calls.map(([, , options]) => (options as { ifMatch: string }).ifMatch)
            ).toEqual(['"etag-old"', '"etag-new"']);
            expect(writtenAt(1).metadata.lastUpdatedAt).toBe('2026-03-01T10:00:10.001Z');
            expect(revisions.get(REVISION_KEY)).toBe(Date.parse('2026-03-01T10:00:10.001Z'));
          } finally {
            vi.useRealTimers();
          }
        });

        it('falls back to the current blob when the body has no ETag', async () => {
          mocks.head.mockResolvedValue({
            url: BLOB_URL,
            etag: '"etag-1"',
            uploadedAt: UPLOADED_AT,
          });
          mocks.fetch.mockResolvedValue(blobResponse(shareBlob()));
          mocks.redisGet.mockResolvedValue(correctHash);
          const res = await handle('PUT', {
            body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
          });

          expect(res._status).toBe(200);
          expect(mocks.put.mock.calls[0][2]).toMatchObject({ ifMatch: '"etag-1"' });
        });
      });

      it('reserves a new stamp after each read', async () => {
        primeBlobChange(shareBlob(), shareBlob());
        mocks.redisGet.mockResolvedValue(correctHash);
        mocks.put.mockRejectedValueOnce(new BlobPreconditionFailedError());
        await handle('PUT', { body: { deleteToken: TOKEN, layout: { name: 'Updated' } } });

        const reads = mocks.head.mock.invocationCallOrder;
        const reservations = mocks.reserveShareRevision.mock.invocationCallOrder;
        expect(reservations).toHaveLength(2);
        expect(reservations[0]).toBeGreaterThan(reads[0]);
        expect(reservations[1]).toBeGreaterThan(reads[1]);
        expect(Date.parse(writtenAt(1).metadata.lastUpdatedAt)).toBeGreaterThan(
          Date.parse(writtenAt(0).metadata.lastUpdatedAt)
        );
      });

      it('falls back to its own floor when the reservation fails', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
          vi.setSystemTime(new Date('2026-03-01T00:00:05.000Z'));
          primeBlobFetch(shareBlob({ lastUpdatedAt: '2026-03-01T00:00:00.000Z' }));
          mocks.redisGet.mockResolvedValue(correctHash);
          mocks.reserveShareRevision.mockRejectedValue(new Error('redis down'));
          const res = await handle('PUT', {
            body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
          });

          expect(res._status).toBe(200);
          expect(writtenAt(0).metadata.lastUpdatedAt).toBe('2026-03-01T00:00:05.000Z');
        } finally {
          vi.useRealTimers();
        }
      });

      it('never writes a permission-only update over a body that has no ETag', async () => {
        mocks.head.mockResolvedValue({ url: BLOB_URL, etag: '"etag-1"', uploadedAt: UPLOADED_AT });
        mocks.fetch.mockResolvedValue(blobResponse(shareBlob({ deleteTokenHash: correctHash })));
        const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });

        expect(mocks.put).not.toHaveBeenCalled();
        expect(res._status).toBe(503);
      });

      it('writes only over the blob it read', async () => {
        primeBlobFetch(shareBlob(), '"etag-7"');
        mocks.redisGet.mockResolvedValue(correctHash);
        await handle('PUT', { body: { deleteToken: TOKEN, layout: { name: 'Updated' } } });
        expect(mocks.put).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({ ifMatch: '"etag-7"' })
        );
      });

      it('reads the blob again and writes over the new one with a later stamp', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
          vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
          primeBlobChange(shareBlob(), shareBlob({ authorName: 'Sam' }));
          mocks.redisGet.mockResolvedValue(correctHash);
          mocks.put.mockImplementationOnce(() => {
            vi.setSystemTime(new Date('2026-03-01T00:00:05.000Z'));
            return Promise.reject(new BlobPreconditionFailedError());
          });
          const res = await handle('PUT', {
            body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
          });

          expect(res._status).toBe(200);
          expect(mocks.put).toHaveBeenCalledTimes(2);
          expect(mocks.put.mock.calls[1][2]).toMatchObject({ ifMatch: '"etag-2"' });
          const second = writtenAt(1);
          expect(second.layout).toEqual({ name: 'Updated' });
          expect(second.metadata).toMatchObject({ authorName: 'Sam' });
          expect(second.metadata.lastUpdatedAt).toBe('2026-03-01T00:00:05.000Z');
          expect((res._body as { lastUpdatedAt: string }).lastUpdatedAt).toBe(
            second.metadata.lastUpdatedAt
          );
        } finally {
          vi.useRealTimers();
        }
      });

      it('stamps a write later than the blob it replaces, when this clock runs behind', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
          vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));
          for (const stored of ['2026-03-01T00:00:00.000Z', '2026-03-01T00:00:07.000Z']) {
            vi.clearAllMocks();
            mocks.put.mockResolvedValue({ url: 'blob://ok' });
            primeBlobFetch(shareBlob({ lastUpdatedAt: stored }));
            mocks.redisGet.mockResolvedValue(correctHash);
            const res = await handle('PUT', {
              body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
            });

            expect(Date.parse(writtenAt(0).metadata.lastUpdatedAt)).toBe(Date.parse(stored) + 1);
            expect((res._body as { lastUpdatedAt: string }).lastUpdatedAt).toBe(
              writtenAt(0).metadata.lastUpdatedAt
            );
          }
        } finally {
          vi.useRealTimers();
        }
      });

      it('writes a permission-only update only over the body that it read', async () => {
        primeBlobFetch(shareBlob({ deleteTokenHash: correctHash }), '"etag-old"');
        mocks.head.mockResolvedValue({
          url: BLOB_URL,
          etag: '"etag-new"',
          uploadedAt: UPLOADED_AT,
        });
        mocks.put.mockRejectedValue(new BlobPreconditionFailedError());
        const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });

        expect(mocks.put.mock.calls[0][2]).toMatchObject({ ifMatch: '"etag-old"' });
        expect(res._status).toBe(503);
      });

      it('writes a full update over the current blob while the CDN serves an older body', async () => {
        revisions.set(REVISION_KEY, Date.parse('2026-01-02T00:00:00.000Z'));
        primeBlobFetch(shareBlob(), '"etag-old"');
        mocks.head.mockResolvedValue({
          url: BLOB_URL,
          etag: '"etag-new"',
          uploadedAt: UPLOADED_AT,
        });
        mocks.redisGet.mockResolvedValue(correctHash);
        const res = await handle('PUT', {
          body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
        });

        expect(res._status).toBe(200);
        expect(mocks.put.mock.calls[0][2]).toMatchObject({ ifMatch: '"etag-new"' });
      });

      it('keeps the layout of the write that beat a permission-only update', async () => {
        primeBlobChange(
          { ...shareBlob({ deleteTokenHash: correctHash }), layout: { name: 'Old' } },
          { ...shareBlob({ deleteTokenHash: correctHash }), layout: { name: 'Newer' } }
        );
        mocks.put.mockRejectedValueOnce(new BlobPreconditionFailedError());
        const res = await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });

        expect(res._status).toBe(200);
        expect(writtenAt(1).layout).toEqual({ name: 'Newer' });
        expect(writtenAt(1).metadata.permission).toBe('edit');
      });

      it('gives up with a 503 when other writes keep landing first', async () => {
        primeBlobFetch(shareBlob());
        mocks.redisGet.mockResolvedValue(correctHash);
        mocks.put.mockRejectedValue(new BlobPreconditionFailedError());
        const res = await handle('PUT', {
          body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
        });

        expect(res._status).toBe(503);
        expect(mocks.put).toHaveBeenCalledTimes(3);
      });

      it('404s when the share is gone by the time it reads again', async () => {
        primeBlobFetch(shareBlob());
        mocks.head
          .mockResolvedValueOnce({ url: BLOB_URL, etag: '"etag-1"', uploadedAt: UPLOADED_AT })
          .mockRejectedValue(new Error('not found'));
        mocks.redisGet.mockResolvedValue(correctHash);
        mocks.put.mockRejectedValueOnce(new BlobPreconditionFailedError());
        const res = await handle('PUT', {
          body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
        });

        expect(res._status).toBe(404);
        expect(mocks.put).toHaveBeenCalledTimes(1);
      });
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

    it('names the blocked layout field on a full update', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      mocks.filterLayoutContent.mockReturnValue({
        passed: false,
        reason: 'Category "x": contains prohibited content',
        field: 'category',
      });
      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
      });
      expect(res._body).toEqual({
        error: 'Content blocked: Category "x": contains prohibited content',
        code: 'CONTENT_BLOCKED',
        field: 'category',
      });
    });

    // Real designs validator and filter: the design name is what blocks.
    it('names a linked design when its name is blocked on a full update', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const params = {
        width: 2,
        depth: 2,
        height: 6,
        style: 'standard',
        scoop: true,
        base: {
          style: 'magnet',
          magnetDiameter: 6.2,
          magnetDepth: 2.4,
          screwDiameter: 3,
          stackingLip: true,
        },
        compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
        label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
        walls: { front: 0, back: 0, left: 0, right: 0 },
        inserts: [],
      };
      const res = await handle('PUT', {
        body: {
          deleteToken: TOKEN,
          layout: { name: 'Updated' },
          linkedDesigns: [{ id: 'design_1', name: 'kys', params }],
        },
      });
      expect(res._status).toBe(400);
      expect(res._body).toMatchObject({ code: 'CONTENT_BLOCKED', field: 'linkedDesign' });
      expect(mocks.put).not.toHaveBeenCalled();
    });
  });

  describe('mesh files', () => {
    const [A, B, C] = ['a', 'b', 'c'].map((c) => c.repeat(64));
    const url = (hash: string) => `https://store.public.blob.vercel-storage.com/meshes/${hash}`;
    const sharedWith = (...hashes: string[]) => ({
      ...shareBlob(),
      meshFiles: Object.fromEntries(hashes.map((hash) => [hash, url(hash)])),
    });

    it('GET returns the CDN URL of each file the share names', async () => {
      primeBlobFetch(sharedWith(A));
      const res = await handle('GET');
      expect((res._body as { meshFiles: unknown }).meshFiles).toEqual({ [A]: url(A) });
    });

    it('PUT holds the new files before the write and keeps holding dropped ones', async () => {
      primeBlobFetch(sharedWith(A, B));
      mocks.redisGet.mockResolvedValue(correctHash);
      mocks.resolveShareMeshFiles.mockResolvedValue({ [B]: url(B), [C]: url(C) });

      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
      });

      expect(res._status).toBe(200);
      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as { meshFiles: unknown };
      expect(written.meshFiles).toEqual({ [B]: url(B), [C]: url(C) });
      expect(mocks.holdShareMeshes).toHaveBeenCalledWith(expect.anything(), VALID_ID, [B, C]);
      const [held] = mocks.holdShareMeshes.mock.invocationCallOrder;
      const [written_] = mocks.put.mock.invocationCallOrder;
      expect(held).toBeLessThan(written_);
    });

    it('PUT writes nothing when the caller does not hold the files', async () => {
      primeBlobFetch(sharedWith(A));
      mocks.redisGet.mockResolvedValue(correctHash);
      mocks.resolveShareMeshFiles.mockImplementation(async (_req, res: VercelResponse) => {
        res.status(424).json({ code: 'MESH_MISSING', missing: [C] });
        return null;
      });

      const res = await handle('PUT', {
        body: { deleteToken: TOKEN, layout: { name: 'Updated' } },
      });

      expect(res._status).toBe(424);
      expect(mocks.put).not.toHaveBeenCalled();
    });

    it('a permission-only PUT keeps the files and their holds', async () => {
      primeBlobFetch(sharedWith(A));
      mocks.redisGet.mockResolvedValue(correctHash);

      await handle('PUT', { body: { deleteToken: TOKEN, permission: 'edit' } });

      const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as { meshFiles: unknown };
      expect(written.meshFiles).toEqual({ [A]: url(A) });
    });

    it("DELETE keeps the share's holds and their record for a later cleanup", async () => {
      primeBlobFetch(sharedWith(A, B));
      mocks.redisGet.mockResolvedValue(correctHash);

      const res = await handle('DELETE', { headers: { 'x-delete-token': TOKEN } });

      expect(res._status).toBe(200);
      expect(mocks.redisDel.mock.calls[0]).not.toContain(`share:meshes:${VALID_ID}`);
    });
  });

  describe('DELETE', () => {
    it('accepts the token from the x-delete-token header', async () => {
      primeBlobFetch(shareBlob());
      mocks.redisGet.mockResolvedValue(correctHash);
      const res = await handle('DELETE', { headers: { 'x-delete-token': TOKEN } });
      expect(res._status).toBe(200);
      expect(mocks.del).toHaveBeenCalledWith(`shares/${VALID_ID}.json`);
      expect(mocks.redisDel).toHaveBeenCalledTimes(1);
      expect(mocks.redisDel.mock.calls[0]).toContain(`share:permission:${VALID_ID}`);
      expect(mocks.redisDel.mock.calls[0]).toHaveLength(4);
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
