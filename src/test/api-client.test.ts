/**
 * Tests for the cloud share API client.
 * All functions return Result<T, ApiError> for type-safe error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createShare,
  updateShare,
  fetchShare,
  deleteShare,
  reportShare,
} from '@/core/api/share';
import { isOk, isErr, getUserMessage } from '@/core/result';
import type { Layout } from '@/core/types';

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

  it('returns Ok with share data on success', async () => {
    const mockResponse = {
      id: 'abc123xyz789',
      url: 'https://example.com/s/abc123xyz789',
      deleteToken: 'token123',
      permission: 'view',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe('abc123xyz789');
      expect(result.value.deleteToken).toBe('token123');
    }
  });

  it('returns Err with ApiRateLimitedError on rate limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 3600,
      }),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_RATE_LIMITED');
      expect(result.error.kind).toBe('ApiError');
      if ('retryAfter' in result.error) {
        expect(result.error.retryAfter).toBe(3600);
      }
    }
  });

  it('returns Err with ApiNetworkError on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_NETWORK_ERROR');
      expect(result.error.kind).toBe('ApiError');
    }
  });

  it('returns Err with ApiSizeLimitError on size limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Layout too large',
        code: 'SIZE_LIMIT',
      }),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_SIZE_LIMIT');
    }
  });

  it('returns Err with ApiBinLimitError on bin limit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Too many bins',
        code: 'BIN_LIMIT',
      }),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_BIN_LIMIT');
    }
  });

  it('provides user-friendly message via getUserMessage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Layout too large',
        code: 'SIZE_LIMIT',
      }),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const message = getUserMessage(result.error);
      expect(message).toBeTruthy();
      expect(message).toContain('500KB');
    }
  });
});

describe('updateShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns Ok on success', async () => {
    const mockResponse = {
      id: 'abc123xyz789',
      url: 'https://example.com/s/abc123xyz789',
      permission: 'edit',
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await updateShare('abc123xyz789', 'token123', mockLayout, 'edit');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe('abc123xyz789');
    }
  });

  it('returns Err with ApiUnauthorizedError on unauthorized', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid token',
        code: 'UNAUTHORIZED',
      }),
    } as Response);

    const result = await updateShare('abc123xyz789', 'wrong-token', mockLayout, 'edit');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_UNAUTHORIZED');
    }
  });

  it('returns Err with ApiNotFoundError on not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Share not found',
        code: 'NOT_FOUND',
      }),
    } as Response);

    const result = await updateShare('nonexistent', 'token', mockLayout, 'edit');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_NOT_FOUND');
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

  it('returns Ok with layout and metadata on success', async () => {
    const mockResponse = {
      layout: mockLayout,
      metadata: {
        permission: 'view',
        createdAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-02T00:00:00.000Z',
        authorName: 'Test Author',
      },
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await fetchShare('abc123xyz789');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.layout.name).toBe('Test Layout');
      expect(result.value.metadata.authorName).toBe('Test Author');
    }
  });

  it('returns Err with ApiNotFoundError on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Share not found',
        code: 'NOT_FOUND',
      }),
    } as Response);

    const result = await fetchShare('nonexistent');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_NOT_FOUND');
    }
  });

  it('returns Err with ApiExpiredError on expired share', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Share expired',
        code: 'EXPIRED',
      }),
    } as Response);

    const result = await fetchShare('expired123');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_EXPIRED');
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

  it('returns Ok on successful delete', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Deleted' }),
    } as Response);

    const result = await deleteShare('abc123xyz789', 'token123');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.success).toBe(true);
    }
  });

  it('returns Err with ApiUnauthorizedError on invalid token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid token',
        code: 'UNAUTHORIZED',
      }),
    } as Response);

    const result = await deleteShare('abc123xyz789', 'wrong-token');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_UNAUTHORIZED');
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

  it('returns Ok on successful report', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, message: 'Report submitted' }),
    } as Response);

    const result = await reportShare('abc123xyz789', 'Offensive content');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.success).toBe(true);
    }
  });

  it('returns Err with ApiNotFoundError when share not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Share not found',
        code: 'NOT_FOUND',
      }),
    } as Response);

    const result = await reportShare('nonexistent');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_NOT_FOUND');
    }
  });
});

describe('API error mapping', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps CONTENT_BLOCKED to ApiContentBlockedError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Content blocked',
        code: 'CONTENT_BLOCKED',
      }),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_CONTENT_BLOCKED');
    }
  });

  it('maps INVALID_PERMISSION to ApiValidationError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid permission',
        code: 'INVALID_PERMISSION',
      }),
    } as Response);

    const result = await createShare(mockLayout, 'invalid' as 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      // INVALID_PERMISSION is mapped to validation error
      expect(result.error.code).toBe('API_VALIDATION_ERROR');
    }
  });

  it('maps VALIDATION_ERROR to ApiValidationError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Invalid layout structure',
        code: 'VALIDATION_ERROR',
      }),
    } as Response);

    const result = await createShare(mockLayout, 'view');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('API_VALIDATION_ERROR');
    }
  });

  it('errors have timestamp for debugging', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
      }),
    } as Response);

    const beforeTime = Date.now();
    const result = await createShare(mockLayout, 'view');
    const afterTime = Date.now();

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(result.error.timestamp).toBeLessThanOrEqual(afterTime);
    }
  });
});
