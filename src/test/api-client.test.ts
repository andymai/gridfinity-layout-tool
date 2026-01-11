/**
 * Tests for the cloud share API client.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createShare,
  updateShare,
  fetchShare,
  deleteShare,
  reportShare,
  getErrorMessage,
} from '../api/share';
import type { Layout } from '../types';

// Mock layout for testing
const mockLayout: Layout = {
  version: '1.0',
  name: 'Test Layout',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [{ id: 'cat1', name: 'Default', color: '#888888' }],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [],
};

describe('createShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success with share data on 201 response', async () => {
    const mockResponse = {
      id: 'abc123xyz789',
      url: 'https://example.com/s/abc123xyz789',
      deleteToken: 'token123',
      expiresAt: '2024-02-01T00:00:00.000Z',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await createShare(mockLayout, 30);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('abc123xyz789');
      expect(result.data.deleteToken).toBe('token123');
    }

    expect(fetch).toHaveBeenCalledWith('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"name":"Test Layout"'),
    });
  });

  it('returns error on rate limit response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 3600,
      }),
    } as Response);

    const result = await createShare(mockLayout, 30);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('RATE_LIMITED');
      expect(result.error.retryAfter).toBe(3600);
    }
  });

  it('returns network error on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await createShare(mockLayout, 30);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NETWORK_ERROR');
    }
  });

  it('includes author name when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'test', url: 'url', deleteToken: 'token', expiresAt: '' }),
    } as Response);

    await createShare(mockLayout, 30, 'Test Author');

    expect(fetch).toHaveBeenCalledWith('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"authorName":"Test Author"'),
    });
  });
});

describe('updateShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success on 200 response', async () => {
    const mockResponse = {
      id: 'abc123xyz789',
      url: 'https://example.com/s/abc123xyz789',
      expiresAt: '2024-02-01T00:00:00.000Z',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await updateShare('abc123xyz789', 'token123', mockLayout, 60);

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/share/abc123xyz789', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"deleteToken":"token123"'),
    });
  });

  it('returns unauthorized error on 401 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid token',
        code: 'UNAUTHORIZED',
      }),
    } as Response);

    const result = await updateShare('abc123xyz789', 'wrong-token', mockLayout, 60);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('fetchShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns layout and metadata on success', async () => {
    const mockResponse = {
      layout: mockLayout,
      metadata: {
        expiresAt: '2024-02-01T00:00:00.000Z',
        expiresInDays: 30,
        createdAt: '2024-01-01T00:00:00.000Z',
        authorName: 'Test Author',
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await fetchShare('abc123xyz789');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layout.name).toBe('Test Layout');
      expect(result.data.metadata.authorName).toBe('Test Author');
    }

    expect(fetch).toHaveBeenCalledWith('/api/share/abc123xyz789');
  });

  it('returns not found error on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Share not found',
        code: 'NOT_FOUND',
      }),
    } as Response);

    const result = await fetchShare('nonexistent');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('deleteShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success on successful delete', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Deleted' }),
    } as Response);

    const result = await deleteShare('abc123xyz789', 'token123');

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/share/abc123xyz789', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Delete-Token': 'token123',
      },
    });
  });

  it('returns unauthorized error with wrong token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid token',
        code: 'UNAUTHORIZED',
      }),
    } as Response);

    const result = await deleteShare('abc123xyz789', 'wrong-token');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('reportShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns success on report', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Report submitted' }),
    } as Response);

    const result = await reportShare('abc123xyz789', 'Offensive content');

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/report/abc123xyz789', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Offensive content' }),
    });
  });

  it('works without reason', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Report submitted' }),
    } as Response);

    const result = await reportShare('abc123xyz789');

    expect(result.success).toBe(true);
  });
});

describe('getErrorMessage', () => {
  it('returns friendly message for rate limit with retry time', () => {
    const message = getErrorMessage({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      retryAfter: 120,
    });

    expect(message).toContain('2 minute');
  });

  it('returns friendly message for size limit', () => {
    const message = getErrorMessage({
      error: 'Layout too large',
      code: 'SIZE_LIMIT',
    });

    expect(message).toContain('500KB');
  });

  it('returns friendly message for bin limit', () => {
    const message = getErrorMessage({
      error: 'Too many bins',
      code: 'BIN_LIMIT',
    });

    expect(message).toContain('2500');
  });

  it('returns friendly message for content blocked', () => {
    const message = getErrorMessage({
      error: 'Content blocked',
      code: 'CONTENT_BLOCKED',
    });

    expect(message).toContain('inappropriate');
  });

  it('returns friendly message for not found', () => {
    const message = getErrorMessage({
      error: 'Not found',
      code: 'NOT_FOUND',
    });

    expect(message).toContain('expired');
  });

  it('returns friendly message for unauthorized', () => {
    const message = getErrorMessage({
      error: 'Invalid token',
      code: 'UNAUTHORIZED',
    });

    expect(message).toContain('token');
  });

  it('returns friendly message for network error', () => {
    const message = getErrorMessage({
      error: 'Network failed',
      code: 'NETWORK_ERROR',
    });

    expect(message).toContain('internet');
  });

  it('falls back to original error for unknown codes', () => {
    const message = getErrorMessage({
      error: 'Something went wrong',
      code: 'VALIDATION_ERROR',
    });

    expect(message).toBe('Something went wrong');
  });
});
