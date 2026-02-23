import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockPut = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGetClientIP = vi.hoisted(() => vi.fn());

vi.mock('@vercel/blob', () => ({ put: mockPut }));
vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIP: mockGetClientIP,
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal valid 3MF buffer: ZIP magic bytes (PK\x03\x04) + padding */
const VALID_3MF = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: { origin: 'https://myapp.vercel.app' },
    body: VALID_3MF,
    ...overrides,
  } as unknown as VercelRequest;
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

describe('slicer-upload handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'myapp.vercel.app');
    mockGetClientIP.mockReturnValue('127.0.0.1');
    mockCheckRateLimit.mockResolvedValue({ allowed: true });
    mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/slicer-temp/test.3mf' });
  });

  it('returns 405 for non-POST methods', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ method: 'GET' }), res);
    expect(status).toHaveBeenCalledWith(405);
  });

  // ─── Origin check ──────────────────────────────────────────────────────────

  it('returns 403 when Origin header is absent', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: {} }), res);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('returns 403 when Origin does not match any allowed Vercel URL', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'https://attacker.com' } }), res);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('returns 403 for malformed Origin header', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'not-a-url' } }), res);
    expect(status).toHaveBeenCalledWith(403);
  });

  it('allows origin matching VERCEL_PROJECT_PRODUCTION_URL', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'https://myapp.vercel.app' } }), res);
    expect(status).toHaveBeenCalledWith(200);
  });

  it('allows origin matching VERCEL_URL (deployment hash URL)', async () => {
    vi.stubEnv('VERCEL_URL', 'myapp-abc123.vercel.app');
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'https://myapp-abc123.vercel.app' } }), res);
    expect(status).toHaveBeenCalledWith(200);
  });

  it('allows origin matching VERCEL_BRANCH_URL (branch alias)', async () => {
    vi.stubEnv('VERCEL_BRANCH_URL', 'myapp-git-main.vercel.app');
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'https://myapp-git-main.vercel.app' } }), res);
    expect(status).toHaveBeenCalledWith(200);
  });

  it('allows localhost in non-production even when no Vercel URL env vars are set', async () => {
    // The localhost short-circuit is independent of allowedHosts: even with an
    // empty set, (!isProduction && originHost === 'localhost') evaluates first.
    vi.unstubAllEnvs();
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token');
    vi.stubEnv('VERCEL_ENV', 'development');
    // VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, VERCEL_BRANCH_URL intentionally unset
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'http://localhost:5173' } }), res);
    expect(status).toHaveBeenCalledWith(200);
  });

  it('rejects localhost in production', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ headers: { origin: 'http://localhost:5173' } }), res);
    expect(status).toHaveBeenCalledWith(403);
  });

  // ─── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(429);
  });

  // ─── Body validation ───────────────────────────────────────────────────────

  it('returns 400 when body is missing', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ body: undefined }), res);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('returns 413 when body exceeds 2MB', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 0x00);
    oversized[0] = 0x50;
    oversized[1] = 0x4b;
    oversized[2] = 0x03;
    oversized[3] = 0x04;
    await handler(makeReq({ body: oversized }), res);
    expect(status).toHaveBeenCalledWith(413);
  });

  it('returns 400 when magic bytes are not a ZIP/3MF header', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq({ body: Buffer.from([0x00, 0x01, 0x02, 0x03]) }), res);
    expect(status).toHaveBeenCalledWith(400);
  });

  // ─── Service configuration ─────────────────────────────────────────────────

  it('returns 503 when BLOB_READ_WRITE_TOKEN is not set', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(503);
  });

  // ─── Success & storage errors ──────────────────────────────────────────────

  it('returns 200 with blob URL on success', async () => {
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status, json } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ url: 'https://blob.vercel.com/slicer-temp/test.3mf' });
  });

  it('returns 500 when blob storage throws', async () => {
    mockPut.mockRejectedValueOnce(new Error('Blob unavailable'));
    const { default: handler } = await import('./slicer-upload.js');
    const { res, status } = makeRes();
    await handler(makeReq(), res);
    expect(status).toHaveBeenCalledWith(500);
  });
});
