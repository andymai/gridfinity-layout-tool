/**
 * Tests for the Liveblocks authentication endpoint.
 * Verifies permission-based access control for collaborative rooms.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Shared mock session that tests can inspect
const mockSession = {
  allow: vi.fn(),
  authorize: vi.fn().mockResolvedValue({ body: '{"token":"test"}', status: 200 }),
};

const mockPrepareSession = vi.fn().mockReturnValue(mockSession);

import type { VercelRequest, VercelResponse } from '@vercel/node';

function createMockRequest(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    body: {
      room: 'gridfinity-abc123xyz789',
      userId: 'user-123',
      userName: 'Test User',
    },
    headers: {},
    ...overrides,
  } as unknown as VercelRequest;
}

function createMockResponse(): VercelResponse & { _status: number; _body: unknown } {
  const res = {
    _status: 0,
    _body: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    send(body: unknown) {
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

function createShareData(permission: 'view' | 'edit') {
  return {
    layout: { version: '1.0', name: 'Test' },
    metadata: {
      deleteTokenHash: 'hash123',
      createdAt: '2024-01-01T00:00:00Z',
      lastUpdatedAt: '2024-01-01T00:00:00Z',
      lastAccessedAt: '2024-01-01T00:00:00Z',
      permission,
      reportCount: 0,
    },
  };
}

describe('liveblocks-auth handler', () => {
  let handler: (req: VercelRequest, res: VercelResponse) => Promise<unknown>;
  let mockHead: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'sk_test_123');
    vi.stubGlobal('fetch', vi.fn());
    mockPrepareSession.mockClear();
    mockSession.allow.mockClear();
    mockSession.authorize.mockClear();
    mockSession.authorize.mockResolvedValue({ body: '{"token":"test"}', status: 200 });

    // Reset modules to clear the _liveblocks singleton
    vi.resetModules();

    mockHead = vi.fn();

    vi.doMock('@vercel/blob', () => ({
      head: mockHead,
    }));
    vi.doMock('@liveblocks/node', () => ({
      Liveblocks: class MockLiveblocks {
        prepareSession = mockPrepareSession;
      },
    }));
    vi.doMock('./lib/rateLimit.js', () => ({
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
    }));

    const mod = await import('./liveblocks-auth.js');
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
  });

  it('returns 500 if LIVEBLOCKS_SECRET_KEY is not configured', async () => {
    vi.stubEnv('LIVEBLOCKS_SECRET_KEY', '');
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(500);
    expect(res._body).toEqual(expect.objectContaining({ code: 'CONFIGURATION_ERROR' }));
  });

  it('rejects requests without room ID', async () => {
    const req = createMockRequest({ body: { userId: 'user-1' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual(expect.objectContaining({ error: 'Missing room ID' }));
  });

  it('rejects invalid room ID format', async () => {
    const req = createMockRequest({ body: { room: 'invalid-room', userId: 'user-1' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual(expect.objectContaining({ error: 'Invalid room ID format' }));
  });

  it('rejects invalid share ID in room', async () => {
    const req = createMockRequest({ body: { room: 'gridfinity-!!!', userId: 'user-1' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual(expect.objectContaining({ error: 'Invalid share ID' }));
  });

  it('rejects requests without user ID', async () => {
    const req = createMockRequest({ body: { room: 'gridfinity-abc123xyz789' } });
    const res = createMockResponse();

    await handler(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual(expect.objectContaining({ error: 'Missing user ID' }));
  });

  it('returns 404 when share does not exist in blob storage', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    mockHead.mockRejectedValueOnce(new Error('Not found'));

    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toEqual(expect.objectContaining({ error: 'Share not found' }));
  });

  it('returns 404 when blob fetch fails', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);

    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toEqual(expect.objectContaining({ error: 'Share not found' }));
  });

  it('grants write access for edit permission', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createShareData('edit')),
    } as Response);

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(mockSession.allow).toHaveBeenCalledWith('gridfinity-abc123xyz789', ['*:write']);
  });

  it('grants read access for view permission', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createShareData('view')),
    } as Response);

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(mockSession.allow).toHaveBeenCalledWith('gridfinity-abc123xyz789', ['*:read']);
  });

  it('uses userName when provided', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createShareData('edit')),
    } as Response);

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(mockPrepareSession).toHaveBeenCalledWith('user-123', {
      userInfo: expect.objectContaining({ name: 'Test User' }),
    });
  });

  it('defaults to Guest when userName is not provided', async () => {
    const req = createMockRequest({
      body: { room: 'gridfinity-abc123xyz789', userId: 'user-123' },
    });
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createShareData('edit')),
    } as Response);

    await handler(req, res);

    expect(res._status).toBe(200);
    expect(mockPrepareSession).toHaveBeenCalledWith('user-123', {
      userInfo: expect.objectContaining({ name: 'Guest' }),
    });
  });

  it('accepts UUID-format share IDs', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = createMockRequest({
      body: { room: `gridfinity-${uuid}`, userId: 'user-123' },
    });
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createShareData('edit')),
    } as Response);

    await handler(req, res);

    expect(res._status).toBe(200);
  });

  it('accepts base36 timestamp format share IDs', async () => {
    const base36Id = 'lszwz1k7v-8j2kqp1';
    const req = createMockRequest({
      body: { room: `gridfinity-${base36Id}`, userId: 'user-123' },
    });
    const res = createMockResponse();

    mockHead.mockResolvedValueOnce({ url: 'https://blob.example.com/test' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createShareData('edit')),
    } as Response);

    await handler(req, res);

    expect(res._status).toBe(200);
  });
});
