/**
 * Detection + recovery for cutouts the generator will clip.
 *
 * Cutouts are stored in absolute mm and are never auto-rescaled when the board
 * changes, so shrinking the footprint can strand one past the edge. The builder
 * silently clips whatever overhangs, so the editor surfaces it instead: flag the
 * strays and offer a one-click move back in.
 *
 * A board comes in three shapes, and all three are the same question — is any
 * part of this shape somewhere the cut will not reach:
 *
 * - a plain rectangle (the bin's interior),
 * - a cell mask (a custom bin outline), where a bounding box is a fast accept
 *   only, since an L-shaped cutout nested in an L-shaped bin has a box that
 *   spans the notch (`maskFit`),
 * - the lid's window (`lidWindowFit`), a ROUNDED rectangle with a keep-out disc
 *   at each retention magnet. A hole over a boss opens its magnet pocket, which
 *   is invisible to any check on the lid alone: the solid stays watertight, the
 *   lid just stops holding the bin.
 *
 * A cutout is treated as its set of expanded array instances (just itself when
 * there is no array), so an array whose outer instances spill past the edge is
 * flagged even when the master fits.
 */

import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import type { CellMask } from '@/shared/utils/cellMask';
import type { LidCutoutWindow } from '@/shared/utils/lidCutoutPlan';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { translateCutout } from './cutoutHelpers';
import { translatePathPoints } from './pathGeometry';
import { getCutoutBounds, cutoutFitsInMask, type MaskCellSize } from './maskFit';
import { cutoutFitsInLidWindow, lidWindowOffset } from './lidWindowFit';
import type { Bounds } from './geometryCore';

/**
 * The area a cutout may occupy.
 *
 * `lidWindow` wins when present and carries its own spans, so `width`/`depth`
 * are the plain-rectangle fallback rather than a second description of the same
 * area that could disagree with it.
 */
export interface CutoutBoard {
  readonly width: number;
  readonly depth: number;
  readonly mask?: CellMask;
  readonly cellSize?: MaskCellSize;
  readonly lidWindow?: LidCutoutWindow;
  readonly meshAssets?: Readonly<Record<string, MeshAsset>>;
}

/**
 * Tolerance (mm) — mirrors the interaction clamps so a flush edge isn't flagged.
 * Exported because `growBinToFit` must size against the same tolerance: if the
 * two drift, a grow can return a bin that still leaves the warning up.
 */
export const OFF_BOARD_EPSILON = 0.01;
const EPSILON = OFF_BOARD_EPSILON;

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

/** Whether one instance sits entirely inside the board. */
function instanceFits(inst: Cutout, board: CutoutBoard): boolean {
  if (board.lidWindow) {
    return cutoutFitsInLidWindow(inst, board.lidWindow, board.meshAssets);
  }
  if (board.mask && board.cellSize) {
    return cutoutFitsInMask(inst, board.mask, board.cellSize, board.meshAssets);
  }
  return !boundsOutsideRect(getCutoutBounds(inst), board.width, board.depth);
}

/** True when any instance of the cutout falls outside the board. */
export function isCutoutOffBoard(cutout: Cutout, board: CutoutBoard): boolean {
  return expandCutoutArray(cutout).some((inst) => !instanceFits(inst, board));
}

/** Ids of every cutout the generator would clip on the current board. */
export function getOffBoardCutoutIds(cutouts: readonly Cutout[], board: CutoutBoard): Set<string> {
  const ids = new Set<string>();
  for (const c of cutouts) {
    if (isCutoutOffBoard(c, board)) ids.add(c.id);
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
  instances: readonly Cutout[],
  mask: CellMask,
  cellSize: MaskCellSize,
  meshAssets: Readonly<Record<string, MeshAsset>> | undefined
): { dx: number; dy: number } | null {
  const u = unionBounds(instances.map(getCutoutBounds));
  let best: { dx: number; dy: number } | null = null;
  let bestDist = Infinity;
  // Min-corner candidates only need cells [0, cols)×[0, rows): aligning the
  // corner to the far boundary always overhangs (cutoutFitsInMask rejects it).
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const dx = c * cellSize.cellMmX - u.minX;
      const dy = r * cellSize.cellMmY - u.minY;
      const dist = dx * dx + dy * dy;
      // Containment is the expensive half of this scan, so skip candidates that
      // can't beat the incumbent before testing them.
      if (dist >= bestDist) continue;
      const fits = instances.every((inst) =>
        cutoutFitsInMask(translateCutout(inst, dx, dy), mask, cellSize, meshAssets)
      );
      if (!fits) continue;
      best = { dx, dy };
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Translation that brings a stray cutout (and all its array instances) back
 * inside the board. Returns `null` when no move is needed or — for a masked or
 * lid board — no valid placement exists (the cutout stays flagged for manual
 * repair). Path vertices move in lockstep with `x`/`y`.
 */
export function clampCutoutToBoard(cutout: Cutout, board: CutoutBoard): Partial<Cutout> | null {
  const instances = expandCutoutArray(cutout);
  let offset: { dx: number; dy: number } | null;
  if (board.lidWindow) {
    offset = lidWindowOffset(instances, board.lidWindow, board.meshAssets);
  } else if (board.mask && board.cellSize) {
    offset = maskOffset(instances, board.mask, board.cellSize, board.meshAssets);
  } else {
    offset = rectOffset(instances.map(getCutoutBounds), board.width, board.depth);
  }
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
  board: CutoutBoard
): Map<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  for (const c of cutouts) {
    if (!isCutoutOffBoard(c, board)) continue;
    const moved = clampCutoutToBoard(c, board);
    if (moved) updates.set(c.id, moved);
  }
  return updates;
}
