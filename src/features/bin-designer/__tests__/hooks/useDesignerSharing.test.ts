import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  createDesignerShare,
  fetchDesignerShare,
  useDesignerSharing,
} from '../../hooks/useDesignerSharing';
import { isOk, isErr } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '../../constants/defaults';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock uuid
vi.mock('@/shared/utils/uuid', () => ({
  generateUUID: () => 'test-uuid-1234',
}));

describe('createDesignerShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends correct payload and returns success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'share-id-abc',
        url: 'https://example.com/d/share-id-abc',
        deleteToken: 'del-token-xyz',
      }),
    });

    const result = await createDesignerShare(DEFAULT_BIN_PARAMS);

    expect(mockFetch).toHaveBeenCalledWith('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"type":"designer"'),
    });

    // Verify the body structure
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe('designer');
    expect(body.version).toBe(1);
    expect(body.params).toEqual(DEFAULT_BIN_PARAMS);
    expect(body.layoutId).toBe('test-uuid-1234');
    expect(body.permission).toBe('view');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe('share-id-abc');
      expect(result.value.url).toBe('https://example.com/d/share-id-abc');
      expect(result.value.deleteToken).toBe('del-token-xyz');
    }
  });

  it('returns error on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Rate limited',
        code: 'RATE_LIMITED',
      }),
    });

    const result = await createDesignerShare(DEFAULT_BIN_PARAMS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('RATE_LIMITED');
      expect(result.error.message).toBe('Rate limited');
    }
  });

  it('returns error with defaults when response has no code/error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const result = await createDesignerShare(DEFAULT_BIN_PARAMS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('SHARE_FAILED');
      expect(result.error.message).toBe('Failed to create share');
    }
  });

  it('returns network error on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const result = await createDesignerShare(DEFAULT_BIN_PARAMS);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('NETWORK_ERROR');
      expect(result.error.message).toContain('Network error');
    }
  });
});

describe('fetchDesignerShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns designer params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        layout: {
          type: 'designer',
          version: 1,
          params: DEFAULT_BIN_PARAMS,
        },
      }),
    });

    const result = await fetchDesignerShare('share-id-abc');

    expect(mockFetch).toHaveBeenCalledWith('/api/share/share-id-abc');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(DEFAULT_BIN_PARAMS);
    }
  });

  it('returns error for non-designer shares', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        layout: { bins: [], drawer: {} }, // layout share, not designer
      }),
    });

    const result = await fetchDesignerShare('some-id');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('WRONG_TYPE');
      expect(result.error.message).toContain('not a bin design');
    }
  });

  it('returns error for corrupted designer share (no params)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        layout: { type: 'designer', version: 1 }, // missing params
      }),
    });

    const result = await fetchDesignerShare('some-id');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('INVALID_DATA');
    }
  });

  it('returns error on not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Not found',
        code: 'NOT_FOUND',
      }),
    });

    const result = await fetchDesignerShare('nonexistent');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns network error on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));

    const result = await fetchDesignerShare('any-id');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('NETWORK_ERROR');
    }
  });
});

describe('useDesignerSharing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with idle status', () => {
    const { result } = renderHook(() => useDesignerSharing());

    expect(result.current.status).toBe('idle');
    expect(result.current.shareUrl).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('share transitions to success with URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'id-1',
        url: 'https://example.com/d/id-1',
        deleteToken: 'tok',
      }),
    });

    const { result } = renderHook(() => useDesignerSharing());

    await act(async () => {
      await result.current.share(DEFAULT_BIN_PARAMS);
    });

    expect(result.current.status).toBe('success');
    expect(result.current.shareUrl).toBe('https://example.com/d/id-1');
    expect(result.current.error).toBeNull();
  });

  it('share transitions to error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Server error',
        code: 'SERVER_ERROR',
      }),
    });

    const { result } = renderHook(() => useDesignerSharing());

    await act(async () => {
      await result.current.share(DEFAULT_BIN_PARAMS);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Server error');
    expect(result.current.shareUrl).toBeNull();
  });

  it('loadShared returns params on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        layout: {
          type: 'designer',
          version: 1,
          params: { ...DEFAULT_BIN_PARAMS, width: 4 },
        },
      }),
    });

    const { result } = renderHook(() => useDesignerSharing());
    let loadedParams: unknown;

    await act(async () => {
      loadedParams = await result.current.loadShared('id-abc');
    });

    expect(result.current.status).toBe('success');
    expect(loadedParams).toEqual({ ...DEFAULT_BIN_PARAMS, width: 4 });
  });

  it('loadShared returns null on error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: 'Not found',
        code: 'NOT_FOUND',
      }),
    });

    const { result } = renderHook(() => useDesignerSharing());
    let loadedParams: unknown;

    await act(async () => {
      loadedParams = await result.current.loadShared('bad-id');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Not found');
    expect(loadedParams).toBeNull();
  });

  it('reset returns to idle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'x',
        url: 'https://example.com/d/x',
        deleteToken: 'tok',
      }),
    });

    const { result } = renderHook(() => useDesignerSharing());

    await act(async () => {
      await result.current.share(DEFAULT_BIN_PARAMS);
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.shareUrl).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
