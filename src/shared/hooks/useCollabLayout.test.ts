import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCollabLayout, useCollabLayoutSelector } from './useCollabLayout';
import { useLayoutStore } from '@/core/store/layout';
import { resetAllStores } from '@/test/testUtils';
import type { Layout } from '@/core/types';

// Import the functions we'll mock
import * as collabModeModule from './useCollabMode';
import * as liveblocksModule from '@/liveblocks.config';

// Mock dependencies
vi.mock('./useCollabMode');
vi.mock('@/liveblocks.config');

describe('useCollabLayout', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    // Default to local mode
    vi.mocked(collabModeModule.useCollabMode).mockReturnValue({ isCollaborative: false });
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
      layout.bins = [
        {
          id: 'bin1',
          layerId: 'layer1',
          x: 0,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          category: 'coral',
          label: 'Test Bin',
          notes: '',
        },
      ];
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.bins).toHaveLength(1);
      expect(result.current.bins[0].id).toBe('bin1');
    });

    it('returns layers array from layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.layers = [
        { id: 'layer1', name: 'Layer 1', height: 3 },
        { id: 'layer2', name: 'Layer 2', height: 5 },
      ];
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.layers).toHaveLength(2);
      expect(result.current.layers[0].name).toBe('Layer 1');
    });

    it('returns categories array from layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.categories = [
        { id: 'cat1', name: 'Category 1', color: 'coral' },
        { id: 'cat2', name: 'Category 2', color: 'sky' },
      ];
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.categories).toHaveLength(2);
      expect(result.current.categories[0].name).toBe('Category 1');
    });

    it('returns drawer settings from layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.drawer = {
        width: 10,
        depth: 10,
        heightUnits: 5,
      };
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.drawer.width).toBe(10);
      expect(result.current.drawer.depth).toBe(10);
      expect(result.current.drawer.heightUnits).toBe(5);
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
      vi.mocked(collabModeModule.useCollabMode).mockReturnValue({ isCollaborative: true });
    });

    it('returns remote layout when available', () => {
      const mockRemoteLayout: Layout = {
        id: 'remote-layout',
        name: 'Remote Layout',
        bins: [],
        layers: [{ id: 'remote-layer', name: 'Remote Layer', height: 3 }],
        categories: [],
        drawer: { width: 8, depth: 8, heightUnits: 5 },
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      };

      vi.mocked(liveblocksModule.useStorage).mockReturnValue(mockRemoteLayout);

      const { result } = renderHook(() => useCollabLayout());

      expect(result.current.layout.id).toBe('remote-layout');
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
    vi.mocked(collabModeModule.useCollabMode).mockReturnValue({ isCollaborative: false });
    vi.mocked(liveblocksModule.useStorage).mockReturnValue(null);
  });

  describe('local mode', () => {
    it('applies selector to local layout', () => {
      const layout = useLayoutStore.getState().layout;
      layout.bins = [
        {
          id: 'bin1',
          layerId: 'layer1',
          x: 0,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          category: 'coral',
          label: 'Test',
          notes: '',
        },
        {
          id: 'bin2',
          layerId: 'layer1',
          x: 1,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          category: 'coral',
          label: 'Test 2',
          notes: '',
        },
      ];
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
      layout.drawer = { width: 15, depth: 10, heightUnits: 5 };
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.drawer.width));

      expect(result.current).toBe(15);
    });
  });

  describe('collaborative mode', () => {
    beforeEach(() => {
      vi.mocked(collabModeModule.useCollabMode).mockReturnValue({ isCollaborative: true });
    });

    it('applies selector to remote layout when available', () => {
      const mockRemoteLayout: Layout = {
        id: 'remote',
        name: 'Remote Selector Test',
        bins: [
          {
            id: 'remote-bin',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            category: 'coral',
            label: '',
            notes: '',
          },
        ],
        layers: [],
        categories: [],
        drawer: { width: 12, depth: 8, heightUnits: 5 },
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      };

      vi.mocked(liveblocksModule.useStorage).mockReturnValue(mockRemoteLayout);

      const { result } = renderHook(() => useCollabLayoutSelector((l) => l.name));

      expect(result.current).toBe('Remote Selector Test');
    });

    it('applies selector to get bin count from remote', () => {
      const mockRemoteLayout: Layout = {
        id: 'remote',
        name: 'Test',
        bins: [
          {
            id: '1',
            layerId: 'l1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'coral',
            label: '',
            notes: '',
          },
          {
            id: '2',
            layerId: 'l1',
            x: 1,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'coral',
            label: '',
            notes: '',
          },
          {
            id: '3',
            layerId: 'l1',
            x: 2,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'coral',
            label: '',
            notes: '',
          },
        ],
        layers: [],
        categories: [],
        drawer: { width: 10, depth: 10, heightUnits: 5 },
        gridUnitMm: 42,
        heightUnitMm: 7,
        printBedSize: 256,
      };

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
