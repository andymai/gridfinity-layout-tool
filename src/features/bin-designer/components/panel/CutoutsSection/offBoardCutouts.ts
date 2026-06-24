/**
 * Off-board cutout detection + recovery.
 *
 * Cutouts are stored in absolute interior-mm and are never auto-rescaled when
 * the bin is resized, so shrinking the footprint can strand a cutout past the
 * board edge. The mesh builder silently clips that overhang, so the editor
 * surfaces it instead: flag the strays and offer a one-click clamp back in.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { getRotatedBounds } from './geometryCore';

/** Tolerance (mm) — mirrors the interaction clamps so a flush edge isn't flagged. */
const EPSILON = 0.01;

/** True when any part of the cutout's rotated bounds falls outside the board. */
export function isCutoutOffBoard(cutout: Cutout, binWidth: number, binDepth: number): boolean {
  const b = getRotatedBounds(cutout);
  return (
    b.minX < -EPSILON ||
    b.minY < -EPSILON ||
    b.maxX > binWidth + EPSILON ||
    b.maxY > binDepth + EPSILON
  );
}

/** Ids of every cutout stranded past the current board footprint. */
export function getOffBoardCutoutIds(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number
): Set<string> {
  const ids = new Set<string>();
  for (const c of cutouts) {
    if (isCutoutOffBoard(c, binWidth, binDepth)) ids.add(c.id);
  }
  return ids;
}

/** Shift to bring [min,max] inside [0,extent]; pin the min edge when oversized. */
function fitAxis(min: number, max: number, extent: number): number {
  // Larger than the board on this axis — both edges can't fit, so anchor the
  // min edge to the origin and let the build clip the overhang on the far side.
  if (max - min > extent) return -min;
  if (min < 0) return -min;
  if (max > extent) return extent - max;
  return 0;
}

/**
 * New x/y that brings a stray cutout's rotated bounds back inside the board.
 * Translation only — position changes, never size or rotation.
 */
export function clampCutoutToBoard(
  cutout: Cutout,
  binWidth: number,
  binDepth: number
): { x: number; y: number } {
  const b = getRotatedBounds(cutout);
  return {
    x: cutout.x + fitAxis(b.minX, b.maxX, binWidth),
    y: cutout.y + fitAxis(b.minY, b.maxY, binDepth),
  };
}

/** Position updates for every off-board cutout, keyed by id (empty when none). */
export function clampOffBoardCutouts(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number
): Map<string, { x: number; y: number }> {
  const updates = new Map<string, { x: number; y: number }>();
  for (const c of cutouts) {
    if (isCutoutOffBoard(c, binWidth, binDepth)) {
      updates.set(c.id, clampCutoutToBoard(c, binWidth, binDepth));
    }
  }
  return updates;
}
