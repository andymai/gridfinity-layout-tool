import type { Coord, GridUnits, Rect, ResizeHandle } from '@/core/types';

/**
 * Calculate new rectangle based on resize handle and cursor position.
 * Pure function for computing resize transformations.
 *
 * Handle directions:
 * - 'e' (east): expand right edge
 * - 'w' (west): expand left edge (moves x position)
 * - 'n' (north): expand top edge (in grid Y coords)
 * - 's' (south): expand bottom edge (moves y position)
 *
 * @param start - Original rectangle before resize
 * @param handle - Which handle is being dragged (e.g., 'e', 'sw', 'ne')
 * @param cursor - Current cursor position in grid coordinates
 * @param drawer - Drawer dimensions for bounds clamping
 * @param minSize - Minimum size for width/depth (0.5 in half-bin mode, 1 normally)
 * @returns New rectangle with resize applied and bounds-clamped
 */
export function calculateResizeRect(
  start: Rect,
  handle: ResizeHandle,
  cursor: Coord,
  drawer: { width: number; depth: number },
  minSize: number = 1
): Rect {
  let { x, y, width, depth } = start;

  // East: expand right edge
  if (handle.includes('e')) {
    width = Math.max(minSize, cursor.x - x + minSize) as GridUnits;
  }
  // West: expand left edge (move x, adjust width)
  if (handle.includes('w')) {
    const newX = Math.min(cursor.x, x + width - minSize) as GridUnits;
    width = (x + width - newX) as GridUnits;
    x = newX;
  }
  // North: expand top edge (in grid Y coordinates)
  if (handle.includes('n')) {
    depth = Math.max(minSize, cursor.y - y + minSize) as GridUnits;
  }
  // South: expand bottom edge (move y, adjust depth)
  if (handle.includes('s')) {
    const newY = Math.min(cursor.y, y + depth - minSize) as GridUnits;
    depth = (y + depth - newY) as GridUnits;
    y = newY;
  }

  // Clamp to drawer bounds
  x = Math.max(0, x) as GridUnits;
  y = Math.max(0, y) as GridUnits;
  if (x + width > drawer.width) width = (drawer.width - x) as GridUnits;
  if (y + depth > drawer.depth) depth = (drawer.depth - y) as GridUnits;
  width = Math.max(minSize, width) as GridUnits;
  depth = Math.max(minSize, depth) as GridUnits;

  return { x, y, width, depth };
}
