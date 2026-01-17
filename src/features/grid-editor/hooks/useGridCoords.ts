import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { Coord } from '../../../core/types';
import { useUIStore, useLayoutStore } from '../../../core/store';
import { getBaseCellSize, snapToHalf } from '../../../core/constants';
import { clamp } from '../../../utils/validation';
import { useResponsive } from '../../../shared/hooks';

/**
 * Hook for converting between screen (pixel) coordinates and grid coordinates.
 *
 * ## Coordinate System
 *
 * The grid uses a bottom-left origin coordinate system:
 * - **X axis**: 0 at left, increases rightward
 * - **Y axis**: 0 at bottom, increases upward
 *
 * This differs from typical screen coordinates where Y=0 is at the top.
 * The conversion handles this inversion automatically.
 *
 * ```
 * Grid:           Screen:
 *   y               top
 *   ↑               ↓
 *   │               │
 *   └───→ x         └───→ x
 * (0,0)           (0,0)
 * ```
 *
 * ## Zoom Support
 *
 * All coordinate calculations account for the current zoom level.
 * Cell sizes are scaled by the zoom factor when converting.
 *
 * ## Half-bin Mode
 *
 * When half-bin mode is enabled, coordinates snap to 0.5 unit increments
 * instead of whole units. The visual grid shows sub-cells for each half-unit.
 *
 * @param gridRef - React ref to the grid container element
 * @returns Object with coordinate utilities:
 *   - `getGridCoords(clientX, clientY)` - Convert screen position to grid coords (or null if outside)
 *   - `clampCoords(coord)` - Clamp coordinates to valid grid bounds
 *   - `isInBounds(coord)` - Check if coordinates are within grid bounds
 *   - `cellSize` - Current cell size in pixels (accounts for zoom)
 *   - `halfBinMode` - Whether half-bin mode is active
 *   - `visualCellSize` - Size of each visual cell (half of cellSize when halfBinMode active)
 *
 * @example
 * ```tsx
 * function GridOverlay() {
 *   const gridRef = useRef<HTMLDivElement>(null);
 *   const { getGridCoords, isInBounds } = useGridCoords(gridRef);
 *
 *   const handleClick = (e: React.MouseEvent) => {
 *     const coord = getGridCoords(e.clientX, e.clientY);
 *     if (coord && isInBounds(coord)) {
 *       console.log(`Clicked cell at (${coord.x}, ${coord.y})`);
 *     }
 *   };
 *
 *   return <div ref={gridRef} onClick={handleClick} />;
 * }
 * ```
 */
export function useGridCoords(gridRef: RefObject<HTMLDivElement | null>) {
  const zoom = useUIStore(state => state.zoom);
  const halfBinMode = useUIStore(state => state.halfBinMode);
  const drawer = useLayoutStore(state => state.layout.drawer);
  const { viewportWidth } = useResponsive();

  // Base cell size at current zoom (represents 1 grid unit)
  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
  const gap = 1; // 1px gap between cells

  // Visual cell size (same as cellSize since grid is always standard)
  const visualCellSize = cellSize;

  const getGridCoords = useCallback((clientX: number, clientY: number): Coord | null => {
    if (!gridRef.current) return null;

    const rect = gridRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // Account for fractional edge settings
    // When fractionalEdge='start', the first column/row is narrower (fractional width)
    // We need to offset the pixel position before dividing by cell size
    const hasFractionalWidth = drawer.width % 1 !== 0;
    const hasFractionalDepth = drawer.depth % 1 !== 0;
    const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
    const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';

    // Calculate fractional cell sizes (same formula as GridCanvas)
    const fractionalWidthPart = drawer.width - Math.floor(drawer.width);
    const fractionalDepthPart = drawer.depth - Math.floor(drawer.depth);
    const fractionalCellWidth = fractionalWidthPart * (cellSize + gap) - gap;
    const fractionalCellHeight = fractionalDepthPart * (cellSize + gap) - gap;

    // Adjust X coordinate for fractional edge at start
    let cellX: number;
    let inCellX: number;
    if (hasFractionalWidth && fractionalEdgeX === 'start') {
      // First column is fractional (narrower)
      if (relX < fractionalCellWidth + gap) {
        // Inside the fractional column
        cellX = -1; // Special marker for fractional column
        inCellX = relX - gap; // Position within fractional cell
      } else {
        // Offset by fractional column width to get integer cell position
        const adjustedX = relX - (fractionalCellWidth + gap);
        cellX = Math.floor(adjustedX / (cellSize + gap));
        inCellX = adjustedX - cellX * (cellSize + gap);
      }
    } else {
      cellX = Math.floor(relX / (cellSize + gap));
      inCellX = relX - cellX * (cellSize + gap);
    }

    // Adjust Y coordinate for fractional edge at end (top in CSS, which is first row)
    let cellY: number;
    let inCellY: number;
    if (hasFractionalDepth && fractionalEdgeY === 'end') {
      // First row (top) is fractional
      if (relY < fractionalCellHeight + gap) {
        // Inside the fractional row
        cellY = -1; // Special marker for fractional row
        inCellY = relY - gap;
      } else {
        const adjustedY = relY - (fractionalCellHeight + gap);
        cellY = Math.floor(adjustedY / (cellSize + gap));
        inCellY = adjustedY - cellY * (cellSize + gap);
      }
    } else {
      cellY = Math.floor(relY / (cellSize + gap));
      inCellY = relY - cellY * (cellSize + gap);
    }

    // Convert to grid coordinates
    const integerDepth = Math.floor(drawer.depth);

    if (halfBinMode) {
      // In half-bin mode, detect which half of the cell for 0.5 snapping
      const isLeftHalf = inCellX < (cellX === -1 ? fractionalCellWidth / 2 : cellSize / 2);
      const isTopHalf = inCellY < (cellY === -1 ? fractionalCellHeight / 2 : cellSize / 2);

      let x: number;
      if (cellX === -1) {
        // In fractional column - x is 0 to fractionalWidthPart
        x = isLeftHalf ? 0 : fractionalWidthPart / 2;
      } else {
        // In integer column - offset by fractional width if edge is at start
        const baseX = hasFractionalWidth && fractionalEdgeX === 'start'
          ? fractionalWidthPart + cellX
          : cellX;
        x = isLeftHalf ? baseX : baseX + 0.5;
      }

      let y: number;
      if (cellY === -1) {
        // In fractional row (at top when edge='end')
        const fractionalY = integerDepth + (isTopHalf ? fractionalDepthPart / 2 : 0);
        y = fractionalY;
      } else {
        // In integer row
        const baseY = hasFractionalDepth && fractionalEdgeY === 'end'
          ? integerDepth - cellY - 1
          : drawer.depth - cellY - 1;
        y = isTopHalf ? baseY + 0.5 : baseY;
      }

      return { x: snapToHalf(x), y: snapToHalf(y) };
    } else {
      // Standard mode - whole cell coordinates
      let x: number;
      if (cellX === -1) {
        // In fractional column - treat as x=0
        x = 0;
      } else {
        x = hasFractionalWidth && fractionalEdgeX === 'start'
          ? cellX // Integer cells start at x=0 when fractional is on left
          : cellX;
      }

      let y: number;
      if (cellY === -1) {
        // In fractional row - treat as top row
        y = integerDepth;
      } else {
        y = hasFractionalDepth && fractionalEdgeY === 'end'
          ? integerDepth - cellY - 1
          : drawer.depth - 1 - cellY;
      }

      return { x, y };
    }
  }, [gridRef, cellSize, gap, drawer.width, drawer.depth, drawer.fractionalEdgeX, drawer.fractionalEdgeY, halfBinMode]);

  const clampCoords = useCallback((coord: Coord): Coord => {
    if (halfBinMode) {
      // In half-bin mode, clamp to 0.5 increments within bounds
      // Max coordinate is drawer dimension - 0.5 (to allow 0.5-width bins at edge)
      return {
        x: clamp(snapToHalf(coord.x), 0, drawer.width - 0.5),
        y: clamp(snapToHalf(coord.y), 0, drawer.depth - 0.5),
      };
    } else {
      return {
        x: clamp(coord.x, 0, drawer.width - 1),
        y: clamp(coord.y, 0, drawer.depth - 1),
      };
    }
  }, [drawer.width, drawer.depth, halfBinMode]);

  const isInBounds = useCallback((coord: Coord): boolean => {
    return coord.x >= 0 && coord.x < drawer.width &&
           coord.y >= 0 && coord.y < drawer.depth;
  }, [drawer.width, drawer.depth]);

  /**
   * Get normalized pixel coordinates (0-1 range) for cursor tracking.
   * Unlike getGridCoords which snaps to grid cells, this preserves
   * sub-pixel precision for smooth cursor movement.
   *
   * @returns Normalized coordinates where (0,0) is top-left and (1,1) is bottom-right
   */
  const getPixelCoords = useCallback((clientX: number, clientY: number): {
    nx: number;
    ny: number;
    isInGrid: boolean;
  } | null => {
    if (!gridRef.current) return null;

    const rect = gridRef.current.getBoundingClientRect();
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    const isInGrid = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;

    return { nx, ny, isInGrid };
  }, [gridRef]);

  return { getGridCoords, getPixelCoords, clampCoords, isInBounds, cellSize, halfBinMode, visualCellSize };
}
