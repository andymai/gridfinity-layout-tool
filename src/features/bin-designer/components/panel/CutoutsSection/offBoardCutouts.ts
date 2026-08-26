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
import { MIN_CUTOUT_SIZE } from './geometryResize';
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
  // Still larger than the board after any shrink (a path, a mesh, an array
  // whose pitch alone overspans) — both edges can't fit, so anchor the min
  // edge to the origin and let the build clip the overhang on the far side.
  if (max - min > extent) return -min;
  if (min < 0) return -min;
  if (max > extent) return extent - max;
  return 0;
}

/**
 * Width/depth that let the cutout's rotated footprint — and every array
 * instance — fit a `binWidth`×`binDepth` rectangle. `null` when no resize is
 * needed or none would help: paths and meshes aren't sized by width/depth (a
 * path's vertices are the truth, a mesh mirrors its STL and can't resize), and
 * a shrink that still can't fit (min-size floor, array pitch overspanning the
 * board) is withheld rather than mangling the shape without clearing the flag.
 *
 * Axis-aligned rotations clamp each axis independently; oblique ones scale
 * uniformly, since per-axis shrinking of a rotated box couples the axes.
 */
function shrinkToFitRect(
  cutout: Cutout,
  binWidth: number,
  binDepth: number
): Pick<Cutout, 'width' | 'depth'> | null {
  if (cutout.shape === 'path' || cutout.shape === 'mesh' || cutout.shape === 'text') return null;
  const own = getCutoutBounds(cutout);
  const ownW = own.maxX - own.minX;
  const ownD = own.maxY - own.minY;
  let availX = binWidth;
  let availY = binDepth;
  const instances = expandCutoutArray(cutout);
  if (instances.length > 1) {
    const u = unionBounds(instances.map(getCutoutBounds));
    availX -= u.maxX - u.minX - ownW;
    availY -= u.maxY - u.minY - ownD;
  }
  if (ownW <= availX + EPSILON && ownD <= availY + EPSILON) return null;
  const rad = (cutout.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  let width: number;
  let depth: number;
  if (sin < 1e-9) {
    width = Math.min(cutout.width, availX);
    depth = Math.min(cutout.depth, availY);
  } else if (cos < 1e-9) {
    width = Math.min(cutout.width, availY);
    depth = Math.min(cutout.depth, availX);
  } else {
    const scale = Math.min(availX / ownW, availY / ownD);
    width = cutout.width * scale;
    depth = cutout.depth * scale;
  }
  width = Math.max(MIN_CUTOUT_SIZE, width);
  depth = Math.max(MIN_CUTOUT_SIZE, depth);
  const shrunk = getCutoutBounds({ ...cutout, width, depth });
  if (
    shrunk.maxX - shrunk.minX > availX + EPSILON ||
    shrunk.maxY - shrunk.minY > availY + EPSILON
  ) {
    return null;
  }
  return { width, depth };
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
 * Update that brings a stray cutout (and all its array instances) back inside
 * the board. On a plain rectangular board a shape larger than the board is
 * first shrunk to fit (`shrinkToFitRect`); a masked or lid board only ever
 * translates, since "fits somewhere in a concave region" has no single right
 * size. Returns `null` when no change is needed or no fix exists (the cutout
 * stays flagged for manual repair). Path vertices move in lockstep with
 * `x`/`y`.
 */
export function clampCutoutToBoard(cutout: Cutout, board: CutoutBoard): Partial<Cutout> | null {
  const plainRect = !board.lidWindow && !(board.mask && board.cellSize);
  const resized = plainRect ? shrinkToFitRect(cutout, board.width, board.depth) : null;
  const base = resized ? { ...cutout, ...resized } : cutout;
  const instances = expandCutoutArray(base);
  let offset: { dx: number; dy: number } | null;
  if (board.lidWindow) {
    offset = lidWindowOffset(instances, board.lidWindow, board.meshAssets);
  } else if (board.mask && board.cellSize) {
    offset = maskOffset(instances, board.mask, board.cellSize, board.meshAssets);
  } else {
    offset = rectOffset(instances.map(getCutoutBounds), board.width, board.depth);
  }
  if (!offset) return resized;
  const { dx, dy } = offset;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return resized;
  const moved: Partial<Cutout> = { ...resized, x: base.x + dx, y: base.y + dy };
  if (base.shape === 'path' && base.path) {
    return { ...moved, path: translatePathPoints(base.path, dx, dy) };
  }
  return moved;
}

/**
 * Updates that center every off-board cutout on the board AS ONE BLOCK, or an
 * empty map when doing so would not clear the warning.
 *
 * The companion to the clamp for the case that produces most strays: a shape
 * drawn at default size, then given its real dimensions, hangs off an edge
 * while fitting the board perfectly well. The clamp slides it to the nearest
 * edge; this puts it where it was going to be dragged anyway.
 *
 * One delta for the whole stray set, so strays the user arranged relative to
 * each other keep that arrangement, and cutouts already on the board are never
 * touched — this fixes the strays, it does not re-lay-out the design.
 *
 * All or nothing: a centering that rescues some strays and leaves others
 * flagged would move the user's shapes and keep the warning up, so the caller
 * hides the action instead. That also covers the boards where "centered" is not
 * a meaningful answer — a cell mask or a lid window, where the middle of the
 * bounding rectangle can be a notch or a magnet boss.
 */
export function centerOffBoardCutouts(
  cutouts: readonly Cutout[],
  board: CutoutBoard,
  offBoardIds: ReadonlySet<string> = getOffBoardCutoutIds(cutouts, board)
): Map<string, Partial<Cutout>> {
  const empty = new Map<string, Partial<Cutout>>();
  const strays = cutouts.filter((c) => offBoardIds.has(c.id));
  if (strays.length === 0) return empty;

  let group: Bounds | null = null;
  for (const c of strays) {
    for (const inst of expandCutoutArray(c)) {
      const b = getCutoutBounds(inst);
      group = group
        ? {
            minX: Math.min(group.minX, b.minX),
            minY: Math.min(group.minY, b.minY),
            maxX: Math.max(group.maxX, b.maxX),
            maxY: Math.max(group.maxY, b.maxY),
          }
        : b;
    }
  }
  if (!group) return empty;

  const dx = (board.width - (group.maxX - group.minX)) / 2 - group.minX;
  const dy = (board.depth - (group.maxY - group.minY)) / 2 - group.minY;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return empty;

  const updates = new Map<string, Partial<Cutout>>();
  for (const c of strays) {
    const moved = translateCutout(c, dx, dy);
    if (isCutoutOffBoard(moved, board)) return empty;
    updates.set(c.id, {
      x: moved.x,
      y: moved.y,
      ...(moved.path ? { path: moved.path } : {}),
    });
  }
  return updates;
}

/**
 * Updates for every off-board cutout that a clamp can fix (empty when none).
 * A patch that would still leave the shape off board — an oversized path or
 * mesh pulled to the origin but overhanging the far edge — is withheld, so an
 * offered clamp always clears the warning for the cutouts it touches.
 *
 * `offBoardIds` lets a caller that already ran the detection scan hand it in
 * rather than pay for a second pass over every cutout.
 */
export function clampOffBoardCutouts(
  cutouts: readonly Cutout[],
  board: CutoutBoard,
  offBoardIds: ReadonlySet<string> = getOffBoardCutoutIds(cutouts, board)
): Map<string, Partial<Cutout>> {
  const updates = new Map<string, Partial<Cutout>>();
  for (const c of cutouts) {
    if (!offBoardIds.has(c.id)) continue;
    const moved = clampCutoutToBoard(c, board);
    if (moved && !isCutoutOffBoard({ ...c, ...moved }, board)) updates.set(c.id, moved);
  }
  return updates;
}
