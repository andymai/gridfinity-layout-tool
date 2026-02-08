/**
 * Geometry utilities for cutout positioning and bounds computation.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';
import type { ResizeHandle } from './useCutoutInteraction';

// ─── Rotation Helpers ───────────────────────────────────────────────────────

/** Rotate a point (px,py) around center (cx,cy) by angleDeg degrees. */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Get the axis-aligned bounding box of a rotated cutout.
 *
 * For rectangles: projects the four corners after rotation.
 * For ellipses/circles: uses the rotated ellipse AABB formula.
 */
export function getRotatedBounds(cutout: Cutout): Bounds {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const hw = cutout.width / 2;
  const hd = cutout.depth / 2;

  if (cutout.rotation === 0) {
    return {
      minX: cutout.x,
      minY: cutout.y,
      maxX: cutout.x + cutout.width,
      maxY: cutout.y + cutout.depth,
    };
  }

  const rad = (cutout.rotation * Math.PI) / 180;
  const cosA = Math.abs(Math.cos(rad));
  const sinA = Math.abs(Math.sin(rad));

  // Works for both rectangles and ellipses: half-extents after rotation
  const halfW_aa = hw * cosA + hd * sinA;
  const halfD_aa = hw * sinA + hd * cosA;

  return {
    minX: cx - halfW_aa,
    minY: cy - halfD_aa,
    maxX: cx + halfW_aa,
    maxY: cy + halfD_aa,
  };
}

/**
 * Clamp a proposed rotation angle so the rotated cutout stays within bin bounds.
 *
 * Uses binary search between current and proposed angle (~10 iterations for <0.1° precision).
 */
export function clampRotationToBounds(
  cutout: Cutout,
  proposedAngle: number,
  binWidth: number,
  binDepth: number
): number {
  const normalize = (a: number) => ((a % 360) + 360) % 360;
  const fitsInBounds = (angle: number) => {
    const b = getRotatedBounds({ ...cutout, rotation: normalize(angle) });
    return (
      b.minX >= -0.01 && b.minY >= -0.01 && b.maxX <= binWidth + 0.01 && b.maxY <= binDepth + 0.01
    );
  };

  if (fitsInBounds(proposedAngle)) {
    return normalize(proposedAngle);
  }

  // Unwrap proposed angle relative to current rotation so the binary search
  // follows the shortest arc (handles 350° → 10° wrap-around correctly)
  let delta = proposedAngle - cutout.rotation;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  let lo = cutout.rotation;
  let hi = cutout.rotation + delta;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (fitsInBounds(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return normalize(lo);
}

/** Minimum cutout dimension in mm */
export const MIN_CUTOUT_SIZE = 2;

/** Default grid snap size in mm */
export const SNAP_GRID_SIZE = 1;

/** Snap a value to the nearest grid increment */
export function snapToGrid(value: number, gridSize: number = SNAP_GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Axis-aligned bounding box */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Get the effective bounding box of a cutout (unrotated, local-space).
 * For rotation-aware AABB, use `getRotatedBounds()`.
 */
export function getEffectiveBounds(cutout: Cutout): Bounds {
  return {
    minX: cutout.x,
    minY: cutout.y,
    maxX: cutout.x + cutout.width,
    maxY: cutout.y + cutout.depth,
  };
}

/**
 * Compute the combined bounding box of multiple cutouts.
 */
export function computeBounds(cutouts: readonly Cutout[]): Bounds {
  if (cutouts.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const cutout of cutouts) {
    const b = getEffectiveBounds(cutout);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Clamp a cutout position to keep it within the bin interior.
 */
export function clampPosition(
  cutout: Cutout,
  binWidth: number,
  binDepth: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(cutout.x, binWidth - cutout.width)),
    y: Math.max(0, Math.min(cutout.y, binDepth - cutout.depth)),
  };
}

/**
 * Get the effective width of a cutout (diameter for circles).
 */
export function getEffectiveWidth(cutout: Cutout): number {
  return cutout.width;
}

/**
 * Get the effective depth of a cutout.
 * Circles/ellipses now use independent depth.
 */
export function getEffectiveDepth(cutout: Cutout): number {
  return cutout.depth;
}

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

/** A guide line indicating alignment between cutouts */
export interface AlignmentGuide {
  /** Whether this is a horizontal (Y-axis) or vertical (X-axis) guide */
  readonly axis: 'x' | 'y';
  /** Position of the guide line in mm */
  readonly position: number;
}

/** Snap threshold in mm — within this range, cutout snaps to guide */
export const GUIDE_SNAP_THRESHOLD = 1;

/**
 * Find alignment guides between the moving cutouts and stationary cutouts.
 * Checks edges (min/max) and centers of each axis.
 */
export function findAlignmentGuides(
  movingBounds: Bounds,
  stationaryCutouts: readonly Cutout[],
  threshold: number = GUIDE_SNAP_THRESHOLD
): AlignmentGuide[] {
  const guides: AlignmentGuide[] = [];

  // Key positions of the moving cutout(s)
  const movingCenterX = (movingBounds.minX + movingBounds.maxX) / 2;
  const movingCenterY = (movingBounds.minY + movingBounds.maxY) / 2;
  const movingXPositions = [movingBounds.minX, movingCenterX, movingBounds.maxX];
  const movingYPositions = [movingBounds.minY, movingCenterY, movingBounds.maxY];

  for (const cutout of stationaryCutouts) {
    const b = getEffectiveBounds(cutout);
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const xPositions = [b.minX, cx, b.maxX];
    const yPositions = [b.minY, cy, b.maxY];

    // Check X alignment (vertical guide lines)
    for (const mx of movingXPositions) {
      for (const sx of xPositions) {
        if (Math.abs(mx - sx) < threshold) {
          guides.push({ axis: 'x', position: sx });
        }
      }
    }

    // Check Y alignment (horizontal guide lines)
    for (const my of movingYPositions) {
      for (const sy of yPositions) {
        if (Math.abs(my - sy) < threshold) {
          guides.push({ axis: 'y', position: sy });
        }
      }
    }
  }

  // Deduplicate guides at same position
  const seen = new Set<string>();
  return guides.filter((g) => {
    const key = `${g.axis}:${g.position.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Distribute cutouts evenly along the horizontal axis.
 * Spaces cutouts so there's equal gap between each.
 */
export function distributeHorizontally(
  cutouts: readonly Cutout[],
  _binWidth: number
): Record<string, { x: number }> {
  if (cutouts.length < 3) return {};

  // Sort by current X position
  const sorted = [...cutouts].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Total space between leftmost left edge and rightmost right edge
  const totalSpan = last.x + last.width - first.x;
  const totalWidths = sorted.reduce((sum, c) => sum + c.width, 0);
  const gap = (totalSpan - totalWidths) / (sorted.length - 1);

  const result: Record<string, { x: number }> = {};
  let currentX = first.x;
  for (const cutout of sorted) {
    result[cutout.id] = { x: currentX };
    currentX += cutout.width + gap;
  }
  return result;
}

/**
 * Distribute cutouts evenly along the vertical axis.
 */
export function distributeVertically(
  cutouts: readonly Cutout[],
  _binDepth: number
): Record<string, { y: number }> {
  if (cutouts.length < 3) return {};

  const sorted = [...cutouts].sort((a, b) => a.y - b.y);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = last.y + getEffectiveDepth(last) - first.y;
  const totalDepths = sorted.reduce((sum, c) => sum + getEffectiveDepth(c), 0);
  const gap = (totalSpan - totalDepths) / (sorted.length - 1);

  const result: Record<string, { y: number }> = {};
  let currentY = first.y;
  for (const cutout of sorted) {
    result[cutout.id] = { y: currentY };
    currentY += getEffectiveDepth(cutout) + gap;
  }
  return result;
}

/**
 * Center a group of cutouts within the bin.
 */
export function centerInBin(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number
): Record<string, { x: number; y: number }> {
  if (cutouts.length === 0) return {};

  const bounds = computeBounds(cutouts);
  const groupW = bounds.maxX - bounds.minX;
  const groupH = bounds.maxY - bounds.minY;
  const dx = (binWidth - groupW) / 2 - bounds.minX;
  const dy = (binDepth - groupH) / 2 - bounds.minY;

  const result: Record<string, { x: number; y: number }> = {};
  for (const cutout of cutouts) {
    result[cutout.id] = { x: cutout.x + dx, y: cutout.y + dy };
  }
  return result;
}
