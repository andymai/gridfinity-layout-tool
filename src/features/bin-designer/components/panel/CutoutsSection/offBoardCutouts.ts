/**
 * Off-board cutout detection + recovery.
 *
 * Cutouts are stored in absolute interior-mm and are never auto-rescaled when
 * the bin is resized, so shrinking the footprint can strand a cutout past the
 * board edge. The mesh builder silently clips that overhang, so the editor
 * surfaces it instead: flag the strays and offer a one-click clamp back in.
 *
 * A cutout is treated as its set of expanded array instances (just itself when
 * there is no array), so an array whose outer instances spill past the edge is
 * flagged even when the master fits. Footprints use the same `getCutoutBounds`
 * placement validation uses (true vertex bounds for paths), and a custom
 * (masked) footprint defers to polygon containment.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { translatePathPoints } from './pathGeometry';
import { getCutoutBounds, cutoutFitsInMask, rectFitsInMask, type MaskCellSize } from './maskFit';
import type { Bounds } from './geometryCore';

/** Tolerance (mm) — mirrors the interaction clamps so a flush edge isn't flagged. */
const EPSILON = 0.01;

function boundsOutsideRect(b: Bounds, binWidth: number, binDepth: number): boolean {
  return (
    b.minX < -EPSILON ||
    b.minY < -EPSILON ||
    b.maxX > binWidth + EPSILON ||
    b.maxY > binDepth + EPSILON
  );
}

function unionBounds(boundsList: readonly Bounds[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boundsList) {
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { minX, minY, maxX, maxY };
}

/** True when any instance of the cutout falls outside the (optionally masked) board. */
export function isCutoutOffBoard(
  cutout: Cutout,
  binWidth: number,
  binDepth: number,
  mask?: CellMask,
  cellSize?: MaskCellSize
): boolean {
  const instances = expandCutoutArray(cutout);
  // Custom (masked) footprint: an instance inside the bounding rectangle can
  // still overhang the polygon, so defer to the containment check placements use.
  if (mask && cellSize) return instances.some((inst) => !cutoutFitsInMask(inst, mask, cellSize));
  return instances.some((inst) => boundsOutsideRect(getCutoutBounds(inst), binWidth, binDepth));
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

/** Translation that fits the instances' union within the board rectangle. */
function rectOffset(
  instanceBounds: readonly Bounds[],
  binWidth: number,
  binDepth: number
): { dx: number; dy: number } {
  const u = unionBounds(instanceBounds);
  return { dx: fitAxis(u.minX, u.maxX, binWidth), dy: fitAxis(u.minY, u.maxY, binDepth) };
}

/**
 * Nearest cell-aligned translation that fits every instance within the filled
 * mask region. Returns `null` when no such placement exists (e.g. the footprint
 * is larger than any filled run). Candidates align the instances' union min
 * corner to each mask cell, so a valid run is found whenever one exists.
 */
function maskOffset(
  instanceBounds: readonly Bounds[],
  mask: CellMask,
  cellSize: MaskCellSize
): { dx: number; dy: number } | null {
  const u = unionBounds(instanceBounds);
  let best: { dx: number; dy: number } | null = null;
  let bestDist = Infinity;
  // Min-corner candidates only need cells [0, cols)×[0, rows): aligning the
  // corner to the far boundary always overhangs (rectFitsInMask rejects it).
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const dx = c * cellSize.cellMmX - u.minX;
      const dy = r * cellSize.cellMmY - u.minY;
      const fits = instanceBounds.every((b) =>
        rectFitsInMask(mask, b.minX + dx, b.minY + dy, b.maxX - b.minX, b.maxY - b.minY, cellSize)
      );
      if (!fits) continue;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = { dx, dy };
        bestDist = dist;
      }
    }
  }
  return best;
}

/**
 * Translation that brings a stray cutout (and all its array instances) back
 * inside the board. Returns `null` when no move is needed or — for a masked
 * footprint — no valid placement exists (the cutout stays flagged for manual
 * repair). Path vertices move in lockstep with `x`/`y`.
 */
export function clampCutoutToBoard(
  cutout: Cutout,
  binWidth: number,
  binDepth: number,
  mask?: CellMask,
  cellSize?: MaskCellSize
): Partial<Cutout> | null {
  const instanceBounds = expandCutoutArray(cutout).map(getCutoutBounds);
  const offset =
    mask && cellSize
      ? maskOffset(instanceBounds, mask, cellSize)
      : rectOffset(instanceBounds, binWidth, binDepth);
  if (!offset) return null;
  const { dx, dy } = offset;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return null;
  const moved: Partial<Cutout> = { x: cutout.x + dx, y: cutout.y + dy };
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
    const moved = clampCutoutToBoard(c, binWidth, binDepth, mask, cellSize);
    if (moved) updates.set(c.id, moved);
  }
  return updates;
}
