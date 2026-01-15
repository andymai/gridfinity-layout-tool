import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { Layout, LayoutLibrary } from '../types';
import { createDefaultLayout } from '../constants';
import { useLayoutStore } from '../store/layout';
import { useHistoryStore } from '../store/history';
import { useToastStore } from '../store/toast';
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settings';
import { useLibraryStore } from '../store/library';
import { useLabsStore } from '../store/labs';
import { createDefaultLabsPreferences } from '../labs/types';
// New stores extracted from ui.ts
import { useSelectionStore } from '../store/selection';
import { useViewStore } from '../store/view';
import { useInteractionStore } from '../store/interaction';
import { useMobileStore } from '../store/mobile';
import { useHalfBinModeStore } from '../store/halfBinMode';
import { useSharedPreviewStore } from '../store/sharedPreview';

/**
 * Reset all Zustand stores to their initial state.
 * Call this in beforeEach for complete test isolation.
 *
 * This prevents cross-test pollution by resetting:
 * - Layout store (layout data and activeLayoutId)
 * - UI store (selection, zoom, panels, interaction state)
 * - History store (undo/redo stacks)
 * - Toast store (notifications)
 * - Settings store (user preferences)
 * - Library store (layout library and metadata)
 */
export function resetAllStores(): void {
  // Layout store
  useLayoutStore.setState({
    layout: createDefaultLayout(),
    activeLayoutId: null,
  });

  // Selection store
  useSelectionStore.setState({
    selectedBinIds: [],
    activeLayerId: '',
    activeCategoryId: 'coral',
    focusedBinId: null,
    quickLabelBinId: null,
  });

  // View store
  useViewStore.setState({
    zoom: 1,
    showOtherLayers: true,
    showLabels: true,
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    contextMenu: null,
    highlightedCategoryId: null,
    highlightedRowLabel: null,
    highlightedColLabel: null,
    printModalOpen: false,
  });

  // Interaction store
  useInteractionStore.setState({
    interaction: null,
    dropTarget: null,
    paintSize: null,
    keyboardDragMode: false,
    keyboardResizeMode: false,
    liveMessage: null,
    showIsometricPreview: false, // Match InteractionStore default
    isometricRotation: 0,
    layerViewMode: 'stack', // Match InteractionStore default
    isPreviewExpanded: false,
  });

  // Mobile store
  useMobileStore.setState({
    activeMobilePanel: null,
    mobileLayersTab: 'layers',
  });

  // Half-bin mode store
  useHalfBinModeStore.setState({
    halfBinMode: false,
  });

  // Shared preview store
  useSharedPreviewStore.setState({
    sharedLayoutPreview: null,
    sharedLayoutOriginalName: null,
    sharedLayoutAuthorName: null,
    sharedLayoutCloudShareId: null,
    sharedLayoutPermission: null,
  });

  // History store
  useHistoryStore.setState({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  });

  // Toast store
  useToastStore.setState({ toasts: [] });

  // Settings store
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });

  // Library store - create minimal valid state
  useLibraryStore.setState({
    library: createTestLibrary(),
    isLoaded: false,
    showLayoutManager: false,
  });

  // Labs store
  useLabsStore.setState({
    preferences: createDefaultLabsPreferences(),
    isDrawerOpen: false,
  });
}

/**
 * Create a test library with one default entry.
 * Used by resetAllStores and can be used in tests that need custom library setup.
 *
 * @param layoutId - Optional layout ID (generates one if not provided)
 * @returns A valid LayoutLibrary structure
 */
export function createTestLibrary(layoutId?: string): LayoutLibrary {
  const id = layoutId || 'test-layout-id';
  return {
    version: '1.0',
    activeLayoutId: id,
    settings: {},
    entries: [
      {
        id,
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
  const defaultLayout = createDefaultLayout();

  if (!overrides) {
    return defaultLayout;
  }

  // Deep merge for nested objects (drawer, categories, layers, bins)
  return {
    ...defaultLayout,
    ...overrides,
    // Ensure arrays and objects are properly merged
    drawer: overrides.drawer ? { ...defaultLayout.drawer, ...overrides.drawer } : defaultLayout.drawer,
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
