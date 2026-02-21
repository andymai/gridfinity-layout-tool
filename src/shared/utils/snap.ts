import type { Bin, BinId, LayerId, Layout, Rect, ResizeHandle } from '@/core/types';
import { canPlaceBin } from './validation';
import { spiralOffsets } from './position';
import { calculateResizeRect } from './resize';

/** Maximum grid steps searched outward from cursor position. */
export const SNAP_RADIUS = 2;

/** Result of a snap operation. */
export interface SnapResult {
  /** Snapped x coordinate (absolute position or delta, depending on context) */
  x: number;
  /** Snapped y coordinate (absolute position or delta, depending on context) */
  y: number;
  /** True if the result differs from the originally requested position */
  isSnapped: boolean;
}

/**
 * Sort spiral offsets to prefer the direction of user movement.
 * Offsets whose direction matches the movement direction come first.
 */
function sortByMovementDirection(
  offsets: Array<{ dx: number; dy: number; distance: number }>,
  moveDirX: number,
  moveDirY: number
): Array<{ dx: number; dy: number; distance: number }> {
  return [...offsets].sort((a, b) => {
    // Dot product with movement direction — higher = more aligned with movement
    const scoreA = Math.sign(a.dx) * moveDirX + Math.sign(a.dy) * moveDirY;
    const scoreB = Math.sign(b.dx) * moveDirX + Math.sign(b.dy) * moveDirY;
    return scoreB - scoreA; // Higher score first
  });
}

/**
 * Search spiral offsets in distance-batched order, preferring movement direction.
 * At each distance tier, offsets are sorted by alignment with the movement
 * direction before testing. Returns the first offset where `predicate` is true.
 *
 * @param step - Grid step (0.5 for half-bin, 1 for normal)
 * @param moveDirX - Sign of cursor movement X (-1, 0, 1)
 * @param moveDirY - Sign of cursor movement Y (-1, 0, 1)
 * @param predicate - Test function receiving (dx, dy); return true to accept
 * @returns The accepted {dx, dy} or null if none found
 */
function searchSpiral(
  step: number,
  moveDirX: number,
  moveDirY: number,
  predicate: (dx: number, dy: number) => boolean
): { dx: number; dy: number } | null {
  // Collect all offsets and sort by true distance so that e.g. distance=1.5
  // cardinals from a later radius ring are tested before distance=2.0 corners
  // from an earlier ring (matters for half-bin step=0.5).
  const allOffsets = [...spiralOffsets(SNAP_RADIUS, step)].sort((a, b) => a.distance - b.distance);

  let currentDistance = -1;
  let batch: Array<{ dx: number; dy: number; distance: number }> = [];

  const processBatch = (): { dx: number; dy: number } | null => {
    const sorted = sortByMovementDirection(batch, moveDirX, moveDirY);
    for (const { dx, dy } of sorted) {
      if (predicate(dx, dy)) {
        return { dx, dy };
      }
    }
    return null;
  };

  for (const offset of allOffsets) {
    if (offset.distance !== currentDistance) {
      if (batch.length > 0) {
        const found = processBatch();
        if (found) return found;
      }
      batch = [];
      currentDistance = offset.distance;
    }
    batch.push(offset);
  }

  // Process final batch
  if (batch.length > 0) {
    const found = processBatch();
    if (found) return found;
  }

  return null;
}

/**
 * Find a valid position for a single bin by searching outward from the target.
 *
 * @param targetX - Target X position (absolute grid coordinate)
 * @param targetY - Target Y position (absolute grid coordinate)
 * @param width - Bin width
 * @param depth - Bin depth
 * @param height - Bin height
 * @param layerId - Target layer
 * @param layout - Current layout for validation
 * @param excludeBinId - Bin to exclude from collision checks (the bin being moved)
 * @param moveDirX - Sign of cursor movement X (-1, 0, 1) for tie-breaking
 * @param moveDirY - Sign of cursor movement Y (-1, 0, 1) for tie-breaking
 * @param step - Grid step (0.5 for half-bin mode, 1 for normal)
 * @param clearanceHeight - Optional clearance above the bin
 * @returns SnapResult with the valid position, or null if none found
 */
export function snapPosition(
  targetX: number,
  targetY: number,
  width: number,
  depth: number,
  height: number,
  layerId: LayerId,
  layout: Layout,
  excludeBinId: BinId,
  moveDirX: number,
  moveDirY: number,
  step: number,
  clearanceHeight?: number
): SnapResult | null {
  // First check if target position is already valid
  const directResult = canPlaceBin(
    { x: targetX, y: targetY, width, depth, height, clearanceHeight },
    layerId,
    layout,
    excludeBinId
  );
  if (directResult.valid) {
    return { x: targetX, y: targetY, isSnapped: false };
  }

  // Only snap for collision/blocked_zone — not for bounds violations
  if (directResult.reason !== 'collision' && directResult.reason !== 'blocked_zone') {
    return null;
  }

  const maxDrawerX = layout.drawer.width - width;
  const maxDrawerY = layout.drawer.depth - depth;

  const found = searchSpiral(step, moveDirX, moveDirY, (dx, dy) => {
    const cx = targetX + dx;
    const cy = targetY + dy;
    if (cx < 0 || cy < 0 || cx > maxDrawerX || cy > maxDrawerY) return false;
    return canPlaceBin(
      { x: cx, y: cy, width, depth, height, clearanceHeight },
      layerId,
      layout,
      excludeBinId
    ).valid;
  });

  if (found) {
    return { x: targetX + found.dx, y: targetY + found.dy, isSnapped: true };
  }

  return null;
}

/**
 * Find a valid delta for dragging a group of bins.
 * All bins must be valid at the candidate delta for it to succeed.
 *
 * @param draggedBins - All bins being dragged
 * @param requestedDeltaX - Desired X delta (constrained to bounds)
 * @param requestedDeltaY - Desired Y delta (constrained to bounds)
 * @param layerId - Target layer
 * @param layout - Current layout
 * @param excludeBinIds - All dragged bin IDs to exclude from collision
 * @param moveDirX - Sign of cursor movement X (-1, 0, 1)
 * @param moveDirY - Sign of cursor movement Y (-1, 0, 1)
 * @param step - Grid step (0.5 for half-bin, 1 for normal)
 * @returns SnapResult with snapped delta, or null if no valid delta found
 */
export function snapGroupDelta(
  draggedBins: Bin[],
  requestedDeltaX: number,
  requestedDeltaY: number,
  layerId: LayerId,
  layout: Layout,
  excludeBinIds: Set<BinId>,
  moveDirX: number,
  moveDirY: number,
  step: number
): SnapResult | null {
  // Helper to check if all bins are valid at a given delta
  const allValid = (dx: number, dy: number): boolean => {
    for (const bin of draggedBins) {
      const newX = bin.x + dx;
      const newY = bin.y + dy;
      // Quick bounds check
      if (newX < 0 || newY < 0) return false;
      if (newX + bin.width > layout.drawer.width) return false;
      if (newY + bin.depth > layout.drawer.depth) return false;
      const result = canPlaceBin(
        {
          x: newX,
          y: newY,
          width: bin.width,
          depth: bin.depth,
          height: bin.height,
          clearanceHeight: bin.clearanceHeight,
        },
        layerId,
        layout,
        bin.id,
        excludeBinIds
      );
      if (!result.valid) return false;
    }
    return true;
  };

  // Try the requested delta first
  if (allValid(requestedDeltaX, requestedDeltaY)) {
    return { x: requestedDeltaX, y: requestedDeltaY, isSnapped: false };
  }

  // Search outward from requested delta
  const found = searchSpiral(step, moveDirX, moveDirY, (dx, dy) =>
    allValid(requestedDeltaX + dx, requestedDeltaY + dy)
  );

  if (found) {
    return { x: requestedDeltaX + found.dx, y: requestedDeltaY + found.dy, isSnapped: true };
  }

  return null;
}

/**
 * Find the maximum valid resize rect by walking the handle dimension back.
 * When the user's requested resize would cause a collision, this finds the
 * largest valid size between startRect and requestedRect.
 *
 * @param startRect - Original rect before resize
 * @param handle - Which resize handle is being dragged
 * @param requestedRect - The rect the user wants (may be invalid)
 * @param binHeight - Bin height for collision checks
 * @param layerId - Target layer
 * @param layout - Current layout
 * @param excludeBinId - The bin being resized
 * @param excludeBinIds - All bins in the resize group
 * @param step - Grid step (0.5 or 1)
 * @param drawer - Drawer dimensions
 * @returns Object with the largest valid rect and whether it was snapped
 */
export function snapResizeRect(
  startRect: Rect,
  handle: ResizeHandle,
  requestedRect: Rect,
  binHeight: number,
  layerId: LayerId,
  layout: Layout,
  excludeBinId: BinId,
  excludeBinIds: Set<BinId>,
  step: number,
  drawer: { width: number; depth: number },
  clearanceHeight?: number
): { rect: Rect; isSnapped: boolean } {
  // If requested rect is already valid, use it directly
  const reqResult = canPlaceBin(
    { ...requestedRect, height: binHeight, clearanceHeight },
    layerId,
    layout,
    excludeBinId,
    excludeBinIds
  );
  if (reqResult.valid) {
    return { rect: requestedRect, isSnapped: false };
  }

  // Only snap for collision/blocked_zone — not for bounds violations
  if (reqResult.reason !== 'collision' && reqResult.reason !== 'blocked_zone') {
    return { rect: startRect, isSnapped: false };
  }

  // Walk back from requestedRect toward startRect along the resized dimension(s)
  // by reducing the cursor position in steps until valid
  const minSize = step;

  // Determine which dimensions are changing based on handle
  const resizesWidth = handle.includes('e') || handle.includes('w');
  const resizesDepth = handle.includes('n') || handle.includes('s');

  // Generate candidate rects by walking back the cursor position
  // We simulate the cursor moving from its current position back toward the start
  let bestRect: Rect | null = null;

  // Calculate the effective cursor delta range
  // For east/north handles: cursor.x or cursor.y increases size
  // For west/south handles: cursor.x or cursor.y decreases position
  const widthSteps = resizesWidth
    ? Math.ceil(Math.abs(requestedRect.width - startRect.width) / step)
    : 0;
  const depthSteps = resizesDepth
    ? Math.ceil(Math.abs(requestedRect.depth - startRect.depth) / step)
    : 0;
  const totalSteps = Math.max(widthSteps, depthSteps);

  // Walk from just before requestedRect back toward startRect
  for (let i = 1; i <= totalSteps; i++) {
    // Interpolate: move cursor back by i steps toward start
    const t = i / totalSteps;
    const cursorX = requestedRect.x + (startRect.x - requestedRect.x) * t;
    const cursorY = requestedRect.y + (startRect.y - requestedRect.y) * t;

    // Use a synthetic cursor that produces a rect between start and requested
    // Calculate what cursor position would produce this interpolated rect
    let synthCursorX = cursorX;
    let synthCursorY = cursorY;

    if (handle.includes('e')) {
      synthCursorX =
        startRect.x +
        (requestedRect.x + requestedRect.width - startRect.x - startRect.width) * (1 - t) +
        startRect.width -
        minSize;
    }
    if (handle.includes('n')) {
      synthCursorY =
        startRect.y +
        (requestedRect.y + requestedRect.depth - startRect.y - startRect.depth) * (1 - t) +
        startRect.depth -
        minSize;
    }

    const candidateRect = calculateResizeRect(
      startRect,
      handle,
      { x: synthCursorX, y: synthCursorY },
      drawer,
      minSize
    );

    const result = canPlaceBin(
      { ...candidateRect, height: binHeight, clearanceHeight },
      layerId,
      layout,
      excludeBinId,
      excludeBinIds
    );

    if (result.valid) {
      bestRect = candidateRect;
      break; // First valid rect walking back from requested is the largest
    }
  }

  if (bestRect) {
    return { rect: bestRect, isSnapped: true };
  }

  // Fallback: return the start rect (original size, always valid)
  return { rect: startRect, isSnapped: false };
}

/**
 * Clamp a drawn rectangle's dimensions to avoid collision.
 * Shrinks from the far edge (preserving the origin corner) until valid.
 *
 * @param originX - Draw origin X (top-left of drawn rect)
 * @param originY - Draw origin Y
 * @param requestedWidth - User's drawn width
 * @param requestedDepth - User's drawn depth
 * @param layerHeight - Height from the active layer
 * @param layerId - Target layer
 * @param layout - Current layout
 * @param step - Grid step (0.5 or 1)
 * @returns Clamped dimensions that fit without collision
 */
export function snapDrawRect(
  originX: number,
  originY: number,
  requestedWidth: number,
  requestedDepth: number,
  layerHeight: number,
  layerId: LayerId,
  layout: Layout,
  step: number
): { width: number; depth: number } {
  // Check if the full size is already valid
  const fullResult = canPlaceBin(
    { x: originX, y: originY, width: requestedWidth, depth: requestedDepth, height: layerHeight },
    layerId,
    layout
  );
  if (fullResult.valid) {
    return { width: requestedWidth, depth: requestedDepth };
  }

  // Only snap for collision/blocked_zone
  if (fullResult.reason !== 'collision' && fullResult.reason !== 'blocked_zone') {
    return { width: requestedWidth, depth: requestedDepth };
  }

  // Try shrinking width first, then depth, then both
  // Shrink width from requestedWidth down to step
  for (let w = requestedWidth - step; w >= step; w -= step) {
    const result = canPlaceBin(
      { x: originX, y: originY, width: w, depth: requestedDepth, height: layerHeight },
      layerId,
      layout
    );
    if (result.valid) {
      return { width: w, depth: requestedDepth };
    }
  }

  // Shrink depth from requestedDepth down to step
  for (let d = requestedDepth - step; d >= step; d -= step) {
    const result = canPlaceBin(
      { x: originX, y: originY, width: requestedWidth, depth: d, height: layerHeight },
      layerId,
      layout
    );
    if (result.valid) {
      return { width: requestedWidth, depth: d };
    }
  }

  // Shrink both dimensions
  for (let w = requestedWidth - step; w >= step; w -= step) {
    for (let d = requestedDepth - step; d >= step; d -= step) {
      const result = canPlaceBin(
        { x: originX, y: originY, width: w, depth: d, height: layerHeight },
        layerId,
        layout
      );
      if (result.valid) {
        return { width: w, depth: d };
      }
    }
  }

  // No valid size found — return original (will fail at addBin and be rejected)
  return { width: requestedWidth, depth: requestedDepth };
}
