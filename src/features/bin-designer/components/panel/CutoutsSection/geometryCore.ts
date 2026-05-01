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

import type { Cutout } from '@/features/bin-designer/types';

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
