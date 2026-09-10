/** Compartment cavity outlines: bounds, corner treatment and the drawings the pocket cut consumes. */

import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import type { BinParams, DividerOverride } from '@/shared/types/bin';
// Pure grid helpers, kept in the compartment-grid util so the main thread can
// reach them too — the lid's click rails notch around the same runs
// and cannot import this module, which pulls in brepjs.
import { buildOverrideLookup, overrideKey } from '@/shared/types/bin';

import { BOX_CORNER_RADIUS } from './generatorConstants';

interface CavityCorners {
  bl: [number, number];
  br: [number, number];
  tr: [number, number];
  tl: [number, number];
  /**
   * Whether each corner sits on the bin perimeter (both adjacent edges are
   * exterior). Only these corners get rounded; interior corners are divider
   * junctions and stay sharp.
   */
  exterior: { bl: boolean; br: boolean; tr: boolean; tl: boolean };
}

/**
 * Build per-compartment cavity drawings (rectangular footprints in the XY
 * plane) used to subtract cavities from the bin's outer extrusion, producing
 * the divider walls as natural cut residue between compartments.
 *
 * Each cavity rectangle spans the compartment's cell bounding box, inset by
 * `thickness/2` on every shared internal boundary (so adjacent compartments
 * leave `thickness` of wall between them) and aligned flush with the bin's
 * inner wall surface on each exterior boundary.
 *
 * Corners that sit on the bin perimeter are rounded with the same radius the
 * single-compartment hollow shell uses (`BOX_CORNER_RADIUS − wallThickness`)
 * so the cavity follows the rounded inner wall contour. Without this, a sharp
 * cavity corner pokes past the outer rounded arc on thin-walled bins
 * (`wallThickness < BOX_CORNER_RADIUS·(1 − 1/√2) ≈ 1.1mm`) and the cut eats
 * through the outer skin, leaving a gap in the bin's corners.
 *
 * Non-rectangular compartments (cells with the same ID forming an L-shape,
 * etc.) are approximated by their bounding box; multi-cavity cut is therefore
 * only safe for compartments that fill their bounding box. Callers should
 * verify via `compartmentsAreRectangular` before using this path.
 */
export function buildCompartmentCavityDrawings(
  params: BinParams,
  innerW: number,
  innerD: number
): readonly Drawing[] {
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  const cornerRadius = Math.max(BOX_CORNER_RADIUS - params.wallThickness, 0);
  const drawings: Drawing[] = [];
  for (const id of new Set(params.compartments.cells)) {
    const corners = cavityCorners(params, innerW, innerD, id, lookup);
    if (!corners) continue;
    drawings.push(cavityDrawing(corners, cornerRadius));
  }
  return drawings;
}

/**
 * Build a cavity drawing, rounding each corner that lies on the bin
 * perimeter with `cornerRadius` (clamped to the cavity's own dimensions so
 * the fillet always fits). Interior corners — divider junctions — stay sharp.
 */
function cavityDrawing(corners: CavityCorners, cornerRadius: number): Drawing {
  const { bl, br, tr, tl, exterior } = corners;
  // Cap the radius at half the smaller span so opposing fillets can't overrun.
  const { cavW, cavD } = cavitySpan(corners);
  const r = Math.max(0, Math.min(cornerRadius, cavW / 2 - 0.05, cavD / 2 - 0.05));
  const rBL = exterior.bl ? r : 0;
  const rBR = exterior.br ? r : 0;
  const rTR = exterior.tr ? r : 0;
  const rTL = exterior.tl ? r : 0;

  if (r <= 0.1 || !hasExteriorCorner(exterior)) {
    return draw(bl).lineTo(br).lineTo(tr).lineTo(tl).close();
  }

  // Start at the midpoint of BL→BR so close() forms a real edge through BL,
  // letting customCorner(rBL) apply to it (mirrors buildSlabProfile in
  // baseplateSlab.ts). Starting at a corner would make close() degenerate.
  // Use the true midpoint (not [mid_x, bl[1]]): an override can tilt the
  // bottom edge (bl[1] !== br[1]), and the start point must stay on it.
  let pen = draw([(bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2]);
  pen = pen.lineTo(br);
  if (rBR > 0) pen = pen.customCorner(rBR);
  pen = pen.lineTo(tr);
  if (rTR > 0) pen = pen.customCorner(rTR);
  pen = pen.lineTo(tl);
  if (rTL > 0) pen = pen.customCorner(rTL);
  pen = pen.lineTo(bl);
  if (rBL > 0) pen = pen.customCorner(rBL);
  return pen.close();
}

/** Whether any cavity corner sits on the bin perimeter (and so gets rounded). */
function hasExteriorCorner(exterior: CavityCorners['exterior']): boolean {
  return exterior.bl || exterior.br || exterior.tr || exterior.tl;
}

/**
 * Width and depth of a cavity, taken as the smaller of each pair of opposing
 * edges so override displacement can't inflate the span used for fillet
 * clamping or clearance checks.
 */
function cavitySpan(corners: CavityCorners): { cavW: number; cavD: number } {
  const { bl, br, tr, tl } = corners;
  return {
    cavW: Math.min(br[0] - bl[0], tr[0] - tl[0]),
    cavD: Math.min(tl[1] - bl[1], tr[1] - br[1]),
  };
}

/**
 * Cavity corners with shared-edge overrides applied. Sign convention
 * mirrors `buildTiltedWallSegment`: `offsetStart` shifts the lower-
 * coordinate endpoint, `offsetEnd` the higher-coordinate one. Both
 * compartments either side of a divider apply the same offsets so the
 * centerline displaces consistently and each side keeps its `half` inset.
 */
function cavityCorners(
  params: BinParams,
  innerW: number,
  innerD: number,
  id: number,
  lookup: Map<string, DividerOverride>
): CavityCorners | null {
  const { cols, rows, thickness, cells } = params.compartments;
  const bounds = findCompartmentBounds(id, cols, rows, cells);
  if (!bounds) return null;
  const { minCol, maxCol, minRow, maxRow } = bounds;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const half = thickness / 2;
  const xMin = -innerW / 2 + minCol * cellW + (minCol > 0 ? half : 0);
  const xMax = -innerW / 2 + (maxCol + 1) * cellW - (maxCol < cols - 1 ? half : 0);
  const yMin = -innerD / 2 + minRow * cellD + (minRow > 0 ? half : 0);
  const yMax = -innerD / 2 + (maxRow + 1) * cellD - (maxRow < rows - 1 ? half : 0);
  const bl: [number, number] = [xMin, yMin];
  const br: [number, number] = [xMax, yMin];
  const tr: [number, number] = [xMax, yMax];
  const tl: [number, number] = [xMin, yMax];
  // A corner is on the bin perimeter when both of its edges are exterior.
  // Override displacement only touches interior edges, so exterior corners
  // are never shifted (safe to round).
  const left = minCol === 0;
  const right = maxCol === cols - 1;
  const front = minRow === 0;
  const back = maxRow === rows - 1;
  const exterior = {
    bl: left && front,
    br: right && front,
    tr: right && back,
    tl: left && back,
  };
  if (maxCol < cols - 1) {
    const ov = lookup.get(overrideKey(id, cells[minRow * cols + (maxCol + 1)]));
    if (ov) {
      br[0] += ov.offsetStart;
      tr[0] += ov.offsetEnd;
    }
  }
  if (minCol > 0) {
    const ov = lookup.get(overrideKey(id, cells[minRow * cols + (minCol - 1)]));
    if (ov) {
      bl[0] += ov.offsetStart;
      tl[0] += ov.offsetEnd;
    }
  }
  if (maxRow < rows - 1) {
    const ov = lookup.get(overrideKey(id, cells[(maxRow + 1) * cols + minCol]));
    if (ov) {
      tl[1] += ov.offsetStart;
      tr[1] += ov.offsetEnd;
    }
  }
  if (minRow > 0) {
    const ov = lookup.get(overrideKey(id, cells[(minRow - 1) * cols + minCol]));
    if (ov) {
      bl[1] += ov.offsetStart;
      br[1] += ov.offsetEnd;
    }
  }
  return { bl, br, tr, tl, exterior };
}

/**
 * Find the bounding row/column range of a compartment by its ID.
 * Returns null if the compartment ID is not found in the grid.
 */
export function findCompartmentBounds(
  compId: number,
  cols: number,
  rows: number,
  cells: readonly number[]
): { minCol: number; maxCol: number; minRow: number; maxRow: number } | null {
  let minCol = cols;
  let maxCol = -1;
  let minRow = rows;
  let maxRow = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r * cols + c] === compId) {
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
      }
    }
  }
  if (maxCol === -1) return null;
  return { minCol, maxCol, minRow, maxRow };
}

/**
 * Whether every bin-perimeter cavity corner can be rounded with the full
 * inner-shell radius (`BOX_CORNER_RADIUS − wallThickness`). On thin walls a
 * corner compartment narrower than twice that radius can only be partially
 * rounded, so its sharp residue still pokes past the outer arc and reopens
 * the corner gap — such bins must fall back to the additive-fuse path
 * (whose rounded hollow shell has no corner gap). Thick-walled bins are
 * always safe: a sharp cavity corner never reaches past the arc, so cell
 * size is irrelevant.
 */
export function compartmentCornersRoundCleanly(
  params: BinParams,
  innerW: number,
  innerD: number
): boolean {
  const targetR = BOX_CORNER_RADIUS - params.wallThickness;
  // Sharp corners only over-cut below BOX_CORNER_RADIUS·(1 − 1/√2); above
  // that threshold there is no gap to fix regardless of compartment size.
  if (targetR <= BOX_CORNER_RADIUS / Math.SQRT2) return true;
  const need = 2 * targetR;
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  for (const id of new Set(params.compartments.cells)) {
    const corners = cavityCorners(params, innerW, innerD, id, lookup);
    if (!corners) continue;
    if (!hasExteriorCorner(corners.exterior)) continue;
    const { cavW, cavD } = cavitySpan(corners);
    if (cavW < need || cavD < need) return false;
  }
  return true;
}

/**
 * Verify every override-displaced cavity remains a non-degenerate quad
 * (left strictly left of right, bottom strictly below top, with at least
 * `thickness * 2` clearance). Extreme offsets can otherwise produce a
 * self-intersecting bowtie that BREP silently drops; falling back to the
 * additive-fuse path lets that path's clip-to-interior salvage *some*
 * mesh for pathological inputs.
 */
export function compartmentCavitiesAreViableWithOverrides(
  params: BinParams,
  innerW: number,
  innerD: number
): boolean {
  const overrides = params.compartments.dividerOverrides;
  if (!overrides || overrides.length === 0) return true;
  const lookup = buildOverrideLookup(overrides);
  const minDim = params.compartments.thickness * 2;
  for (const id of new Set(params.compartments.cells)) {
    const corners = cavityCorners(params, innerW, innerD, id, lookup);
    if (!corners) continue;
    const { bl, br, tr, tl } = corners;
    if (Math.min(br[0], tr[0]) - Math.max(bl[0], tl[0]) < minDim) return false;
    if (Math.min(tl[1], tr[1]) - Math.max(bl[1], br[1]) < minDim) return false;
  }
  return true;
}
