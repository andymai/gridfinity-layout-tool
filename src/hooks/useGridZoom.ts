import { useCallback, useLayoutEffect, type RefObject } from 'react';
import { useShallow } from 'zustand/shallow';
import { useViewStore } from '../core/store/view';
import { BASE_CELL_SIZE, CONSTRAINTS } from '../core/constants';

/**
 * Grid Zoom Hook
 *
 * Encapsulates zoom controls and fit-to-screen logic for the grid.
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface UseGridZoomOptions {
  /** Reference to the scroll container for measuring available space */
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  /** Drawer width in grid units */
  drawerWidth: number;
  /** Drawer depth in grid units */
  drawerDepth: number;
  /** Gap between grid cells in pixels */
  gap: number;
  /** Whether in mobile layout mode */
  isMobile: boolean;
  /** Whether user is actively resizing the grid (skip auto-fit during resize) */
  isResizing?: boolean;
  /** Whether 3D preview is shown (affects available space) */
  showIsometricPreview?: boolean;
}

export interface GridZoomState {
  /** Current zoom level (0.25 - 4.0) */
  zoom: number;
  /** Whether zoom can be increased */
  canZoomIn: boolean;
  /** Whether zoom can be decreased */
  canZoomOut: boolean;
  /** Set zoom to specific value */
  setZoom: (zoom: number) => void;
  /** Increase zoom by one step */
  zoomIn: () => void;
  /** Decrease zoom by one step */
  zoomOut: () => void;
  /** Calculate and set optimal zoom to fit grid in viewport */
  fitToScreen: () => void;
}

export function useGridZoom(options: UseGridZoomOptions): GridZoomState {
  const {
    scrollContainerRef,
    drawerWidth,
    drawerDepth,
    gap,
    isMobile,
    isResizing = false,
    showIsometricPreview = false,
  } = options;

  const { zoom, setZoom, zoomIn, zoomOut } = useViewStore(
    useShallow((state) => ({
      zoom: state.zoom,
      setZoom: state.setZoom,
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
    }))
  );

  const canZoomOut = zoom > CONSTRAINTS.ZOOM_MIN;
  const canZoomIn = zoom < CONSTRAINTS.ZOOM_MAX;

  // Fit grid to screen - calculate optimal zoom to fit drawer in viewport
  const fitToScreen = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Available space (minus container padding + buffer to prevent edge overflow)
    const horizontalPadding = isMobile ? 32 : 56; // p-3 (24) + 8px buffer vs p-6 + pr-8 (56)
    const verticalPadding = isMobile ? 32 : 48; // p-3 (24) + 8px buffer vs p-6 (48)
    const availableWidth = container.clientWidth - horizontalPadding;
    const availableHeight = container.clientHeight - verticalPadding;

    // Grid dimensions at zoom=1
    const labelGutter = 28; // Space for row/column labels
    const resizeHandleSpace = isMobile ? 0 : 24; // pr-6/pb-6 for resize handles (hidden on mobile)
    const gridWidth = drawerWidth * BASE_CELL_SIZE + (drawerWidth - 1) * gap + labelGutter + resizeHandleSpace;
    const gridHeight = drawerDepth * BASE_CELL_SIZE + (drawerDepth - 1) * gap + labelGutter + resizeHandleSpace;

    // Calculate zoom to fit both dimensions
    const zoomToFitWidth = availableWidth / gridWidth;
    const zoomToFitHeight = availableHeight / gridHeight;
    const optimalZoom = Math.min(zoomToFitWidth, zoomToFitHeight);

    // Clamp to valid zoom range and round to nearest 0.05
    const clampedZoom = Math.max(
      CONSTRAINTS.ZOOM_MIN,
      Math.min(CONSTRAINTS.ZOOM_MAX, Math.round(optimalZoom * 20) / 20)
    );

    setZoom(clampedZoom);
  }, [drawerWidth, drawerDepth, gap, setZoom, isMobile, scrollContainerRef]);

  // Fit to screen on initial mount and when drawer size changes (but not during resize drag)
  // Uses useLayoutEffect to calculate zoom synchronously before paint, preventing CLS
  useLayoutEffect(() => {
    // Skip while user is actively resizing via handles
    if (isResizing) return;
    fitToScreen();
  }, [fitToScreen, drawerWidth, drawerDepth, isResizing]);

  // Refit when 3D preview is toggled (changes available width on desktop, height on mobile)
  // Uses useLayoutEffect for immediate response to user interaction
  useLayoutEffect(() => {
    fitToScreen();
  }, [showIsometricPreview, fitToScreen]);

  return {
    zoom,
    canZoomIn,
    canZoomOut,
    setZoom,
    zoomIn,
    zoomOut,
    fitToScreen,
  };
}
