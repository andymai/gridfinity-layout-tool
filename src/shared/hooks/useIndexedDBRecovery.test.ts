import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock dependencies before importing the hook
vi.mock('@/core/storage', () => ({
  loadLayoutAsync: vi.fn(),
}));

vi.mock('@/core/storage/LayoutManager', () => ({
  computePreview: vi.fn(() => ({ binCount: 0, layerCount: 0 })),
}));

vi.mock('@/core/store', () => ({
  useLayoutStore: {
    getState: vi.fn(() => ({
      importLayout: vi.fn(),
    })),
  },
  useLibraryStore: {
    getState: vi.fn(() => ({
      library: { activeLayoutId: 'placeholder-id' },
      updateEntry: vi.fn(),
    })),
  },
}));

vi.mock('@/core/store/toast', () => ({
  useToastStore: {
    getState: vi.fn(() => ({
      addToast: vi.fn(),
    })),
  },
  INITIAL_TOAST_STATE: {},
}));

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let storage: typeof import('@/core/storage');
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let layoutStore: typeof import('@/core/store');
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let toastStore: typeof import('@/core/store/toast');

const ORIGINAL_IDS = ['original-layout-1', 'original-layout-2'];

async function resetModule() {
  vi.resetModules();
  storage = await import('@/core/storage');
  layoutStore = await import('@/core/store');
  toastStore = await import('@/core/store/toast');
}

describe('useIndexedDBRecovery', () => {
  let originalRequestIdleCallback: typeof window.requestIdleCallback | undefined;

  beforeEach(async () => {
    await resetModule();
    vi.clearAllMocks();
    originalRequestIdleCallback = window.requestIdleCallback;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (originalRequestIdleCallback !== undefined) {
      window.requestIdleCallback = originalRequestIdleCallback;
    }
  });

  function setupIdleCallback() {
    window.requestIdleCallback = vi.fn((cb) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
  }

  it('does NOT trigger when needsRecovery is false', async () => {
    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');
    renderHook(() => useIndexedDBRecovery(false, []));

    await vi.runAllTimersAsync();

    expect(storage.loadLayoutAsync).not.toHaveBeenCalled();
  });

  it('scans original layout IDs from IndexedDB', async () => {
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(null);
    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');
    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));

    await vi.runAllTimersAsync();

    expect(storage.loadLayoutAsync).toHaveBeenCalledWith('original-layout-1');
    expect(storage.loadLayoutAsync).toHaveBeenCalledWith('original-layout-2');
  });

  it('imports recovered layout and shows toast when IndexedDB has data', async () => {
    const recoveredLayout = {
      name: 'My real layout',
      bins: [{ id: 'bin-1', position: { x: 0, y: 0 }, size: { w: 1, d: 1, h: 3 }, layerId: 'l1' }],
    };

    const mockImportLayout = vi.fn();
    const mockUpdateEntry = vi.fn();
    const mockAddToast = vi.fn();

    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(recoveredLayout as never);
    vi.mocked(layoutStore.useLayoutStore.getState).mockReturnValue({
      importLayout: mockImportLayout,
    } as never);
    vi.mocked(layoutStore.useLibraryStore.getState).mockReturnValue({
      library: { activeLayoutId: 'placeholder-id' },
      updateEntry: mockUpdateEntry,
    } as never);
    vi.mocked(toastStore.useToastStore.getState).mockReturnValue({
      addToast: mockAddToast,
    } as never);

    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');
    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));

    await vi.runAllTimersAsync();

    expect(mockImportLayout).toHaveBeenCalledWith(recoveredLayout, 'placeholder-id', 'init');
    expect(mockUpdateEntry).toHaveBeenCalledWith(
      'placeholder-id',
      expect.objectContaining({ name: 'My real layout' })
    );
    expect(mockAddToast).toHaveBeenCalledWith('toast.layoutRecovered', 'success');
  });

  it('stops scanning after first successful recovery', async () => {
    const layout1 = { name: 'Layout 1', bins: [{ id: 'b1' }] };

    vi.mocked(storage.loadLayoutAsync).mockResolvedValueOnce(layout1 as never);
    vi.mocked(layoutStore.useLayoutStore.getState).mockReturnValue({
      importLayout: vi.fn(),
    } as never);
    vi.mocked(layoutStore.useLibraryStore.getState).mockReturnValue({
      library: { activeLayoutId: 'placeholder-id' },
      updateEntry: vi.fn(),
    } as never);

    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');
    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));

    await vi.runAllTimersAsync();

    // Should stop after finding first layout with bins
    expect(storage.loadLayoutAsync).toHaveBeenCalledTimes(1);
  });

  it('does nothing when IndexedDB returns null for all IDs', async () => {
    const mockImportLayout = vi.fn();

    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(null);
    vi.mocked(layoutStore.useLayoutStore.getState).mockReturnValue({
      importLayout: mockImportLayout,
    } as never);

    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');
    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));

    await vi.runAllTimersAsync();

    expect(mockImportLayout).not.toHaveBeenCalled();
  });

  it('recovers empty layouts (0 bins) without skipping them', async () => {
    const emptyLayout = { bins: [], name: 'Empty' };
    const mockImportLayout = vi.fn();

    vi.mocked(storage.loadLayoutAsync).mockResolvedValueOnce(emptyLayout as never);
    vi.mocked(layoutStore.useLayoutStore.getState).mockReturnValue({
      importLayout: mockImportLayout,
    } as never);
    vi.mocked(layoutStore.useLibraryStore.getState).mockReturnValue({
      library: { activeLayoutId: 'placeholder-id' },
      updateEntry: vi.fn(),
    } as never);

    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');
    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));

    await vi.runAllTimersAsync();

    // Should recover the first layout found, even if empty
    expect(mockImportLayout).toHaveBeenCalled();
    expect(storage.loadLayoutAsync).toHaveBeenCalledTimes(1);
  });

  it('does not throw when loadLayoutAsync rejects', async () => {
    vi.mocked(storage.loadLayoutAsync).mockRejectedValue(new Error('IndexedDB unavailable'));
    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');

    expect(() => renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS))).not.toThrow();

    await vi.runAllTimersAsync();
  });

  it('only runs once per session even with multiple mounts', async () => {
    vi.mocked(storage.loadLayoutAsync).mockResolvedValue(null);
    setupIdleCallback();

    const { useIndexedDBRecovery } = await import('@/shared/hooks/useIndexedDBRecovery');

    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));
    await vi.runAllTimersAsync();

    renderHook(() => useIndexedDBRecovery(true, ORIGINAL_IDS));
    await vi.runAllTimersAsync();

    // Called once per original ID, but only in the first mount
    expect(storage.loadLayoutAsync).toHaveBeenCalledTimes(2);
  });
});
