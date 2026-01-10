import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridCoords } from '../../hooks/useGridCoords';
import { useUIStore } from '../../store/ui';
import { useLayoutStore } from '../../store/layout';
import { createDefaultLayout, BASE_CELL_SIZE } from '../../constants';
import type { RefObject } from 'react';

// Mock grid ref that returns consistent coords
function createMockGridRef(left = 0, top = 0): RefObject<HTMLDivElement> {
  const mockElement = {
    getBoundingClientRect: () => ({
      left,
      top,
      width: 320,
      height: 256,
      right: left + 320,
      bottom: top + 256,
      x: left,
      y: top,
      toJSON: () => ({}),
    }),
  } as HTMLDivElement;

  return { current: mockElement };
}

describe('useGridCoords', () => {
  beforeEach(() => {
    // Reset stores to default state
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({ layout: defaultLayout });
    useUIStore.setState({
      activeLayerId: defaultLayout.layers[0].id,
      selectedBinIds: [],
      activeCategoryId: defaultLayout.categories[0].id,
      zoom: 1,
      showOtherLayers: true,
      showLabels: true,
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      interaction: null,
      dropTarget: null,
      paintSize: null,
      activeMobilePanel: null,
      contextMenu: null,
      showIsometricPreview: true,
      isometricRotation: 0,
      layerViewMode: 'focus',
      isPreviewExpanded: false,
    });
  });

  describe('getGridCoords', () => {
    it('converts mouse position to grid coordinates', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      // At zoom=1, cellSize=32, gap=1, so each cell is 33px
      // Click at (0, 0) should be (0, depth-1) since Y is inverted
      const drawer = useLayoutStore.getState().layout.drawer;
      const coord = result.current.getGridCoords(0, 0);

      expect(coord).toEqual({ x: 0, y: drawer.depth - 1 });
    });

    it('calculates correct cell from pixel position', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;
      // cellSize + gap = 32 + 1 = 33px per cell at zoom 1
      // Click at pixel (33, 0) should be cell x=1
      const coord = result.current.getGridCoords(33, 0);

      expect(coord?.x).toBe(1);
      expect(coord?.y).toBe(drawer.depth - 1);
    });

    it('returns null when gridRef.current is null', () => {
      const gridRef: RefObject<HTMLDivElement | null> = { current: null };
      const { result } = renderHook(() => useGridCoords(gridRef));

      const coord = result.current.getGridCoords(100, 100);
      expect(coord).toBeNull();
    });

    it('handles grid offset from viewport', () => {
      // Grid positioned at (100, 50) from viewport
      const gridRef = createMockGridRef(100, 50);
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;
      // Click at viewport (100, 50) = relative (0, 0) on grid
      const coord = result.current.getGridCoords(100, 50);

      expect(coord).toEqual({ x: 0, y: drawer.depth - 1 });
    });

    it('inverts Y coordinate (0 at bottom)', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;
      // At zoom=1, cellSize=32, gap=1 → 33px per cell
      // Click at bottom row (y pixel = (depth-1) * 33)
      const bottomRowPixelY = (drawer.depth - 1) * 33;
      const coord = result.current.getGridCoords(0, bottomRowPixelY);

      expect(coord?.y).toBe(0); // Bottom row in grid coords
    });

    it('handles negative relative coordinates', () => {
      const gridRef = createMockGridRef(100, 100);
      const { result } = renderHook(() => useGridCoords(gridRef));

      // Click at (50, 50) when grid starts at (100, 100) = relative (-50, -50)
      const coord = result.current.getGridCoords(50, 50);

      // Should produce negative x (Math.floor(-50/33) = -2)
      expect(coord?.x).toBeLessThan(0);
    });

    it('handles fractional pixel positions', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      // Click at fractional position - should floor to integer cell
      const coord1 = result.current.getGridCoords(16.5, 16.5);
      const coord2 = result.current.getGridCoords(16.9, 16.9);

      // Both should map to same cell (Math.floor handles it)
      expect(coord1?.x).toBe(coord2?.x);
      expect(coord1?.y).toBe(coord2?.y);
    });
  });

  describe('zoom level affects coordinate calculation', () => {
    it('adjusts cell size based on zoom', () => {
      const gridRef = createMockGridRef();

      // At zoom 2, cellSize = 64, cell+gap = 65px
      useUIStore.setState({ zoom: 2 });
      const { result } = renderHook(() => useGridCoords(gridRef));

      expect(result.current.cellSize).toBe(Math.round(BASE_CELL_SIZE * 2));
    });

    it('calculates correct grid position at zoom 2', () => {
      const gridRef = createMockGridRef();
      useUIStore.setState({ zoom: 2 });
      const { result } = renderHook(() => useGridCoords(gridRef));

      // At zoom=2, cellSize=64, gap=1 → 65px per cell
      // Click at pixel (65, 0) should be cell x=1
      const coord = result.current.getGridCoords(65, 0);
      expect(coord?.x).toBe(1);
    });

    it('calculates correct grid position at zoom 0.5', () => {
      const gridRef = createMockGridRef();
      useUIStore.setState({ zoom: 0.5 });
      const { result } = renderHook(() => useGridCoords(gridRef));

      // At zoom=0.5, cellSize=16, gap=1 → 17px per cell
      // Click at pixel (17, 0) should be cell x=1
      const coord = result.current.getGridCoords(17, 0);
      expect(coord?.x).toBe(1);
    });

    it('updates when zoom changes', () => {
      const gridRef = createMockGridRef();
      const { result, rerender } = renderHook(() => useGridCoords(gridRef));

      expect(result.current.cellSize).toBe(32);

      act(() => {
        useUIStore.setState({ zoom: 2 });
      });
      rerender();

      expect(result.current.cellSize).toBe(64);
    });
  });

  describe('different drawer sizes', () => {
    it('handles small drawer (4x4)', () => {
      const gridRef = createMockGridRef();
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          drawer: { width: 4, depth: 4, height: 12 },
        },
      });
      const { result } = renderHook(() => useGridCoords(gridRef));

      // Top-left click should give (0, 3) for 4-deep drawer
      const coord = result.current.getGridCoords(0, 0);
      expect(coord).toEqual({ x: 0, y: 3 });
    });

    it('handles large drawer (50x50)', () => {
      const gridRef = createMockGridRef();
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          drawer: { width: 50, depth: 50, height: 12 },
        },
      });
      const { result } = renderHook(() => useGridCoords(gridRef));

      // Top-left click should give (0, 49) for 50-deep drawer
      const coord = result.current.getGridCoords(0, 0);
      expect(coord).toEqual({ x: 0, y: 49 });
    });

    it('handles non-square drawer', () => {
      const gridRef = createMockGridRef();
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          drawer: { width: 10, depth: 5, height: 12 },
        },
      });
      const { result } = renderHook(() => useGridCoords(gridRef));

      // Top-left should give (0, 4) for 5-deep drawer
      const coord = result.current.getGridCoords(0, 0);
      expect(coord).toEqual({ x: 0, y: 4 });
    });
  });

  describe('clampCoords', () => {
    it('clamps coordinates to valid range', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;

      // Test clamping negative values
      const clamped1 = result.current.clampCoords({ x: -5, y: -5 });
      expect(clamped1).toEqual({ x: 0, y: 0 });

      // Test clamping values beyond drawer size
      const clamped2 = result.current.clampCoords({ x: 100, y: 100 });
      expect(clamped2).toEqual({ x: drawer.width - 1, y: drawer.depth - 1 });
    });

    it('passes through valid coordinates unchanged', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const clamped = result.current.clampCoords({ x: 3, y: 4 });
      expect(clamped).toEqual({ x: 3, y: 4 });
    });

    it('clamps to edge values correctly', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;

      // Exactly at max should stay at max-1
      const clamped = result.current.clampCoords({
        x: drawer.width,
        y: drawer.depth,
      });
      expect(clamped).toEqual({ x: drawer.width - 1, y: drawer.depth - 1 });
    });

    it('updates when drawer size changes', () => {
      const gridRef = createMockGridRef();
      const { result, rerender } = renderHook(() => useGridCoords(gridRef));

      // Clamp to original drawer
      const clamped1 = result.current.clampCoords({ x: 100, y: 100 });
      const drawer1 = useLayoutStore.getState().layout.drawer;
      expect(clamped1).toEqual({ x: drawer1.width - 1, y: drawer1.depth - 1 });

      // Change drawer size
      act(() => {
        useLayoutStore.setState({
          layout: {
            ...useLayoutStore.getState().layout,
            drawer: { width: 20, depth: 20, height: 12 },
          },
        });
      });
      rerender();

      // Clamp should use new size
      const clamped2 = result.current.clampCoords({ x: 100, y: 100 });
      expect(clamped2).toEqual({ x: 19, y: 19 });
    });
  });

  describe('isInBounds', () => {
    it('returns true for valid coordinates', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      expect(result.current.isInBounds({ x: 0, y: 0 })).toBe(true);
      expect(result.current.isInBounds({ x: 5, y: 5 })).toBe(true);
    });

    it('returns false for negative coordinates', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      expect(result.current.isInBounds({ x: -1, y: 0 })).toBe(false);
      expect(result.current.isInBounds({ x: 0, y: -1 })).toBe(false);
      expect(result.current.isInBounds({ x: -1, y: -1 })).toBe(false);
    });

    it('returns false for out of bounds coordinates', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;

      expect(result.current.isInBounds({ x: drawer.width, y: 0 })).toBe(false);
      expect(result.current.isInBounds({ x: 0, y: drawer.depth })).toBe(false);
      expect(result.current.isInBounds({ x: 100, y: 100 })).toBe(false);
    });

    it('returns true for edge coordinates (max - 1)', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      const drawer = useLayoutStore.getState().layout.drawer;

      expect(result.current.isInBounds({ x: drawer.width - 1, y: 0 })).toBe(true);
      expect(result.current.isInBounds({ x: 0, y: drawer.depth - 1 })).toBe(true);
      expect(result.current.isInBounds({ x: drawer.width - 1, y: drawer.depth - 1 })).toBe(true);
    });

    it('respects drawer size changes', () => {
      const gridRef = createMockGridRef();
      const { result, rerender } = renderHook(() => useGridCoords(gridRef));

      // Valid in default 10x8 drawer
      expect(result.current.isInBounds({ x: 9, y: 7 })).toBe(true);

      // Shrink drawer
      act(() => {
        useLayoutStore.setState({
          layout: {
            ...useLayoutStore.getState().layout,
            drawer: { width: 5, depth: 5, height: 12 },
          },
        });
      });
      rerender();

      // Now out of bounds
      expect(result.current.isInBounds({ x: 9, y: 7 })).toBe(false);
      expect(result.current.isInBounds({ x: 4, y: 4 })).toBe(true);
    });
  });

  describe('cellSize', () => {
    it('returns correct cell size at zoom 1', () => {
      const gridRef = createMockGridRef();
      const { result } = renderHook(() => useGridCoords(gridRef));

      expect(result.current.cellSize).toBe(BASE_CELL_SIZE);
    });

    it('scales with zoom level', () => {
      const gridRef = createMockGridRef();

      act(() => {
        useUIStore.setState({ zoom: 0.5 });
      });
      const { result: result1 } = renderHook(() => useGridCoords(gridRef));
      expect(result1.current.cellSize).toBe(Math.round(BASE_CELL_SIZE * 0.5));

      act(() => {
        useUIStore.setState({ zoom: 1.5 });
      });
      const { result: result2 } = renderHook(() => useGridCoords(gridRef));
      expect(result2.current.cellSize).toBe(Math.round(BASE_CELL_SIZE * 1.5));

      act(() => {
        useUIStore.setState({ zoom: 4 });
      });
      const { result: result3 } = renderHook(() => useGridCoords(gridRef));
      expect(result3.current.cellSize).toBe(Math.round(BASE_CELL_SIZE * 4));
    });

    it('rounds cell size to integer', () => {
      const gridRef = createMockGridRef();

      // Zoom that would produce fractional cell size
      useUIStore.setState({ zoom: 1.33 });
      const { result } = renderHook(() => useGridCoords(gridRef));

      expect(Number.isInteger(result.current.cellSize)).toBe(true);
      expect(result.current.cellSize).toBe(Math.round(BASE_CELL_SIZE * 1.33));
    });
  });
});
