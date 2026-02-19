import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDesignThumbnail, clearThumbnailCache } from './useDesignThumbnail';

// Mock DesignerStorage to avoid real IndexedDB
vi.mock('../storage/DesignerStorage', () => ({
  loadDesign: vi.fn(),
}));

import { loadDesign } from '../storage/DesignerStorage';
import { ok, err, storageNotFound } from '@/core/result';
import type { SavedDesign } from '../types';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';

function makeSavedDesign(overrides: Partial<SavedDesign> = {}): SavedDesign {
  return {
    id: 'design-1',
    name: 'Test Bin',
    params: DEFAULT_BIN_PARAMS,
    thumbnail: 'data:image/webp;base64,AAAA',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
    ...overrides,
  };
}

describe('useDesignThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearThumbnailCache();
  });

  it('returns null thumbnail and loading=true initially', () => {
    vi.mocked(loadDesign).mockReturnValue(new Promise(() => {})); // Never resolves
    const { result } = renderHook(() => useDesignThumbnail('design-1'));
    expect(result.current.thumbnail).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('loads thumbnail from IndexedDB', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(makeSavedDesign()));
    const { result } = renderHook(() => useDesignThumbnail('design-1'));

    await waitFor(() => {
      expect(result.current.thumbnail).toBe('data:image/webp;base64,AAAA');
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('returns null when design not found', async () => {
    vi.mocked(loadDesign).mockResolvedValue(err(storageNotFound('not found')));
    const { result } = renderHook(() => useDesignThumbnail('missing'));

    await waitFor(() => {
      expect(result.current.thumbnail).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('returns null when design has no thumbnail', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(makeSavedDesign({ thumbnail: null })));
    const { result } = renderHook(() => useDesignThumbnail('design-1'));

    await waitFor(() => {
      expect(result.current.thumbnail).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('caches thumbnail and does not re-fetch', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(makeSavedDesign()));
    const { result, rerender } = renderHook(() => useDesignThumbnail('design-1'));

    await waitFor(() => {
      expect(result.current.thumbnail).toBe('data:image/webp;base64,AAAA');
    });

    // Re-render should use cache, not call loadDesign again
    rerender();
    expect(loadDesign).toHaveBeenCalledTimes(1);
    expect(result.current.thumbnail).toBe('data:image/webp;base64,AAAA');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns null for undefined designId', () => {
    const { result } = renderHook(() => useDesignThumbnail(undefined));
    expect(result.current.thumbnail).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(loadDesign).not.toHaveBeenCalled();
  });

  it('fetches new thumbnail when designId changes', async () => {
    vi.mocked(loadDesign)
      .mockResolvedValueOnce(ok(makeSavedDesign({ id: 'a', thumbnail: 'thumb-a' })))
      .mockResolvedValueOnce(ok(makeSavedDesign({ id: 'b', thumbnail: 'thumb-b' })));

    const { result, rerender } = renderHook(({ id }) => useDesignThumbnail(id), {
      initialProps: { id: 'a' as string | undefined },
    });

    await waitFor(() => {
      expect(result.current.thumbnail).toBe('thumb-a');
    });

    rerender({ id: 'b' });

    await waitFor(() => {
      expect(result.current.thumbnail).toBe('thumb-b');
    });
  });

  it('clears cache via clearThumbnailCache', async () => {
    vi.mocked(loadDesign).mockResolvedValue(ok(makeSavedDesign()));
    const { result } = renderHook(() => useDesignThumbnail('design-1'));

    await waitFor(() => {
      expect(result.current.thumbnail).toBe('data:image/webp;base64,AAAA');
    });

    act(() => {
      clearThumbnailCache();
    });

    // After clearing, next render should re-fetch
    vi.mocked(loadDesign).mockResolvedValue(
      ok(makeSavedDesign({ thumbnail: 'data:image/webp;base64,BBBB' }))
    );

    const { result: result2 } = renderHook(() => useDesignThumbnail('design-1'));

    await waitFor(() => {
      expect(result2.current.thumbnail).toBe('data:image/webp;base64,BBBB');
    });
    expect(loadDesign).toHaveBeenCalledTimes(2);
  });
});
