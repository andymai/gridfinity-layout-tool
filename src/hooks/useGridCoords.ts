import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { Coord } from '../types';
import { useUIStore, useLayoutStore } from '../store';
import { getBaseCellSize, snapToHalf } from '../constants';
import { clamp } from '../utils/validation';
import { useResponsive } from './useResponsive';

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

    // Calculate which standard cell the mouse is in
    const cellX = Math.floor(relX / (cellSize + gap));
    const cellY = Math.floor(relY / (cellSize + gap));

    if (halfBinMode) {
      // In half-bin mode, detect which half of the cell for 0.5 snapping
      const inCellX = relX - cellX * (cellSize + gap);
      const inCellY = relY - cellY * (cellSize + gap);

      // Determine which half of the cell
      const isLeftHalf = inCellX < cellSize / 2;
      const isTopHalf = inCellY < cellSize / 2;

      const x = isLeftHalf ? cellX : cellX + 0.5;
      // Y is inverted: top half of screen cell = higher grid Y
      const y = isTopHalf
        ? drawer.depth - cellY - 0.5
        : drawer.depth - cellY - 1;

      return { x: snapToHalf(x), y: snapToHalf(y) };
    } else {
      // Standard mode - whole cell coordinates
      const x = cellX;
      // Y is inverted (0 at bottom in our coordinate system)
      const y = drawer.depth - 1 - cellY;

      return { x, y };
    }
  }, [gridRef, cellSize, gap, drawer.depth, halfBinMode]);

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

  return { getGridCoords, clampCoords, isInBounds, cellSize, halfBinMode, visualCellSize };
}
