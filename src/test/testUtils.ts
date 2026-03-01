import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { expect } from 'vitest';
import type { Bin, Layout, LayoutLibrary, BinId, LayoutId } from '@/core/types';
import { binId, layerId, categoryId, layoutId } from '@/core/types';
import type { Result } from '@/core/result/types';
import { isOk, isErr } from '@/core/result';
import { createDefaultLayout } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { useToastStore } from '@/core/store/toast';
import { INITIAL_TOAST_STATE } from '@/core/store/toast';
import { useSettingsStore, DEFAULT_SETTINGS } from '@/core/store/settings';
import { useLibraryStore } from '@/core/store/library';
import { useLabsStore } from '@/core/store';
import { createDefaultLabsPreferences } from '@/core/labs';
import { useSelectionStore, INITIAL_SELECTION_STATE } from '@/core/store/selection';
import { useViewStore, INITIAL_VIEW_STATE } from '@/core/store/view';
import { useInteractionStore, INITIAL_INTERACTION_STATE } from '@/core/store/interaction';
import { useMobileStore, INITIAL_MOBILE_STATE } from '@/core/store/mobile';
import { useHalfBinModeStore, INITIAL_HALF_BIN_MODE_STATE } from '@/core/store/halfBinMode';
import { useSharedPreviewStore, INITIAL_SHARED_PREVIEW_STATE } from '@/core/store/sharedPreview';
import { useSnapshotStore, INITIAL_SNAPSHOT_STATE } from '@/core/store/snapshots';

/**
 * Reset individual stores for tests that only need partial isolation.
 * Use these instead of resetAllStores() when your test only touches 1-2 stores.
 */
export function resetLayoutStore(): void {
  useLayoutStore.setState({
    layout: createDefaultLayout(),
    activeLayoutId: null,
    lastEditSource: null,
    _fillMeta: null,
  });
}

export function resetSelectionStore(): void {
  useSelectionStore.setState(INITIAL_SELECTION_STATE);
}

export function resetInteractionStore(): void {
  useInteractionStore.setState(INITIAL_INTERACTION_STATE);
}

export function resetHistoryStore(): void {
  useHistoryStore.setState({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });
}

export function resetViewStore(): void {
  useViewStore.setState(INITIAL_VIEW_STATE);
}

export function resetLibraryStore(): void {
  useLibraryStore.setState({
    library: createTestLibrary(),
    isLoaded: false,
    showLayoutManager: false,
    sharedWithMe: [],
    sharedWithMeLoaded: false,
  });
}

/**
 * Reset all Zustand stores to their initial state.
 * Call this in beforeEach for complete test isolation.
 */
export function resetAllStores(): void {
  // Layout store
  useLayoutStore.setState({
    layout: createDefaultLayout(),
    activeLayoutId: null,
    lastEditSource: null,
    _fillMeta: null,
  });

  // Selection store
  useSelectionStore.setState(INITIAL_SELECTION_STATE);

  // View store
  useViewStore.setState(INITIAL_VIEW_STATE);

  // Interaction store
  useInteractionStore.setState(INITIAL_INTERACTION_STATE);

  // Mobile store
  useMobileStore.setState(INITIAL_MOBILE_STATE);

  // Half-bin mode store
  useHalfBinModeStore.setState(INITIAL_HALF_BIN_MODE_STATE);

  // Shared preview store
  useSharedPreviewStore.setState(INITIAL_SHARED_PREVIEW_STATE);

  // History store
  useHistoryStore.setState({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });

  // Toast store
  useToastStore.setState(INITIAL_TOAST_STATE);

  // Settings store
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });

  // Library store - create minimal valid state
  useLibraryStore.setState({
    library: createTestLibrary(),
    isLoaded: false,
    showLayoutManager: false,
    sharedWithMe: [],
    sharedWithMeLoaded: false,
  });

  // Labs store
  useLabsStore.setState({
    preferences: createDefaultLabsPreferences(),
    isDrawerOpen: false,
  });

  // Snapshot store
  useSnapshotStore.setState(INITIAL_SNAPSHOT_STATE);
}

/**
 * Extract a bin ID from an addBin() Result, throwing if the operation failed.
 * Replaces the duplicated getBinId() helpers across hook test files.
 *
 * @example
 * const binId = getBinId(addBin({ layerId, x: 0, y: 0, ... }));
 */
export function getBinId(result: Result<BinId, unknown>): BinId {
  if (!isOk(result)) throw new Error('addBin failed');
  return result.value;
}

/**
 * Factory to create test bins with variations.
 * Prevents inline factory duplication across test files.
 *
 * @param overrides - Partial bin to merge with defaults
 * @returns A new Bin object
 *
 * @example
 * const bin = createTestBin({ id: 'bin-1', x: 3, y: 5 });
 * const stagingBin = createTestBin({ layerId: '__staging__' });
 */
export function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: binId('test-bin'),
    layerId: layerId('layer1'),
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    category: categoryId('cat1'),
    label: '',
    notes: '',
    ...overrides,
  };
}

/**
 * Assert that a Result is Ok and return the unwrapped value.
 * Combines the assertion and type narrowing in one step, replacing:
 *
 *   expect(isOk(result)).toBe(true);
 *   if (isOk(result)) { expect(result.value).toBe(42); }
 *
 * With:
 *
 *   expect(expectOk(result)).toBe(42);
 */
export function expectOk<T>(result: Result<T, unknown>): T {
  expect(isOk(result)).toBe(true);
  if (!isOk(result)) throw new Error('Expected Ok result');
  return result.value;
}

/**
 * Assert that a Result is Err and return the unwrapped error.
 * Combines the assertion and type narrowing in one step, replacing:
 *
 *   expect(isErr(result)).toBe(true);
 *   if (isErr(result)) { expect(result.error.code).toBe('NOT_FOUND'); }
 *
 * With:
 *
 *   expect(expectErr(result).code).toBe('NOT_FOUND');
 */
export function expectErr<E>(result: Result<unknown, E>): E {
  expect(isErr(result)).toBe(true);
  if (!isErr(result)) throw new Error('Expected Err result');
  return result.error;
}

/**
 * Create a test library with one default entry.
 * Used by resetAllStores and can be used in tests that need custom library setup.
 *
 * @param layoutId - Optional layout ID (generates one if not provided)
 * @returns A valid LayoutLibrary structure
 */
export function createTestLibrary(id?: LayoutId): LayoutLibrary {
  const resolvedId = id || layoutId('test-layout-id');
  return {
    version: '1.0',
    activeLayoutId: resolvedId,
    settings: {},
    entries: [
      {
        id: resolvedId,
        name: 'Test Layout',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        preview: {
          drawerWidth: 10,
          drawerDepth: 8,
          drawerHeight: 12,
          binCount: 0,
          layerCount: 1,
          binMap: [],
        },
      },
    ],
  };
}

/**
 * Factory to create test layouts with variations.
 * Prevents module-level shared data mutations by returning new instances.
 *
 * @param overrides - Partial layout to merge with defaults
 * @returns A new layout object
 *
 * @example
 * const layout = createTestLayout({ name: 'Custom Layout' });
 * const layoutWithBins = createTestLayout({ bins: [testBin1, testBin2] });
 */
export function createTestLayout(overrides?: Partial<Layout>): Layout {
  // Use deterministic defaults instead of createDefaultLayout() which generates random IDs.
  // This ensures tests can reference layer/category IDs predictably.
  const defaultLayout: Layout = {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: categoryId('cat1'), name: 'General', color: '#3b82f6' }],
    layers: [{ id: layerId('layer1'), name: 'Layer 1', height: 3 }],
    bins: [],
  };

  if (!overrides) {
    return defaultLayout;
  }

  // Deep merge for nested objects (drawer, categories, layers, bins)
  return {
    ...defaultLayout,
    ...overrides,
    // Ensure arrays and objects are properly merged
    drawer: overrides.drawer
      ? { ...defaultLayout.drawer, ...overrides.drawer }
      : defaultLayout.drawer,
    categories: overrides.categories || [...defaultLayout.categories],
    layers: overrides.layers || [...defaultLayout.layers],
    bins: overrides.bins || [],
  };
}

/**
 * Create an isolated localStorage mock per test.
 * Returns the mock and a cleanup function to prevent cross-test pollution.
 *
 * This fixes the global localStorage mock issue in settings.test.ts where
 * a module-level mock polluted all subsequent test files.
 *
 * @returns Object with mock instance and cleanup function
 *
 * @example
 * let localStorageMock: ReturnType<typeof createIsolatedLocalStorageMock>;
 *
 * beforeEach(() => {
 *   localStorageMock = createIsolatedLocalStorageMock();
 *   Object.defineProperty(global, 'localStorage', {
 *     value: localStorageMock.mock,
 *     writable: true,
 *     configurable: true,
 *   });
 * });
 *
 * afterEach(() => {
 *   localStorageMock.cleanup();
 * });
 */
export function createIsolatedLocalStorageMock() {
  let store: Record<string, string> = {};

  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: _, ...rest } = store;
      store = rest;
      void _; // Prevent unused variable warning
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    // Expose internal store for test assertions
    get _store() {
      return store;
    },
  };

  const cleanup = () => {
    store = {};
    mock.getItem.mockClear();
    mock.setItem.mockClear();
    mock.removeItem.mockClear();
    mock.clear.mockClear();
    mock.key.mockClear();
  };

  return { mock, cleanup };
}

/**
 * Setup consistent fake timers with Date.now() coordination.
 *
 * This fixes timestamp races where some tests use Date.now() while others
 * use fake timers, causing non-deterministic behavior.
 *
 * @returns Object with advanceTime and cleanup functions
 *
 * @example
 * let timerUtils: ReturnType<typeof setupFakeTimers>;
 *
 * beforeEach(() => {
 *   timerUtils = setupFakeTimers();
 * });
 *
 * afterEach(() => {
 *   timerUtils.cleanup();
 * });
 *
 * it('test with timing', () => {
 *   // Advance both timers AND Date.now()
 *   timerUtils.advanceTime(1000);
 *   // Assertions...
 * });
 */
export function setupFakeTimers() {
  let fakeTime = Date.now();

  vi.useFakeTimers();
  vi.setSystemTime(fakeTime);

  // Mock Date.now() to use fake timer time
  const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

  const advanceTime = (ms: number) => {
    fakeTime += ms;
    vi.advanceTimersByTime(ms);
    vi.setSystemTime(fakeTime);
  };

  const cleanup = () => {
    vi.useRealTimers();
    dateNowSpy.mockRestore();
  };

  return { advanceTime, cleanup };
}

/**
 * Global afterEach to ensure React Testing Library cleanup always runs.
 * This is imported in setup.ts to apply globally.
 *
 * NOTE: This does NOT call resetAllStores() - tests should control their own
 * store isolation. This just catches React component cleanup that tests forgot.
 */
export function setupGlobalCleanup() {
  afterEach(() => {
    cleanup(); // React Testing Library cleanup
  });
}

/**
 * Create storage mock functions with consistent behavior for tests.
 *
 * This helper is exported from this module and can be imported directly
 * when setting up mocks for the storage layer in your test files.
 *
 * Returns mock implementations for both legacy and new atomic storage functions.
 *
 * @example
 * import { createStorageMock } from '@/test/testUtils';
 *
 * vi.mock('../../storage', () => createStorageMock());
 */
export function createStorageMock() {
  const mockPreview = {
    drawerWidth: 10,
    drawerDepth: 8,
    drawerHeight: 12,
    binCount: 0,
    layerCount: 1,
    binMap: [],
  };

  return {
    // Storage functions
    saveLayoutSync: vi.fn(),
    saveLayoutAsync: vi.fn().mockResolvedValue(undefined),
    loadLayoutSync: vi.fn(),
    loadLayoutAsync: vi.fn(),
    deleteLayoutSync: vi.fn(),
    deleteLayoutAsync: vi.fn().mockResolvedValue(undefined),
    saveLibrary: vi.fn(),
    getLayoutStorageKey: vi.fn((id: string) => `gridfinity-layout-${id}`),
    saveLayoutResult: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    exportLayout: vi.fn(),
    importLayout: vi.fn(),
    downloadLayoutAsFile: vi.fn(),

    // New atomic functions from LayoutManager
    saveLayoutWithMetadata: vi
      .fn()
      .mockImplementation(
        (layoutId: string, _layout: unknown, library: { entries: Array<{ id: string }> }) => {
          const entry = library.entries.find((e: { id: string }) => e.id === layoutId);
          if (!entry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          return Promise.resolve({
            ok: true,
            value: {
              layoutId,
              entry: { ...entry, modifiedAt: Date.now(), preview: mockPreview },
              library,
            },
          });
        }
      ),
    createLayoutEntry: vi.fn().mockImplementation(
      (
        layout: {
          name: string;
          layers: Array<{ id: string }>;
          categories: Array<{ id: string }>;
        },
        library: { entries: unknown[] }
      ) => {
        const layoutId = 'new-layout-id';
        const entry = {
          id: layoutId,
          name: layout.name,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          preview: mockPreview,
        };
        return Promise.resolve({
          ok: true,
          value: {
            layoutId,
            entry,
            library: { ...library, entries: [...library.entries, entry] },
            layout,
          },
        });
      }
    ),
    deleteLayoutWithEntry: vi
      .fn()
      .mockImplementation(
        (layoutId: string, library: { entries: Array<{ id: string }>; activeLayoutId: string }) => {
          const remainingEntries = library.entries.filter((e: { id: string }) => e.id !== layoutId);
          const newActiveId =
            library.activeLayoutId === layoutId ? remainingEntries[0]?.id : undefined;
          return Promise.resolve({
            ok: true,
            value: {
              library: { ...library, entries: remainingEntries },
              newActiveId,
            },
          });
        }
      ),
    duplicateLayoutEntry: vi
      .fn()
      .mockImplementation(
        (sourceId: string, library: { entries: Array<{ id: string; name: string }> }) => {
          const sourceEntry = library.entries.find((e: { id: string }) => e.id === sourceId);
          if (!sourceEntry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          const layoutId = 'duplicated-layout-id';
          const newEntry = {
            id: layoutId,
            name: `${sourceEntry.name} (copy)`,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            preview: mockPreview,
          };
          return Promise.resolve({
            ok: true,
            value: {
              layoutId,
              entry: newEntry,
              library: { ...library, entries: [...library.entries, newEntry] },
              layout: {
                name: newEntry.name,
                layers: [{ id: 'layer-1' }],
                categories: [{ id: 'cat-1' }],
              },
            },
          });
        }
      ),
    switchActiveLayout: vi
      .fn()
      .mockImplementation(
        (
          _fromId: string,
          _fromLayout: unknown,
          toId: string,
          library: { entries: Array<{ id: string }> }
        ) => {
          const targetEntry = library.entries.find((e: { id: string }) => e.id === toId);
          if (!targetEntry) {
            return Promise.resolve({ ok: false, error: { code: 'STORAGE_NOT_FOUND' } });
          }
          return Promise.resolve({
            ok: true,
            value: {
              library: { ...library, activeLayoutId: toId },
              targetLayout: {
                name: 'Target Layout',
                layers: [{ id: 'layer-1' }],
                categories: [{ id: 'cat-1' }],
              },
              targetEntry,
            },
          });
        }
      ),
    renameLayoutEntry: vi
      .fn()
      .mockImplementation(
        (
          layoutId: string,
          newName: string,
          library: { entries: Array<{ id: string; name: string }> }
        ) => {
          const updatedEntries = library.entries.map((e: { id: string; name: string }) =>
            e.id === layoutId ? { ...e, name: newName, modifiedAt: Date.now() } : e
          );
          return { ok: true, value: { ...library, entries: updatedEntries } };
        }
      ),
    updateCloudShare: vi
      .fn()
      .mockImplementation(
        (layoutId: string, cloudShare: unknown, library: { entries: Array<{ id: string }> }) => {
          const updatedEntries = library.entries.map((e: { id: string }) =>
            e.id === layoutId ? { ...e, cloudShare } : e
          );
          return { ok: true, value: { ...library, entries: updatedEntries } };
        }
      ),
    computePreview: vi.fn(() => mockPreview),
  };
}
