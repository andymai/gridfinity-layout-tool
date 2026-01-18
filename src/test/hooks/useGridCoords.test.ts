import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridCoords } from '@/features/grid-editor/hooks/useGridCoords';
import { useUIStore } from '@/core/store/ui';
import { useLayoutStore } from '@/core/store/layout';
import { resetAllStores } from '@/test/testUtils';
import type { RefObject } from 'react';

// Mock useResponsive
vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    viewportWidth: 1200,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    layoutMode: 'desktop' as const,
  }),
}));

describe('useGridCoords', () => {
  // Create a mock grid ref with a bounding rect
  const createMockGridRef = (
    left = 0,
    top = 0,
    width = 330, // 10 cells * 32px + 10 gaps
    height = 264 // 8 cells * 32px + 8 gaps
  ): RefObject<HTMLDivElement> => ({
    current: {
      getBoundingClientRect: () => ({
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }),
    } as HTMLDivElement,
  });

  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    
    // Set default drawer: 10x8
    const layout = useLayoutStore.getState().layout;
    layout.drawer = { width: 10, depth: 8, height: 12 };
    useLayoutStore.setState({ layout });
    
    // Default UI state
    useUIStore.setState({ zoom: 1, halfBinMode: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getGridCoords', () => {
    it('returns null when gridRef.current is null', () => {
      const gridRef: RefObject<HTMLDivElement> = { current: null };
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      const coord = result.current.getGridCoords(100, 100);
      
      expect(coord).toBeNull();
    });

    it('converts screen coordinates to grid coordinates', () => {
      const gridRef = createMockGridRef(0, 0);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // Cell size at zoom 1 with 1200px viewport = 32px
      // Cell 0,0 (top-left in screen = bottom-left in grid coord 0,7)
      const coord = result.current.getGridCoords(16, 16); // Center of first cell
      
      expect(coord).toBeDefined();
      expect(coord?.x).toBe(0);
      // Y should be inverted: y=7 in grid coords (top row in a 8-deep grid)
      expect(coord?.y).toBe(7);
    });

    it('handles grid offset from viewport', () => {
      // Grid starts 100px from left, 50px from top
      const gridRef = createMockGridRef(100, 50);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // Click at screen (116, 66) should be cell (0, 7) in grid
      const coord = result.current.getGridCoords(116, 66);
      
      expect(coord).toBeDefined();
      expect(coord?.x).toBe(0);
    });

    it('calculates correct cell for different zoom levels', () => {
      const gridRef = createMockGridRef(0, 0);
      
      // Test at zoom 2 (double size cells)
      useUIStore.setState({ zoom: 2 });
      
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // At zoom 2, cells are 64px
      // Position (32, 32) should still be cell 0 (center of first 64px cell)
      const coord = result.current.getGridCoords(32, 32);
      
      expect(coord?.x).toBe(0);
    });
  });

  describe('half-bin mode', () => {
    it('snaps to half-unit increments when enabled', () => {
      const gridRef = createMockGridRef(0, 0);
      useUIStore.setState({ halfBinMode: true });
      
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // Click in right half of first cell should give x=0.5
      // Cell size = 32px, right half starts at 16px
      const coord = result.current.getGridCoords(24, 16); // Right half of cell (0,0)
      
      expect(coord?.x).toBe(0.5);
    });

    it('returns halfBinMode status', () => {
      const gridRef = createMockGridRef(0, 0);
      
      useUIStore.setState({ halfBinMode: false });
      const { result: result1 } = renderHook(() => useGridCoords(gridRef));
      expect(result1.current.halfBinMode).toBe(false);
      
      useUIStore.setState({ halfBinMode: true });
      const { result: result2 } = renderHook(() => useGridCoords(gridRef));
      expect(result2.current.halfBinMode).toBe(true);
    });
  });

  describe('clampCoords', () => {
    it('clamps coordinates within drawer bounds', () => {
      const gridRef = createMockGridRef(0, 0);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // Negative coordinates should clamp to 0
      expect(result.current.clampCoords({ x: -5, y: -3 })).toEqual({ x: 0, y: 0 });
      
      // Coordinates beyond drawer (10x8) should clamp to max
      expect(result.current.clampCoords({ x: 15, y: 10 })).toEqual({ x: 9, y: 7 });
    });

    it('allows valid coordinates through unchanged', () => {
      const gridRef = createMockGridRef(0, 0);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      expect(result.current.clampCoords({ x: 5, y: 3 })).toEqual({ x: 5, y: 3 });
    });

    it('clamps to half-unit bounds when halfBinMode is enabled', () => {
      const gridRef = createMockGridRef(0, 0);
      useUIStore.setState({ halfBinMode: true });
      
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // In half-bin mode, max x is 9.5 (drawer.width - 0.5)
      const clamped = result.current.clampCoords({ x: 15, y: 10 });
      expect(clamped.x).toBe(9.5);
      expect(clamped.y).toBe(7.5);
    });

    it('snaps to half-unit increments in halfBinMode', () => {
      const gridRef = createMockGridRef(0, 0);
      useUIStore.setState({ halfBinMode: true });
      
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // 2.3 should snap to 2.5
      const clamped = result.current.clampCoords({ x: 2.3, y: 3.7 });
      expect(clamped.x).toBe(2.5);
      expect(clamped.y).toBe(3.5);
    });
  });

  describe('isInBounds', () => {
    it('returns true for coordinates within bounds', () => {
      const gridRef = createMockGridRef(0, 0);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      expect(result.current.isInBounds({ x: 0, y: 0 })).toBe(true);
      expect(result.current.isInBounds({ x: 5, y: 5 })).toBe(true);
      expect(result.current.isInBounds({ x: 9, y: 7 })).toBe(true);
    });

    it('returns false for coordinates outside bounds', () => {
      const gridRef = createMockGridRef(0, 0);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      // Drawer is 10x8
      expect(result.current.isInBounds({ x: -1, y: 0 })).toBe(false);
      expect(result.current.isInBounds({ x: 0, y: -1 })).toBe(false);
      expect(result.current.isInBounds({ x: 10, y: 0 })).toBe(false); // x >= width
      expect(result.current.isInBounds({ x: 0, y: 8 })).toBe(false); // y >= depth
    });

    it('handles fractional coordinates', () => {
      const gridRef = createMockGridRef(0, 0);
      const { result } = renderHook(() => useGridCoords(gridRef));
      
      expect(result.current.isInBounds({ x: 0.5, y: 0.5 })).toBe(true);
      expect(result.current.isInBounds({ x: 9.5, y: 7.5 })).toBe(true);
      expect(result.current.isInBounds({ x: 10.5, y: 0 })).toBe(false);
    });
  });

  describe('cellSize', () => {
    it('returns cell size based on zoom', () => {
      const gridRef = createMockGridRef(0, 0);
      
      useUIStore.setState({ zoom: 1 });
      const { result: result1 } = renderHook(() => useGridCoords(gridRef));
      const size1 = result1.current.cellSize;
      
      useUIStore.setState({ zoom: 2 });
      const { result: result2 } = renderHook(() => useGridCoords(gridRef));
      const size2 = result2.current.cellSize;
      
      expect(size2).toBe(size1 * 2);
    });
  });

  describe('fractional drawer dimensions', () => {
    it('handles fractional drawer width', () => {
      const gridRef = createMockGridRef(0, 0);

      // Set drawer with fractional width
      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 9.5, depth: 8, height: 12, fractionalEdgeX: 'end' };
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useGridCoords(gridRef));

      // Should still work with fractional drawer
      expect(result.current.isInBounds({ x: 0, y: 0 })).toBe(true);
      expect(result.current.isInBounds({ x: 9.5, y: 0 })).toBe(false); // >= width
      expect(result.current.isInBounds({ x: 9, y: 0 })).toBe(true);
    });

    it('handles fractional drawer depth', () => {
      const gridRef = createMockGridRef(0, 0);

      // Set drawer with fractional depth
      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 10, depth: 7.5, height: 12, fractionalEdgeY: 'end' };
      useLayoutStore.setState({ layout });

      const { result } = renderHook(() => useGridCoords(gridRef));

      expect(result.current.isInBounds({ x: 0, y: 7 })).toBe(true);
      expect(result.current.isInBounds({ x: 0, y: 7.5 })).toBe(false); // >= depth
    });

    it('handles click in fractional column (cellX === -1) in standard mode', () => {
      // 10.5 width drawer - fractional at start means left-most column is 0.5 units
      // Grid size for 10.5 units: 10 integer cells + 1 half cell (at start)
      const gridRef = createMockGridRef(0, 0, 346.5, 264); // 10.5 * 33 for width

      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 10.5, depth: 8, height: 12, fractionalEdgeX: 'start' };
      useLayoutStore.setState({ layout });

      useUIStore.setState({ halfBinMode: false });

      const { result } = renderHook(() => useGridCoords(gridRef));

      // Click in the fractional column (left edge area) should return x=0
      // The fractional column is at the start, so clicking at x=8 (within first 16.5px)
      const coord = result.current.getGridCoords(8, 16);

      expect(coord).toBeDefined();
      expect(coord?.x).toBe(0); // Fractional column maps to x=0 in standard mode
    });

    it('handles click in fractional row (cellY === -1) in standard mode', () => {
      // 8.5 depth drawer - fractional at end means top row is 0.5 units
      const gridRef = createMockGridRef(0, 0, 330, 280.5); // 8.5 * 33 for height

      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 10, depth: 8.5, height: 12, fractionalEdgeY: 'end' };
      useLayoutStore.setState({ layout });

      useUIStore.setState({ halfBinMode: false });

      const { result } = renderHook(() => useGridCoords(gridRef));

      // Click in the fractional row (top edge area) - integerDepth is 8
      // The fractional row is at the end (top), so clicking at y=8 (within top 16.5px)
      const coord = result.current.getGridCoords(16, 8);

      expect(coord).toBeDefined();
      // In standard mode, fractional row maps to integerDepth (8)
      expect(coord?.y).toBe(8);
    });

    it('handles click in fractional row in half-bin mode with fractionalEdgeY', () => {
      // 8.5 depth drawer with half-bin mode
      const gridRef = createMockGridRef(0, 0, 330, 280.5);

      const layout = useLayoutStore.getState().layout;
      layout.drawer = { width: 10, depth: 8.5, height: 12, fractionalEdgeY: 'end' };
      useLayoutStore.setState({ layout });

      useUIStore.setState({ halfBinMode: true });

      const { result } = renderHook(() => useGridCoords(gridRef));

      // Click in the fractional row at top
      const coord = result.current.getGridCoords(16, 8);

      expect(coord).toBeDefined();
      // In half-bin mode with fractional row, should get fractional y coordinate
      expect(coord?.y).toBeGreaterThanOrEqual(8);
    });
  });
});
