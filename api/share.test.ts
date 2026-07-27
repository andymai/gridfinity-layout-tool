/**
 * Tests for share creation. The invariants under test are the ones the inline
 * comments call out as security/consistency load-bearing:
 *  - the blob put() with allowOverwrite=false is the CAS that decides races
 *    (loser gets 409, never overwrites the winner)
 *  - production fails closed when Redis is down (a share without a persisted
 *    delete-token hash would be permanently unmodifiable)
 *  - a Redis failure AFTER the blob write rolls the blob back (no orphans)
 * Validation/content-filter internals are covered by their own lib tests and
 * are mocked at the seam here.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getRedis: vi.fn(),
  put: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
  redisSet: vi.fn(),
  validateShareLayout: vi.fn(),
  isValidationError: vi.fn(),
  validateSharedDesigns: vi.fn(),
  isSharedDesignsError: vi.fn(),
  validateDesignerShare: vi.fn(),
  filterLayoutContent: vi.fn(),
}));

vi.mock('./lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getRedis: mocks.getRedis,
  getClientIP: () => '203.0.113.1',
}));

vi.mock('@vercel/blob', () => ({
  put: mocks.put,
  head: mocks.head,
  del: mocks.del,
}));

vi.mock('./lib/validation.js', () => ({
  validateShareLayout: mocks.validateShareLayout,
  isValidationError: mocks.isValidationError,
  validateSharedDesigns: mocks.validateSharedDesigns,
  isSharedDesignsError: mocks.isSharedDesignsError,
}));

vi.mock('./lib/designerValidation.js', () => ({
  validateDesignerShare: mocks.validateDesignerShare,
}));

vi.mock('./lib/contentFilter.js', () => ({
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

function layoutBody(over: Record<string, unknown> = {}) {
  return { layoutId: VALID_ID, layout: { name: 'My Drawer' }, ...over };
}

async function handle(body: Record<string, unknown>, method = 'POST') {
  const res = createResponse();
  const mod = await import('./share.js');
  await mod.default({ method, headers: {}, body } as unknown as VercelRequest, res);
  return res;
}

describe('share (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_SALT = 'test-salt';
    delete process.env.VERCEL_ENV;
    mocks.checkRateLimit.mockResolvedValue({ allowed: true });
    mocks.getRedis.mockReturnValue({ set: mocks.redisSet });
    mocks.redisSet.mockResolvedValue('OK');
    mocks.put.mockResolvedValue({ url: 'blob://ok' });
    mocks.validateShareLayout.mockReturnValue({ layout: { name: 'My Drawer' } });
    mocks.isValidationError.mockReturnValue(false);
    mocks.filterLayoutContent.mockReturnValue({ passed: true });
    mocks.validateDesignerShare.mockReturnValue({ valid: true, payload: { params: {} } });
    mocks.validateSharedDesigns.mockReturnValue({ valid: true, designs: [] });
    mocks.isSharedDesignsError.mockReturnValue(false);
  });

  afterEach(() => {
    delete process.env.TOKEN_SALT;
    delete process.env.VERCEL_ENV;
  });

  it('rejects non-POST methods with 405', async () => {
    const res = await handle(layoutBody(), 'GET');
    expect(res._status).toBe(405);
  });

  it('429s when the create rate limit trips', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const res = await handle(layoutBody());
    expect(res._status).toBe(429);
  });

  it('400s on a missing or malformed layoutId', async () => {
    const res = await handle(layoutBody({ layoutId: '../evil' }));
    expect(res._status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('400s on an invalid permission value', async () => {
    const res = await handle(layoutBody({ permission: 'admin' }));
    expect(res._status).toBe(400);
  });

  it('400s when layout validation fails', async () => {
    mocks.isValidationError.mockReturnValue(true);
    mocks.validateShareLayout.mockReturnValue({
      error: { message: 'too big', code: 'SIZE_LIMIT' },
    });
    const res = await handle(layoutBody());
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('SIZE_LIMIT');
  });

  it('400s with CONTENT_BLOCKED when the content filter rejects', async () => {
    mocks.filterLayoutContent.mockReturnValue({ passed: false, reason: 'profanity' });
    const res = await handle(layoutBody());
    expect(res._status).toBe(400);
    expect((res._body as { code: string }).code).toBe('CONTENT_BLOCKED');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('validates designer shares through the designer validator', async () => {
    mocks.validateDesignerShare.mockReturnValue({
      valid: false,
      error: { message: 'bad params', code: 'VALIDATION_ERROR' },
    });
    const res = await handle({ layoutId: VALID_ID, type: 'designer', params: {} });
    expect(res._status).toBe(400);
    expect(mocks.validateShareLayout).not.toHaveBeenCalled();
  });

  it('fails closed with 503 in production when Redis is down', async () => {
    process.env.VERCEL_ENV = 'production';
    mocks.getRedis.mockReturnValue(null);
    const res = await handle(layoutBody());
    expect(res._status).toBe(503);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('creates the share: CAS blob put, hash in Redis, 201 with token and url', async () => {
    const res = await handle(layoutBody({ authorName: 'Jo' }));
    expect(res._status).toBe(201);

    const body = res._body as { id: string; url: string; deleteToken: string; permission: string };
    expect(body.id).toBe(VALID_ID);
    expect(body.url).toContain(`/l/${VALID_ID}`);
    expect(body.deleteToken).toMatch(/^[0-9a-f]{32}$/);
    expect(body.permission).toBe('view');

    // The CAS invariant: allowOverwrite must be explicitly false.
    const putOpts = mocks.put.mock.calls[0][2] as { allowOverwrite: boolean };
    expect(putOpts.allowOverwrite).toBe(false);

    // The delete token never lands in the blob — only its hash goes to Redis.
    const blobJson = mocks.put.mock.calls[0][1] as string;
    expect(blobJson).not.toContain(body.deleteToken);
    expect(mocks.redisSet).toHaveBeenCalledTimes(1);
  });

  it('uses the /d/ url shape for designer shares', async () => {
    const res = await handle({ layoutId: VALID_ID, type: 'designer', params: {} });
    expect(res._status).toBe(201);
    expect((res._body as { url: string }).url).toContain(`/d/${VALID_ID}`);
  });

  it('409s when losing the id race (blob already exists)', async () => {
    mocks.put.mockRejectedValue(new Error('blob exists'));
    mocks.head.mockResolvedValue({ size: 1 });
    const res = await handle(layoutBody());
    expect(res._status).toBe(409);
  });

  it('500s when put fails for a reason other than the race', async () => {
    mocks.put.mockRejectedValue(new Error('network'));
    mocks.head.mockRejectedValue(new Error('also down'));
    const res = await handle(layoutBody());
    expect(res._status).toBe(500);
  });

  // A layout share whose designs stay behind arrives as bins pointing at
  // designs that only exist in the sharer's browser (#2894).
  it('stores the validated linked designs alongside the layout', async () => {
    const designs = [{ id: 'design_1', name: 'Socket Tray', params: { width: 3 } }];
    mocks.validateSharedDesigns.mockReturnValue({ valid: true, designs });

    const res = await handle(layoutBody({ linkedDesigns: [{ id: 'design_1' }] }));

    expect(res._status).toBe(201);
    const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as Record<string, unknown>;
    expect(written.linkedDesigns).toEqual(designs);
  });

  it('omits the key entirely when the layout has no linked designs', async () => {
    const res = await handle(layoutBody());

    expect(res._status).toBe(201);
    const written = JSON.parse(mocks.put.mock.calls[0][1] as string) as Record<string, unknown>;
    expect(written).not.toHaveProperty('linkedDesigns');
  });

  it('400s when the linked designs fail validation, without writing a blob', async () => {
    mocks.validateSharedDesigns.mockReturnValue({
      valid: false,
      error: { code: 'SIZE_LIMIT', message: 'Linked designs exceed maximum size of 512KB' },
    });
    mocks.isSharedDesignsError.mockReturnValue(true);

    const res = await handle(layoutBody({ linkedDesigns: [{ id: 'design_1' }] }));

    expect(res._status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rolls the blob back when the Redis hash write fails after put', async () => {
    mocks.redisSet.mockRejectedValue(new Error('redis write failed'));
    mocks.del.mockResolvedValue(undefined);
    const res = await handle(layoutBody());
    expect(res._status).toBe(500);
    expect(mocks.del).toHaveBeenCalledWith(`shares/${VALID_ID}.json`);
  });
});
