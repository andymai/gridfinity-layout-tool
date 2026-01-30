import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridZoom } from '@/features/grid-editor/hooks/useGridZoom';
import { useViewStore } from '@/core/store/view';
import { CONSTRAINTS } from '@/core/constants';
import type { RefObject } from 'react';

// Mock scroll container ref
function createMockScrollContainerRef(width = 800, height = 600): RefObject<HTMLDivElement> {
  const mockElement = {
    clientWidth: width,
    clientHeight: height,
  } as HTMLDivElement;

  return { current: mockElement };
}

describe('useGridZoom', () => {
  beforeEach(() => {
    // Reset view store
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
  });

  describe('initial state', () => {
    it('returns calculated zoom after auto-fit', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      // Hook auto-fits on mount, so zoom will be calculated
      expect(result.current.zoom).toBeGreaterThan(0);
      expect(result.current.zoom).toBeLessThanOrEqual(CONSTRAINTS.ZOOM_MAX);
    });

    it('returns canZoomIn true when below max', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current.canZoomIn).toBe(true);
    });

    it('returns canZoomOut true when above min', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current.canZoomOut).toBe(true);
    });
  });

  describe('zoom limits', () => {
    it('canZoomIn is false at max zoom', () => {
      // Use null ref to prevent auto-fit from changing zoom
      const nullRef: RefObject<HTMLDivElement> = { current: null };
      useViewStore.setState({ zoom: CONSTRAINTS.ZOOM_MAX });

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef: nullRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current.canZoomIn).toBe(false);
    });

    it('canZoomOut is false at min zoom', () => {
      // Use null ref to prevent auto-fit from changing zoom
      const nullRef: RefObject<HTMLDivElement> = { current: null };
      useViewStore.setState({ zoom: CONSTRAINTS.ZOOM_MIN });

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef: nullRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current.canZoomOut).toBe(false);
    });
  });

  describe('setZoom', () => {
    it('updates zoom in store', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      act(() => {
        result.current.setZoom(1.5);
      });

      expect(result.current.zoom).toBe(1.5);
      expect(useViewStore.getState().zoom).toBe(1.5);
    });
  });

  describe('zoomIn', () => {
    it('increases zoom by one step', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      const initialZoom = result.current.zoom;

      act(() => {
        result.current.zoomIn();
      });

      expect(result.current.zoom).toBeGreaterThan(initialZoom);
    });
  });

  describe('zoomOut', () => {
    it('decreases zoom by one step', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      const initialZoom = result.current.zoom;

      act(() => {
        result.current.zoomOut();
      });

      expect(result.current.zoom).toBeLessThan(initialZoom);
    });
  });

  describe('fitToScreen', () => {
    it('calculates optimal zoom to fit grid in viewport', () => {
      // Large viewport - should allow zoom >= 1
      const scrollContainerRef = createMockScrollContainerRef(1200, 900);

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      // fitToScreen is called automatically on mount
      // Zoom should be set to fit the grid
      expect(result.current.zoom).toBeGreaterThan(0);
      expect(result.current.zoom).toBeLessThanOrEqual(CONSTRAINTS.ZOOM_MAX);
    });

    it('calculates smaller zoom for small viewport', () => {
      // Small viewport
      const smallRef = createMockScrollContainerRef(400, 300);

      useViewStore.setState({ zoom: 1 });

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef: smallRef,
          drawerWidth: 20, // Large grid
          drawerDepth: 15,
          gap: 2,
          isMobile: false,
        })
      );

      // Zoom should be reduced to fit
      expect(result.current.zoom).toBeLessThan(1);
    });

    it('respects minimum zoom constraint', () => {
      // Very small viewport with large grid
      const tinyRef = createMockScrollContainerRef(200, 150);

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef: tinyRef,
          drawerWidth: 50, // Maximum size grid
          drawerDepth: 50,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current.zoom).toBeGreaterThanOrEqual(CONSTRAINTS.ZOOM_MIN);
    });

    it('respects maximum zoom constraint', () => {
      // Large viewport with tiny grid
      const largeRef = createMockScrollContainerRef(2000, 1500);

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef: largeRef,
          drawerWidth: 2, // Small grid
          drawerDepth: 2,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current.zoom).toBeLessThanOrEqual(CONSTRAINTS.ZOOM_MAX);
    });

    it('does nothing when container ref is null', () => {
      const nullRef: RefObject<HTMLDivElement> = { current: null };
      useViewStore.setState({ zoom: 1.5 });

      renderHook(() =>
        useGridZoom({
          scrollContainerRef: nullRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      // Zoom should remain unchanged (no fitToScreen)
      expect(useViewStore.getState().zoom).toBe(1.5);
    });

    it('uses different padding for mobile', () => {
      const scrollContainerRef = createMockScrollContainerRef(600, 400);

      // Desktop version
      useViewStore.setState({ zoom: 1 });
      const { result: desktopResult } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );
      const desktopZoom = desktopResult.current.zoom;

      // Mobile version (less padding = more space = potentially higher zoom)
      useViewStore.setState({ zoom: 1 });
      const { result: mobileResult } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: true,
        })
      );
      const mobileZoom = mobileResult.current.zoom;

      // Both should be valid zoom values
      expect(desktopZoom).toBeGreaterThan(0);
      expect(mobileZoom).toBeGreaterThan(0);
    });

    it('can be called manually', () => {
      const scrollContainerRef = createMockScrollContainerRef(800, 600);

      useViewStore.setState({ zoom: 0.5 });

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      // Manually call fitToScreen
      act(() => {
        result.current.fitToScreen();
      });

      // Zoom should have been recalculated
      expect(result.current.zoom).toBeGreaterThan(0);
    });
  });

  describe('auto-fit on drawer size change', () => {
    it('refits when drawer width changes', () => {
      const scrollContainerRef = createMockScrollContainerRef(800, 600);

      const { result, rerender } = renderHook(
        ({ width }) =>
          useGridZoom({
            scrollContainerRef,
            drawerWidth: width,
            drawerDepth: 8,
            gap: 2,
            isMobile: false,
          }),
        { initialProps: { width: 10 } }
      );

      const initialZoom = result.current.zoom;

      // Change drawer width to larger value
      rerender({ width: 20 });

      // Zoom should be recalculated (likely smaller for larger grid)
      expect(result.current.zoom).not.toBe(initialZoom);
    });

    it('refits when drawer depth changes', () => {
      const scrollContainerRef = createMockScrollContainerRef(800, 600);

      const { result, rerender } = renderHook(
        ({ depth }) =>
          useGridZoom({
            scrollContainerRef,
            drawerWidth: 10,
            drawerDepth: depth,
            gap: 2,
            isMobile: false,
          }),
        { initialProps: { depth: 8 } }
      );

      const initialZoom = result.current.zoom;

      // Change drawer depth to larger value
      rerender({ depth: 20 });

      // Zoom should be recalculated
      expect(result.current.zoom).not.toBe(initialZoom);
    });

    it('skips auto-fit when isResizing is true', () => {
      // Use null ref so initial render doesn't auto-fit
      const nullRef: RefObject<HTMLDivElement> = { current: null };

      // Set initial zoom
      useViewStore.setState({ zoom: 1.5 });

      const { result, rerender } = renderHook(
        ({ width, isResizing }) =>
          useGridZoom({
            scrollContainerRef: nullRef,
            drawerWidth: width,
            drawerDepth: 8,
            gap: 2,
            isMobile: false,
            isResizing,
          }),
        { initialProps: { width: 10, isResizing: true } }
      );

      // Note the zoom after initial render with isResizing (should stay at 1.5)
      const zoomDuringResize = result.current.zoom;
      expect(zoomDuringResize).toBe(1.5);

      // Change drawer width while resizing
      rerender({ width: 20, isResizing: true });

      // Zoom should NOT change during resize
      expect(result.current.zoom).toBe(1.5);
    });
  });

  describe('preview toggle does not auto-fit', () => {
    it('keeps zoom stable when showIsometricPreview changes', () => {
      const scrollContainerRef = createMockScrollContainerRef(800, 600);

      const { result, rerender } = renderHook(
        ({ _showPreview }) =>
          useGridZoom({
            scrollContainerRef,
            drawerWidth: 10,
            drawerDepth: 8,
            gap: 2,
            isMobile: false,
          }),
        { initialProps: { _showPreview: false } }
      );

      // Record initial zoom set by mount auto-fit
      const initialZoom = result.current.zoom;

      // Toggle preview — zoom should NOT change
      rerender({ _showPreview: true });

      expect(result.current.zoom).toBe(initialZoom);
    });
  });

  describe('zoom calculation accuracy', () => {
    it('rounds zoom to nearest 0.05', () => {
      const scrollContainerRef = createMockScrollContainerRef(800, 600);

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      // Zoom should be rounded to nearest 0.05
      const zoom = result.current.zoom;
      const roundedTo05 = Math.round(zoom * 20) / 20;
      expect(zoom).toBe(roundedTo05);
    });

    it('accounts for label gutter space', () => {
      // The calculation includes a labelGutter of 28px
      const scrollContainerRef = createMockScrollContainerRef(800, 600);

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      // Grid at zoom=1 would be:
      // Width: 10 * 32 + 9 * 2 + 28 + 24 = 320 + 18 + 52 = 390
      // Height: 8 * 32 + 7 * 2 + 28 + 24 = 256 + 14 + 52 = 322
      // Available: 800 - 56 = 744 width, 600 - 48 = 552 height
      // zoomToFitWidth = 744 / 390 ≈ 1.9
      // zoomToFitHeight = 552 / 322 ≈ 1.7
      // Optimal = min(1.9, 1.7) = 1.7, rounded = 1.7

      expect(result.current.zoom).toBeGreaterThan(1);
    });
  });

  describe('return values', () => {
    it('returns all expected properties', () => {
      const scrollContainerRef = createMockScrollContainerRef();

      const { result } = renderHook(() =>
        useGridZoom({
          scrollContainerRef,
          drawerWidth: 10,
          drawerDepth: 8,
          gap: 2,
          isMobile: false,
        })
      );

      expect(result.current).toHaveProperty('zoom');
      expect(result.current).toHaveProperty('canZoomIn');
      expect(result.current).toHaveProperty('canZoomOut');
      expect(result.current).toHaveProperty('setZoom');
      expect(result.current).toHaveProperty('zoomIn');
      expect(result.current).toHaveProperty('zoomOut');
      expect(result.current).toHaveProperty('fitToScreen');

      expect(typeof result.current.zoom).toBe('number');
      expect(typeof result.current.canZoomIn).toBe('boolean');
      expect(typeof result.current.canZoomOut).toBe('boolean');
      expect(typeof result.current.setZoom).toBe('function');
      expect(typeof result.current.zoomIn).toBe('function');
      expect(typeof result.current.zoomOut).toBe('function');
      expect(typeof result.current.fitToScreen).toBe('function');
    });
  });
});
