import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCollabLayout, useCollabLayoutSelector } from './useCollabLayout';
import { useLayoutStore } from '@/core/store/layout';
import { createTestBin, resetAllStores } from '@/test/testUtils';
import type { Bin, Layout } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId, mm } from '@/core/types';

// Import the functions we'll mock
import * as collabModeModule from './useCollabMode';
import * as liveblocksModule from '@/liveblocks.config';

// Mock dependencies
vi.mock('./useCollabMode');
vi.mock('@/liveblocks.config');

const LOCAL_MODE = { isCollaborative: false, canEdit: true, shareId: null } as const;
const COLLAB_MODE = { isCollaborative: true, canEdit: true, shareId: 'share-abc' } as const;

function makeRemoteLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: '1.0',
    name: 'Remote Layout',
    bins: [],
    layers: [{ id: layerId('remote-layer'), name: 'Remote Layer', height: heightUnits(3) }],
    categories: [],
    drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(5) },
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    printBedSize: mm(256),
    ...overrides,
  };
}

function makeBins(count: number): Bin[] {
  return Array.from({ length: count }, (_, i) =>
    createTestBin({
      id: binId(`bin${i}`),
      layerId: layerId('layer1'),
      x: gridUnits(i),
      category: categoryId('coral'),
    })
  );
}

describe('useCollabLayout', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Default to local mode
    vi.mocked(collabModeModule.useCollabMode).mockReturnValue(LOCAL_MODE);
    vi.mocked(liveblocksModule.useStorage).mockReturnValue(null);
  });

  describe('local mode', () => {
    it('returns layout from Zustand store', () => {
      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.layout).toBeDefined();
      expect(result.current.bins).toEqual(expect.any(Array));
      expect(result.current.layers).toEqual(expect.any(Array));
      expect(result.current.categories).toEqual(expect.any(Array));
      expect(result.current.drawer).toBeDefined();
      expect(result.current.name).toBeDefined();
    });

    it('returns bins array from layout', () => {
      // Add some bins to the store
      const layout = useLayoutStore.getState().layout;
      layout.bins = makeBins(1);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.bins).toHaveLength(1);
      expect(result.current.bins[0].id).toBe(binId('bin0'));
    });

    it('returns layers array from layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.layers = [
        { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
        { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(5) },
      ];
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.layers).toHaveLength(2);
      expect(result.current.layers[0].name).toBe('Layer 1');
    });

    it('returns categories array from layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.categories = [
        { id: categoryId('cat1'), name: 'Category 1', color: 'coral' },
        { id: categoryId('cat2'), name: 'Category 2', color: 'sky' },
      ];
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.categories).toHaveLength(2);
      expect(result.current.categories[0].name).toBe('Category 1');
    });

    it('returns drawer settings from layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer = {
        width: gridUnits(10),
        depth: gridUnits(10),
        height: heightUnits(5),
      };
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.drawer.width).toBe(10);
      expect(result.current.drawer.depth).toBe(10);
      expect(result.current.drawer.height).toBe(5);
    });

    it('returns layout name', () => {
      const layout = useLayoutStore.getState().layout;
      layout.name = 'My Custom Layout';
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.name).toBe('My Custom Layout');
    });
  });

  describe('collaborative mode', () => {
    beforeEach(() => {
      // Mock collaborative mode
      vi.mocked(collabModeModule.useCollabMode).mockReturnValue(COLLAB_MODE);
    });

    it('returns remote layout when available', () => {
      const mockRemoteLayout = makeRemoteLayout();

      vi.mocked(liveblocksModule.useStorage).mockReturnValue(mockRemoteLayout);

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.layout).toBe(mockRemoteLayout);
      expect(result.current.name).toBe('Remote Layout');
      expect(result.current.layers[0].name).toBe('Remote Layer');
    });

    it('falls back to local layout when remote is null', () => {
      vi.mocked(liveblocksModule.useStorage).mockReturnValue(null);

      const { result } = renderHook(() => useCollabLayout());

      // Should fall back to local store
      expect(result.current.layout).toBeDefined();
      expect(result.current.bins).toEqual(expect.any(Array));
    });
  });
});

describe('useCollabLayoutSelector', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Default to local mode
    vi.mocked(collabModeModule.useCollabMode).mockReturnValue(LOCAL_MODE);
    vi.mocked(liveblocksModule.useStorage).mockReturnValue(null);
  });

  describe('local mode', () => {
    it('applies selector to local layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = makeBins(2);
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.bins.length));

      expect(result.current).toBe(2);
    });

    it('applies selector to get specific field', () => {
      const layout = useLayoutStore.getState().layout;
      layout.name = 'Selector Test';
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.name));

      expect(result.current).toBe('Selector Test');
    });

    it('applies selector to get drawer width', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: gridUnits(15), depth: gridUnits(10), height: heightUnits(5) };
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.drawer.width));

      expect(result.current).toBe(15);
    });
  });

  describe('collaborative mode', () => {
    beforeEach(() => {
      vi.mocked(collabModeModule.useCollabMode).mockReturnValue(COLLAB_MODE);
    });

    it('applies selector to remote layout when available', () => {
      const mockRemoteLayout = makeRemoteLayout({
        name: 'Remote Selector Test',
        bins: makeBins(1),
      });

      vi.mocked(liveblocksModule.useStorage).mockReturnValue(mockRemoteLayout);

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.name));

      expect(result.current).toBe('Remote Selector Test');
    });

    it('applies selector to get bin count from remote', () => {
      const mockRemoteLayout = makeRemoteLayout({ name: 'Test', bins: makeBins(3) });

      vi.mocked(liveblocksModule.useStorage).mockReturnValue(mockRemoteLayout);

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.bins.length));

      expect(result.current).toBe(3);
    });

    it('falls back to local selector when remote is null', () => {
      vi.mocked(liveblocksModule.useStorage).mockReturnValue(null);

      const layout = useLayoutStore.getState().layout;
      layout.name = 'Local Fallback';
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.name));

      expect(result.current).toBe('Local Fallback');
    });
  });
});
