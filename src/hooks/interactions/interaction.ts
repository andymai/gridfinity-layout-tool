import type { Coord, Rect, ResizeHandle, Interaction } from '@/core/types';
import type { InteractionHint } from '@/liveblocks.config';
import type { PointerCaptureHandle } from './types';

/**
 * Capture pointer at document body level for reliable event delivery during interactions.
 *
 * This is used by all interaction modes (drag, resize, draw, staging drag) to ensure
 * pointer events continue to be delivered even when the cursor moves outside the
 * original target element.
 *
 * @param pointerId - The pointer ID to capture (from PointerEvent.pointerId)
 * @param activePointerIdRef - Ref to store the active pointer ID
 * @param capturedPointerRef - Ref to store the capture handle for cleanup
 * @returns true if capture succeeded, false otherwise
 */
export function capturePointer(
  pointerId: number | undefined,
  activePointerIdRef: React.MutableRefObject<number | null>,
  capturedPointerRef: React.MutableRefObject<PointerCaptureHandle | null>
): boolean {
  if (pointerId === undefined) {
    return false;
  }

  activePointerIdRef.current = pointerId;
  try {
    document.body.setPointerCapture(pointerId);
    capturedPointerRef.current = { element: document.body, pointerId };
    return true;
  } catch {
    // Ignore if capture fails (e.g., pointer already released)
    return false;
  }
}

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
    width = Math.max(minSize, cursor.x - x + minSize);
  }
  // West: expand left edge (move x, adjust width)
  if (handle.includes('w')) {
    const newX = Math.min(cursor.x, x + width - minSize);
    width = x + width - newX;
    x = newX;
  }
  // North: expand top edge (in grid Y coordinates)
  if (handle.includes('n')) {
    depth = Math.max(minSize, cursor.y - y + minSize);
  }
  // South: expand bottom edge (move y, adjust depth)
  if (handle.includes('s')) {
    const newY = Math.min(cursor.y, y + depth - minSize);
    depth = y + depth - newY;
    y = newY;
  }

  // Clamp to drawer bounds
  x = Math.max(0, x);
  y = Math.max(0, y);
  if (x + width > drawer.width) width = drawer.width - x;
  if (y + depth > drawer.depth) depth = drawer.depth - y;
  width = Math.max(minSize, width);
  depth = Math.max(minSize, depth);

  return { x, y, width, depth };
}

/**
 * Convert local interaction state to InteractionHint format for collaborative broadcasting.
 * Maps internal interaction types to the remote-friendly hint format that other users see.
 *
 * @param interaction - Current interaction state (or null if idle)
 * @returns InteractionHint suitable for broadcasting to collaborators
 */
export function mapInteractionToHint(interaction: Interaction | null): InteractionHint {
  if (!interaction) {
    return { type: 'idle' };
  }

  switch (interaction.type) {
    case 'draw':
      return { type: 'drawing', start: interaction.start, current: interaction.current };
    case 'paint':
      // Paint mode appears as drawing to remote users
      return { type: 'drawing', start: interaction.start, current: interaction.current };
    case 'drag':
      return { type: 'dragging', binIds: interaction.binIds, delta: interaction.currentCoord };
    case 'resize':
      return { type: 'resizing', binIds: interaction.binIds, handle: interaction.handle };
    case 'stagingDrag':
      // Don't broadcast staging drags (too ephemeral/confusing for remote users)
      return { type: 'idle' };
    default:
      return { type: 'idle' };
  }
}
