import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { Coord } from '../types';
import { useUIStore, useLayoutStore } from '../store';
import { BASE_CELL_SIZE } from '../constants';
import { clamp } from '../utils/validation';

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
 * @param gridRef - React ref to the grid container element
 * @returns Object with coordinate utilities:
 *   - `getGridCoords(clientX, clientY)` - Convert screen position to grid coords (or null if outside)
 *   - `clampCoords(coord)` - Clamp coordinates to valid grid bounds
 *   - `isInBounds(coord)` - Check if coordinates are within grid bounds
 *   - `cellSize` - Current cell size in pixels (accounts for zoom)
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
  const drawer = useLayoutStore(state => state.layout.drawer);

  const cellSize = Math.round(BASE_CELL_SIZE * zoom);
  const gap = 1; // 1px gap between cells

  const getGridCoords = useCallback((clientX: number, clientY: number): Coord | null => {
    if (!gridRef.current) return null;

    const rect = gridRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // Account for gap
    const x = Math.floor(relX / (cellSize + gap));
    // Y is inverted (0 at bottom in our coordinate system)
    const y = drawer.depth - 1 - Math.floor(relY / (cellSize + gap));

    return { x, y };
  }, [gridRef, cellSize, drawer.depth]);

  const clampCoords = useCallback((coord: Coord): Coord => ({
    x: clamp(coord.x, 0, drawer.width - 1),
    y: clamp(coord.y, 0, drawer.depth - 1),
  }), [drawer.width, drawer.depth]);

  const isInBounds = useCallback((coord: Coord): boolean => {
    return coord.x >= 0 && coord.x < drawer.width &&
           coord.y >= 0 && coord.y < drawer.depth;
  }, [drawer.width, drawer.depth]);

  return { getGridCoords, clampCoords, isInBounds, cellSize };
}
