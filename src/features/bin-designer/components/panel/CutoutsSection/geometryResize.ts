/**
 * Resize-handle math for the cutout editor.
 *
 * `calculateCutoutResize` is the core: it transforms the cursor into the
 * cutout's local axes (so handles rotate with the shape), applies edge
 * direction logic for the dragged handle, supports Shift (aspect lock)
 * and Alt (mirror around center), then clamps to bin bounds while
 * keeping the rotated AABB inside the bin.
 *
 * `constrainGroupDrag` is the simpler multi-cutout drag clamp.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import type { ResizeHandle } from './useCutoutInteraction';
import { computeBounds, getRotatedBounds, rotatePoint } from './geometryCore';

/** Minimum cutout dimension in mm */
export const MIN_CUTOUT_SIZE = 2;

/** Starting rectangle for resize operations */
export interface StartRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
}

/**
 * Calculate new cutout dimensions from a resize handle drag.
 *
 * Resizes along the cutout's local axes (handles rotate with the shape).
 * When `shiftConstrain` is true, the aspect ratio from `start` is preserved.
 */
export function calculateCutoutResize(
  start: StartRect,
  handle: ResizeHandle,
  cursorMmX: number,
  cursorMmY: number,
  binWidth: number,
  binDepth: number,
  shape: CutoutShape,
  rotation: number = 0,
  shiftConstrain: boolean = false,
  altConstrain: boolean = false
): { x: number; y: number; width: number; depth: number } {
  // Transform cursor into local (unrotated) space
  const cx = start.x + start.width / 2;
  const cy = start.y + start.depth / 2;
  const local = rotatePoint(cursorMmX, cursorMmY, cx, cy, -rotation);
  const localX = local.x;
  const localY = local.y;

  let { x, y, width, depth } = start;
  const right = x + width;
  const top = y + depth;

  // Resize: adjust edges based on handle direction (in local space)
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');
  const hasE = handle.includes('e');
  const hasW = handle.includes('w');

  if (altConstrain) {
    // Alt+resize: mirror around the original center
    if (hasE || hasW) {
      const halfW = Math.max(MIN_CUTOUT_SIZE / 2, Math.abs(localX - cx));
      width = halfW * 2;
      x = cx - halfW;
    }
    if (hasN || hasS) {
      const halfD = Math.max(MIN_CUTOUT_SIZE / 2, Math.abs(localY - cy));
      depth = halfD * 2;
      y = cy - halfD;
    }
  } else {
    if (hasE) {
      width = Math.max(MIN_CUTOUT_SIZE, localX - x);
    }
    if (hasW) {
      const newX = Math.min(localX, right - MIN_CUTOUT_SIZE);
      width = right - newX;
      x = newX;
    }
    if (hasN) {
      depth = Math.max(MIN_CUTOUT_SIZE, localY - y);
    }
    if (hasS) {
      const newY = Math.min(localY, top - MIN_CUTOUT_SIZE);
      depth = top - newY;
      y = newY;
    }
  }

  // Shift-constrain: preserve aspect ratio
  if (shiftConstrain && start.width > 0 && start.depth > 0) {
    const aspect = start.width / start.depth;
    const isCorner = (hasN || hasS) && (hasE || hasW);
    const isVertical = hasN || hasS;

    if (isCorner) {
      // Use the axis with more change
      const dw = Math.abs(width - start.width);
      const dd = Math.abs(depth - start.depth);
      if (dw > dd) {
        const newDepth = width / aspect;
        if (hasS) {
          y = top - newDepth;
        }
        depth = newDepth;
      } else {
        const newWidth = depth * aspect;
        if (hasW) {
          x = right - newWidth;
        }
        width = newWidth;
      }
    } else if (isVertical) {
      const newWidth = depth * aspect;
      x = cx - newWidth / 2;
      width = newWidth;
    } else {
      const newDepth = width / aspect;
      y = cy - newDepth / 2;
      depth = newDepth;
    }
  }

  // Clamp to bin bounds (conservative: use AABB of rotated shape)
  width = Math.max(MIN_CUTOUT_SIZE, width);
  depth = Math.max(MIN_CUTOUT_SIZE, depth);

  // For rotated shapes, ensure the rotated AABB fits in bin
  if (rotation !== 0) {
    const testCutout = { x, y, width, depth, rotation, shape } as Cutout;
    const rBounds = getRotatedBounds(testCutout);
    // Shift to keep within bounds
    if (rBounds.minX < 0) x -= rBounds.minX;
    if (rBounds.minY < 0) y -= rBounds.minY;
    if (rBounds.maxX > binWidth) x -= rBounds.maxX - binWidth;
    if (rBounds.maxY > binDepth) y -= rBounds.maxY - binDepth;
  } else {
    // Simple axis-aligned clamping
    if (x < 0) {
      width += x;
      x = 0;
    }
    if (y < 0) {
      depth += y;
      y = 0;
    }
    if (x + width > binWidth) width = binWidth - x;
    if (y + depth > binDepth) depth = binDepth - y;
  }

  width = Math.max(MIN_CUTOUT_SIZE, width);
  depth = Math.max(MIN_CUTOUT_SIZE, depth);

  return { x, y, width, depth };
}

/**
 * Clamp a group drag delta so all cutouts remain within bin bounds.
 */
export function constrainGroupDrag(
  cutouts: readonly Cutout[],
  dx: number,
  dy: number,
  binWidth: number,
  binDepth: number
): { dx: number; dy: number } {
  const bounds = computeBounds(cutouts);
  const clampedDx = Math.max(-bounds.minX, Math.min(dx, binWidth - bounds.maxX));
  const clampedDy = Math.max(-bounds.minY, Math.min(dy, binDepth - bounds.maxY));
  return { dx: clampedDx, dy: clampedDy };
}

/**
 * Clamp corner radius to at most half the smaller dimension.
 */
export function clampCornerRadius(radius: number, width: number, depth: number): number {
  return Math.min(radius, Math.min(width, depth) / 2);
}

/** CSS cursor for each resize handle direction */
const RESIZE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

/**
 * Get the CSS cursor string for a resize handle direction.
 */
export function getResizeCursor(handle: ResizeHandle): string {
  return RESIZE_CURSORS[handle];
}
