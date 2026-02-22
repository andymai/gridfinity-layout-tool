import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Module mocks ────────────────────────────────────────────────────────────

const mockList = vi.hoisted(() => vi.fn());
const mockDel = vi.hoisted(() => vi.fn());

vi.mock('@vercel/blob', () => ({ list: mockList, del: mockDel }));

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: 'GET', headers: {}, ...overrides } as unknown as VercelRequest;
}

function makeRes(): {
  res: VercelResponse;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json, setHeader: vi.fn() } as unknown as VercelResponse;
  return { res, status, json };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('slicer-cleanup handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token');
    mockList.mockResolvedValue({ blobs: [], hasMore: false, cursor: undefined });
    mockDel.mockResolvedValue(undefined);
  });

  it('returns 405 for non-GET methods', async () => {
    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq({ method: 'POST' }), res);
    expect(status).toHaveBeenCalledWith(405);
  });

  it('returns 503 when BLOB_READ_WRITE_TOKEN is missing', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('returns 503 in production when CRON_SECRET is not set', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('CRON_SECRET', '');
    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('returns 401 when CRON_SECRET is set but Authorization header is wrong', async () => {
    vi.stubEnv('CRON_SECRET', 'secret123');
    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { authorization: 'Bearer wrong' } }), res);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('allows request when CRON_SECRET is set and Authorization header matches', async () => {
    vi.stubEnv('CRON_SECRET', 'secret123');
    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { authorization: 'Bearer secret123' } }), res);
    expect(status).toHaveBeenCalledWith(200);
  });

  it('skips auth check when CRON_SECRET is not set', async () => {
    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(200);
  });

  it('deletes blobs older than 2 hours', async () => {
    const now = Date.now();
    const oldBlob = {
      url: 'https://blob.vercel.com/slicer-temp/old.3mf',
      uploadedAt: new Date(now - 3 * 60 * 60 * 1000),
    };
    const newBlob = {
      url: 'https://blob.vercel.com/slicer-temp/new.3mf',
      uploadedAt: new Date(now - 30 * 60 * 1000),
    };
    mockList.mockResolvedValue({ blobs: [oldBlob, newBlob], hasMore: false, cursor: undefined });

    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status, json } = makeRes();
    await handler(makeReq(), res);

    expect(mockDel).toHaveBeenCalledWith([oldBlob.url]);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ deleted: 1 }));
  });

  it('does not call del when no blobs are expired', async () => {
    const now = Date.now();
    const newBlob = {
      url: 'https://blob.vercel.com/slicer-temp/new.3mf',
      uploadedAt: new Date(now - 10 * 60 * 1000),
    };
    mockList.mockResolvedValue({ blobs: [newBlob], hasMore: false, cursor: undefined });

    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, json } = makeRes();
    await handler(makeReq(), res);

    expect(mockDel).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ deleted: 0 }));
  });

  it('returns 500 when blob storage throws', async () => {
    mockList.mockRejectedValueOnce(new Error('Blob unavailable'));

    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);

    expect(status).toHaveBeenCalledWith(500);
  });

  it('paginates through all results when hasMore is true', async () => {
    const now = Date.now();
    const oldBlob1 = {
      url: 'https://blob.vercel.com/slicer-temp/a.3mf',
      uploadedAt: new Date(now - 3 * 60 * 60 * 1000),
    };
    const oldBlob2 = {
      url: 'https://blob.vercel.com/slicer-temp/b.3mf',
      uploadedAt: new Date(now - 4 * 60 * 60 * 1000),
    };

    mockList
      .mockResolvedValueOnce({ blobs: [oldBlob1], hasMore: true, cursor: 'cursor1' })
      .mockResolvedValueOnce({ blobs: [oldBlob2], hasMore: false, cursor: undefined });

    const { default: handler } = await import('./slicer-cleanup.js');
    const { res, json } = makeRes();
    await handler(makeReq(), res);

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockDel).toHaveBeenCalledWith([oldBlob1.url, oldBlob2.url]);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ deleted: 2 }));
  });
});
