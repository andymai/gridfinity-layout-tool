import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStorageInfo } from './useStorageInfo';
import { useLibraryStore } from '@/core/store';

vi.mock('@/core/storage', () => ({
  getStorageBackend: vi.fn(),
  getStorageUsage: vi.fn(),
}));

// Import mocks after vi.mock
const { getStorageBackend, getStorageUsage } = await import('@/core/storage');
const mockGetBackend = vi.mocked(getStorageBackend);
const mockGetUsage = vi.mocked(getStorageUsage);

describe('useStorageInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBackend.mockResolvedValue('indexeddb');
    mockGetUsage.mockReturnValue(12);
    useLibraryStore.setState({
      library: { entries: [{ id: 'l1' }, { id: 'l2' }] },
    } as never);

    // Mock navigator.storage.estimate (use Object.create to preserve prototype chain)
    const nav = Object.create(navigator);
    nav.storage = {
      estimate: vi.fn().mockResolvedValue({ usage: 500_000, quota: 1_000_000_000 }),
    };
    vi.stubGlobal('navigator', nav);
  });

  it('starts in loading state then resolves', async () => {
    const { result } = renderHook(() => useStorageInfo());

    // These are true synchronously before the async useEffect resolves.
    expect(result.current.loading).toBe(true);
    expect(result.current.backend).toBeNull();

    // Drain the pending async useEffect so it doesn't leak into the next test.
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('resolves with backend, usage, and storage estimate', async () => {
    const { result } = renderHook(() => useStorageInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backend).toBe('indexeddb');
    expect(result.current.localStoragePercent).toBe(12);
    expect(result.current.indexedDBBytes).toBe(500_000);
    expect(result.current.quotaBytes).toBe(1_000_000_000);
    expect(result.current.layoutCount).toBe(2);
  });

  it('handles Storage API unavailable', async () => {
    const nav = Object.create(navigator);
    nav.storage = {
      estimate: vi.fn().mockRejectedValue(new Error('Not supported')),
    };
    vi.stubGlobal('navigator', nav);

    const { result } = renderHook(() => useStorageInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.indexedDBBytes).toBeNull();
    expect(result.current.quotaBytes).toBeNull();
    expect(result.current.backend).toBe('indexeddb');
  });

  it('uses localStorage backend when IndexedDB not available', async () => {
    mockGetBackend.mockResolvedValue('localstorage');

    const { result } = renderHook(() => useStorageInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backend).toBe('localstorage');
  });

  it('tracks layout count from library store', async () => {
    useLibraryStore.setState({
      library: {
        entries: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }, { id: 'l5' }],
      },
    } as never);

    const { result } = renderHook(() => useStorageInfo());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.layoutCount).toBe(5);
  });
});
