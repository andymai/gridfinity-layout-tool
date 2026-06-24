/**
 * Off-board cutout detection + recovery.
 *
 * Cutouts are stored in absolute interior-mm and are never auto-rescaled when
 * the bin is resized, so shrinking the footprint can strand a cutout past the
 * board edge. The mesh builder silently clips that overhang, so the editor
 * surfaces it instead: flag the strays and offer a one-click clamp back in.
 *
 * Footprints are measured with the same `getCutoutBounds` placement validation
 * uses (true vertex bounds for paths), and a custom (masked) footprint defers
 * to the shared polygon-containment check so a cutout inside the bounding
 * rectangle but over an unfilled mask cell is still flagged.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { translatePathPoints } from './pathGeometry';
import { getCutoutBounds, cutoutFitsInMask, type MaskCellSize } from './maskFit';

/** Tolerance (mm) — mirrors the interaction clamps so a flush edge isn't flagged. */
const EPSILON = 0.01;

/** True when any part of the cutout falls outside the (optionally masked) board. */
export function isCutoutOffBoard(
  cutout: Cutout,
  binWidth: number,
  binDepth: number,
  mask?: CellMask,
  cellSize?: MaskCellSize
): boolean {
  // Custom (masked) footprint: a cutout inside the bounding rectangle can still
  // overhang the polygon, so defer to the same containment check placements use.
  if (mask && cellSize) return !cutoutFitsInMask(cutout, mask, cellSize);
  const b = getCutoutBounds(cutout);
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
  binDepth: number,
  mask?: CellMask,
  cellSize?: MaskCellSize
): Set<string> {
  const ids = new Set<string>();
  for (const c of cutouts) {
    if (isCutoutOffBoard(c, binWidth, binDepth, mask, cellSize)) ids.add(c.id);
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
 * Translation that brings a stray cutout's footprint back inside the board's
 * bounding rectangle. Returns `null` when no move is needed.
 *
 * Best-effort for concave (masked) footprints: it pulls the cutout within the
 * bounding rectangle, but a remaining over-an-unfilled-cell overhang stays
 * flagged (and the generator clips it) — translation alone can't fit an
 * arbitrary polygon.
 */
export function clampCutoutToBoard(
  cutout: Cutout,
  binWidth: number,
  binDepth: number
): Partial<Cutout> | null {
  const b = getCutoutBounds(cutout);
  const dx = fitAxis(b.minX, b.maxX, binWidth);
  const dy = fitAxis(b.minY, b.maxY, binDepth);
  if (dx === 0 && dy === 0) return null;
  const moved: Partial<Cutout> = { x: cutout.x + dx, y: cutout.y + dy };
  // Path vertices are absolute mm, so move them in lockstep with x/y.
  if (cutout.shape === 'path' && cutout.path) {
    return { ...moved, path: translatePathPoints(cutout.path, dx, dy) };
  }
  return moved;
}

/** Position updates for every off-board cutout that a clamp can move (empty when none). */
export function clampOffBoardCutouts(
  cutouts: readonly Cutout[],
  binWidth: number,
  binDepth: number,
  mask?: CellMask,
  cellSize?: MaskCellSize
): Map<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  for (const c of cutouts) {
    if (!isCutoutOffBoard(c, binWidth, binDepth, mask, cellSize)) continue;
    const moved = clampCutoutToBoard(c, binWidth, binDepth);
    if (moved) updates.set(c.id, moved);
  }
  return updates;
}
