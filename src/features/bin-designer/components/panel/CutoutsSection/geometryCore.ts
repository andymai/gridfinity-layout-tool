/**
 * Dependency-free geometry primitives consumed by every CutoutsSection
 * geometry sub-module.
 *
 * Extracted out of `geometry.ts` to break the circular dependency that
 * would otherwise form when each sibling (`geometryResize`,
 * `geometryAlignment`, `geometryFlips`) imports a shared helper from
 * the facade while the facade re-exports symbols from those siblings.
 *
 * The facade (`geometry.ts`) re-exports everything here plus the sibling
 * surfaces, so external callers still import from `./geometry`.
 */

import type { Cutout, PathPoint } from '@/features/bin-designer/types';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { pointsBounds } from '@/shared/utils/pointsBounds';

/** Axis-aligned bounding box */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Default grid snap size in mm */
export const SNAP_GRID_SIZE = 1;

/** Snap a value to the nearest grid increment */
export function snapToGrid(value: number, gridSize: number = SNAP_GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

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
 * A path's outline turned about the centre of its points, the pivot the
 * renderer and the worker turn it about. Stored rotation is clockwise-positive
 * and `rotatePoint` is counter-clockwise, so the angle is negated: the
 * un-negated angle measures a mirror image of where the path sits.
 */
function pathOutlineBounds(path: readonly PathPoint[], rotation: number): Bounds {
  const points = flattenPath(path);
  const base = pointsBounds(points);
  if (!rotation) return base;
  const cx = (base.minX + base.maxX) / 2;
  const cy = (base.minY + base.maxY) / 2;
  return pointsBounds(points.map((p) => rotatePoint(p.x, p.y, cx, cy, -rotation)));
}

/**
 * Get the axis-aligned bounding box of a rotated cutout: what the board
 * measures it by.
 *
 * A path is measured by its outline, because its stored box can be far larger
 * than the shape once turned: a tool traced at an angle has a square box. A
 * circle is an ellipse, so it gets the exact ellipse box. Every other shape
 * gets the box of its turned corners, which encloses it but can be loose off a
 * quarter turn (a slot's round ends, a polygon's cut corners).
 */
export function getRotatedBounds(cutout: Cutout): Bounds {
  if (cutout.shape === 'path' && cutout.path && cutout.path.length > 0) {
    const outline = pathOutlineBounds(cutout.path, cutout.rotation);
    if (Number.isFinite(outline.minX)) return outline;
  }
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

  const ellipse = cutout.shape === 'circle';
  const halfW_aa = ellipse ? Math.hypot(hw * cosA, hd * sinA) : hw * cosA + hd * sinA;
  const halfD_aa = ellipse ? Math.hypot(hw * sinA, hd * cosA) : hw * sinA + hd * cosA;

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

  // Already off the board (a typed oversize W/H,) — no angle fits, so the
  // search below would converge back onto the current rotation and the control
  // would silently do nothing. The guard exists to stop a rotation pushing a
  // fitting cutout out, not to freeze one that is already out.
  if (!fitsInBounds(cutout.rotation)) {
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

export function computeRotatedBounds(cutouts: readonly Cutout[]): Bounds {
  if (cutouts.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const cutout of cutouts) {
    const b = getRotatedBounds(cutout);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * The `x`/`y` range that keeps a cutout's turned outline on the board.
 *
 * `x`/`y` place the unturned box, and the outline moves with it. A long shape
 * turned 90° is narrower than its box on one axis, so its range there reaches
 * past the board edge. A turned path's outline need not be centred on its box,
 * so the range is read from where the outline sits, not from its width.
 */
export function boardPositionRange(cutout: Cutout, binWidth: number, binDepth: number): Bounds {
  const rb = getRotatedBounds(cutout);
  return {
    minX: cutout.x - rb.minX,
    minY: cutout.y - rb.minY,
    maxX: cutout.x + binWidth - rb.maxX,
    maxY: cutout.y + binDepth - rb.maxY,
  };
}

/**
 * Clamp one axis to `[min, max]`, or pass the value through when that range is
 * empty.
 *
 * An empty range means the shape is bigger than the board on this axis, which
 * the editor treats as a state to work in rather than an error: `W`/`H` are
 * `softMax` so a measured size past the board is kept (#3061), and the off-board
 * banner offers to grow the bin to fit. Clamping an empty range collapses to
 * `min`, so the shape that most needs positioning is the one that cannot be
 * moved — the axis is simply dead under the cursor (#4122).
 */
export function clampToBoardAxis(value: number, min: number, max: number): number {
  return max < min ? value : Math.min(Math.max(value, min), max);
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
    x: clampToBoardAxis(cutout.x, 0, binWidth - cutout.width),
    y: clampToBoardAxis(cutout.y, 0, binDepth - cutout.depth),
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
