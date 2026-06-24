/**
 * Compartment divider wall builder for Gridfinity bins.
 *
 * Generates internal walls between compartments based on the compartment grid.
 * Walls appear at boundaries between cells with different compartment IDs.
 */

import { box, withScope, clone, unwrap, fuseAll, draw, intersect } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope, Drawing } from 'brepjs';
import type { BinParams, DividerOverride } from '@/shared/types/bin';
import { buildCacheKey, compactKey, quantize, stableSerialize } from './cacheKeyUtils';
import { sketch } from './meshUtils';
import { BOX_CORNER_RADIUS } from './generatorConstants';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';

// Re-export for backwards compatibility with existing imports
export { fuseAllOrNull } from './utils/shapeOps';

/**
 * Whether the bin's compartments produce internal divider walls (>1 distinct
 * compartment ID). Single-compartment bins (`cells: [0]` or all identical)
 * don't need walls — the inner cavity is a single region.
 */
export function hasMultipleCompartments(params: BinParams): boolean {
  const { cells } = params.compartments;
  if (cells.length === 0) return false;
  return new Set(cells).size > 1;
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
 * through the outer skin, leaving a gap in the bin's corners (#1968).
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

/** Whether any divider override is present in the compartment grid. */
export function hasDividerOverrides(params: BinParams): boolean {
  return (params.compartments.dividerOverrides?.length ?? 0) > 0;
}

/**
 * Cache-key segment for the per-compartment cavity layout. Shared by the
 * shell-cache (in context) and the per-box cavity cache (in shellStage) so
 * both invalidate together when overrides change.
 */
export function buildCompartmentsCacheKey(params: BinParams): string {
  return compactKey(
    buildCacheKey(
      'comp',
      params.compartments.cols,
      params.compartments.rows,
      quantize(params.compartments.thickness),
      params.compartments.cells.join(','),
      stableSerialize(params.compartments.dividerOverrides ?? []),
      // Cavity corner rounding depends on wallThickness.
      quantize(params.wallThickness)
    )
  );
}

/**
 * True iff every compartment's edges touch at most one distinct neighbor
 * compartment per edge. Required for the cut-path cavity drawer, which
 * emits quadrilaterals; multi-pair edges (a wide compartment with
 * different neighbors below each cell) would need a polyline edge and
 * fall back to the additive-fuse path.
 */
export function compartmentEdgesAreSinglePair(params: BinParams): boolean {
  const { cols, rows, cells } = params.compartments;
  const edgeIsSinglePair = (from: number, to: number, indexFn: (i: number) => number): boolean => {
    let first: number | null = null;
    for (let i = from; i <= to; i++) {
      const n = cells[indexFn(i)];
      if (first === null) first = n;
      else if (n !== first) return false;
    }
    return true;
  };
  for (const id of new Set(cells)) {
    const bounds = findCompartmentBounds(id, cols, rows, cells);
    if (!bounds) continue;
    const { minCol, maxCol, minRow, maxRow } = bounds;
    if (maxRow < rows - 1 && !edgeIsSinglePair(minCol, maxCol, (c) => (maxRow + 1) * cols + c))
      return false;
    if (minRow > 0 && !edgeIsSinglePair(minCol, maxCol, (c) => (minRow - 1) * cols + c))
      return false;
    if (maxCol < cols - 1 && !edgeIsSinglePair(minRow, maxRow, (r) => r * cols + (maxCol + 1)))
      return false;
    if (minCol > 0 && !edgeIsSinglePair(minRow, maxRow, (r) => r * cols + (minCol - 1)))
      return false;
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

/**
 * Whether every compartment is a rectangle (its cells fully fill its
 * bounding box). Required precondition for the multi-cavity-cut shell
 * path; non-rectangular compartments fall back to the additive-fuse path.
 */
export function compartmentsAreRectangular(params: BinParams): boolean {
  const { cols, rows, cells } = params.compartments;
  const compIds = new Set(cells);
  for (const id of compIds) {
    const bounds = findCompartmentBounds(id, cols, rows, cells);
    if (!bounds) continue;
    const { minCol, maxCol, minRow, maxRow } = bounds;
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (cells[r * cols + c] !== id) return false;
      }
    }
  }
  return true;
}

/**
 * Tight precondition check for the multi-cavity-cut shell path. Verifies
 * that every per-compartment cavity rectangle would have positive width and
 * depth after inset by `thickness/2` on shared boundaries. If any cavity
 * would collapse, the upstream cut would fail in OCCT — better to fall
 * through to the additive-fuse path now than crash buildBinBox later.
 */
export function compartmentCavitiesAreViable(
  params: BinParams,
  innerW: number,
  innerD: number
): boolean {
  if (innerW <= 0 || innerD <= 0) return false;
  const { cols, rows, thickness, cells } = params.compartments;
  if (cols < 1 || rows < 1 || cells.length !== cols * rows) return false;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const half = thickness / 2;
  // Minimum viable cavity dimension: 2× wall thickness so each compartment
  // still has usable interior after the inset (same heuristic the additive
  // path uses in `buildCompartmentWallsInScope`).
  const minDim = thickness * 2;
  const compIds = new Set(cells);
  for (const id of compIds) {
    const bounds = findCompartmentBounds(id, cols, rows, cells);
    if (!bounds) return false;
    const { minCol, maxCol, minRow, maxRow } = bounds;
    const compW =
      (maxCol - minCol + 1) * cellW - (minCol > 0 ? half : 0) - (maxCol < cols - 1 ? half : 0);
    const compD =
      (maxRow - minRow + 1) * cellD - (minRow > 0 ? half : 0) - (maxRow < rows - 1 ? half : 0);
    if (compW < minDim || compD < minDim) return false;
  }
  return true;
}

/**
 * Whether every bin-perimeter cavity corner can be rounded with the full
 * inner-shell radius (`BOX_CORNER_RADIUS − wallThickness`). On thin walls a
 * corner compartment narrower than twice that radius can only be partially
 * rounded, so its sharp residue still pokes past the outer arc and reopens
 * the #1968 corner gap — such bins must fall back to the additive-fuse path
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

/** Build a positioned wall segment solid. */
function buildWallSegment(w: number, d: number, height: number, x: number, y: number): Shape3D {
  return box(w, d, height, { at: [x, y, height / 2] });
}

/**
 * Build a tilted divider wall as a parallelogram prism whose long axis runs
 * from `(startX, startY)` to `(endX, endY)`. Thickness is applied
 * perpendicular to that axis (not world-aligned) so the divider looks like
 * a tilted ribbon, not a squished box.
 *
 * Clipped to the bin interior so any parallelogram corners that overshoot
 * the bin wall (which happens whenever the tilt is non-zero) are sliced
 * cleanly at the wall plane.
 */
function buildTiltedWallSegment(
  scope: DisposalScope,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  height: number,
  binInnerW: number,
  binInnerD: number
): Shape3D | null {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.hypot(dx, dy);
  // Degenerate-segment guard: a zero-length divider (both endpoints
  // collapsed to the same point — possible if a malformed override drives
  // a span to nothing) would divide by zero and produce NaN geometry.
  if (len < 1e-6) return null;
  // Perpendicular unit vector (rotated 90° CCW from the divider direction).
  const px = -dy / len;
  const py = dx / len;
  const half = thickness / 2;

  const pen = draw([startX + px * half, startY + py * half])
    .lineTo([endX + px * half, endY + py * half])
    .lineTo([endX - px * half, endY - py * half])
    .lineTo([startX - px * half, startY - py * half])
    .close();
  const prism = scope.register(sketch(pen, 'XY', 0).extrude(height));
  // Clip the parallelogram corners that overshoot the bin's perpendicular
  // wall. For zero-tilt segments the clip is a no-op; for tilted segments
  // it shears off the "ears" that would otherwise poke through the wall.
  // If the prism is entirely outside the clip box (override pushes the
  // divider beyond the bin interior), the intersect returns nothing — bail
  // gracefully rather than crashing the whole bin build.
  const clipBox = scope.register(box(binInnerW, binInnerD, height, { at: [0, 0, height / 2] }));
  try {
    return scope.register(unwrap(intersect(prism as ValidSolid, clipBox)));
  } catch {
    return null;
  }
}

/**
 * Walk a boundary line in single-cell steps and group contiguous cells where
 * `key(i)` returns the SAME non-null string into runs. Each emitted run has
 * a uniform `pairKey`. Used so the override lookup applies to runs that
 * actually correspond to one (compartmentA, compartmentB) pair — a longer
 * fused run that crosses pair changes would silently apply the first pair's
 * override to the entire wall.
 */
export function findPairAwareRuns(
  count: number,
  key: (i: number) => string | null
): Array<{ start: number; end: number; pairKey: string }> {
  const runs: Array<{ start: number; end: number; pairKey: string }> = [];
  // Carry start + key as a single nullable object so segStart and segKey can
  // never disagree (one set, the other still null). Prior shape stored them
  // separately and TypeScript couldn't prove the invariant; reviewers
  // flagged the `segKey ?? ''` fallback as either dead code or a silent
  // misroute waiting to happen.
  let open: { start: number; key: string } | null = null;
  for (let i = 0; i < count; i++) {
    const k = key(i);
    if (k === null) {
      if (open !== null) {
        runs.push({ start: open.start, end: i, pairKey: open.key });
        open = null;
      }
    } else if (open === null) {
      open = { start: i, key: k };
    } else if (k !== open.key) {
      runs.push({ start: open.start, end: i, pairKey: open.key });
      open = { start: i, key: k };
    }
  }
  if (open !== null) {
    runs.push({ start: open.start, end: count, pairKey: open.key });
  }
  return runs;
}

/** Canonical-pair key for an override lookup map. */
export function overrideKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildOverrideLookup(
  overrides: readonly DividerOverride[] | undefined
): Map<string, DividerOverride> {
  const lookup = new Map<string, DividerOverride>();
  if (!overrides) return lookup;
  for (const o of overrides) {
    lookup.set(overrideKey(o.compartmentA, o.compartmentB), o);
  }
  return lookup;
}

/** One interior divider wall segment, resolved to mm in bin-centered coords. */
export interface InteriorDividerSegment {
  /** Axis-projected segment length (mm) — not the longer true diagonal. */
  readonly segLen: number;
  /** True wall length along the (possibly tilted) segment — equals `segLen`
   *  for straight dividers, longer for tilted ones. Features that measure
   *  distance ALONG the wall (cutout width, alignment) must use this, not the
   *  projected `segLen`. */
  readonly wallLen: number;
  readonly x: number;
  readonly y: number;
  /** In-plane rotation (deg) aligned to the wall: 90 for straight vertical
   *  dividers, 0 for straight horizontal, tilted by the override otherwise. */
  readonly rotateZ: number;
}

/**
 * Enumerate every interior divider wall segment with its tilt-resolved
 * placement, honouring `dividerOverrides`. Shared source of truth so features
 * that decorate dividers (wall cutouts, handles) land ON the wall instead of at
 * the original grid line when a divider is tilted. Pure — no WASM.
 */
export function interiorDividerSegments(
  params: BinParams,
  innerW: number,
  innerD: number
): InteriorDividerSegment[] {
  const { cols, rows, cells } = params.compartments;
  const out: InteriorDividerSegment[] = [];
  if (cols <= 1 && rows <= 1) return out;

  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const lookup = buildOverrideLookup(params.compartments.dividerOverrides);
  const RAD2DEG = 180 / Math.PI;

  // Without overrides, merge contiguous wall cells into one run (historical
  // behavior — one window per span). Only split per compartment pair when tilts
  // exist, since each tilted pair is its own angled wall segment.
  const hasOverrides = lookup.size > 0;
  const runsFor = (
    count: number,
    pairOf: (i: number) => string | null
  ): Array<{ start: number; end: number; pairKey: string }> =>
    hasOverrides
      ? findPairAwareRuns(count, pairOf)
      : findWallSegments(count, (i) => pairOf(i) !== null).map(([start, end]) => ({
          start,
          end,
          pairKey: '',
        }));

  // Vertical dividers (between columns) run along Y; straight ⇒ rotateZ 90.
  for (let boundary = 1; boundary < cols; boundary++) {
    const xPos = -innerW / 2 + boundary * cellW;
    const runs = runsFor(rows, (row) => {
      const leftId = cells[row * cols + (boundary - 1)];
      const rightId = cells[row * cols + boundary];
      return leftId !== rightId ? overrideKey(leftId, rightId) : null;
    });
    for (const { start, end, pairKey } of runs) {
      const segLen = (end - start) * cellD;
      const midY = -innerD / 2 + (start + (end - start) / 2) * cellD;
      const ov = lookup.get(pairKey);
      out.push(
        ov
          ? {
              segLen,
              wallLen: Math.hypot(segLen, ov.offsetEnd - ov.offsetStart),
              x: xPos + (ov.offsetStart + ov.offsetEnd) / 2,
              y: midY,
              rotateZ: Math.atan2(segLen, ov.offsetEnd - ov.offsetStart) * RAD2DEG,
            }
          : { segLen, wallLen: segLen, x: xPos, y: midY, rotateZ: 90 }
      );
    }
  }

  // Horizontal dividers (between rows) run along X; straight ⇒ rotateZ 0.
  for (let boundary = 1; boundary < rows; boundary++) {
    const yPos = -innerD / 2 + boundary * cellD;
    const runs = runsFor(cols, (col) => {
      const topId = cells[(boundary - 1) * cols + col];
      const bottomId = cells[boundary * cols + col];
      return topId !== bottomId ? overrideKey(topId, bottomId) : null;
    });
    for (const { start, end, pairKey } of runs) {
      const segLen = (end - start) * cellW;
      const midX = -innerW / 2 + (start + (end - start) / 2) * cellW;
      const ov = lookup.get(pairKey);
      out.push(
        ov
          ? {
              segLen,
              wallLen: Math.hypot(segLen, ov.offsetEnd - ov.offsetStart),
              x: midX,
              y: yPos + (ov.offsetStart + ov.offsetEnd) / 2,
              rotateZ: Math.atan2(ov.offsetEnd - ov.offsetStart, segLen) * RAD2DEG,
            }
          : { segLen, wallLen: segLen, x: midX, y: yPos, rotateZ: 0 }
      );
    }
  }
  return out;
}

/**
 * Find consecutive wall segments along a boundary line.
 * Returns array of [start, end) index pairs where walls are needed.
 */
export function findWallSegments(
  count: number,
  needsWall: (i: number) => boolean
): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let segStart: number | null = null;

  for (let i = 0; i < count; i++) {
    if (needsWall(i)) {
      if (segStart === null) segStart = i;
    } else if (segStart !== null) {
      segments.push([segStart, i]);
      segStart = null;
    }
  }
  if (segStart !== null) {
    segments.push([segStart, count]);
  }
  return segments;
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
 * Build compartment divider walls inside the bin.
 *
 * Uses the compartment grid to derive wall segments: walls appear at
 * boundaries between cells with different compartment IDs. This supports
 * non-uniform compartment layouts (merged cells have no wall between them).
 *
 * Positioned from Z=0 (floor) to Z=wallHeight.
 */
export function buildCompartmentWalls(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  const { cols, rows, cells } = params.compartments;

  // Single compartment = no walls needed
  if (cols <= 1 && rows <= 1) return null;
  if (new Set(cells).size <= 1) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildCompartmentWallsInScope(scope, params, innerW, innerD, wallHeight);
    return fused ? unwrap(clone(fused)) : null;
  });
}

function buildCompartmentWallsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  const { cols, rows, thickness, cells } = params.compartments;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Effective free space per cell after accounting for internal divider thickness
  const effectiveCellW = (innerW - (cols - 1) * thickness) / cols;
  const effectiveCellD = (innerD - (rows - 1) * thickness) / rows;

  // Safety net: skip wall generation if cells are too small for viable geometry
  if (effectiveCellW < thickness * 2 || effectiveCellD < thickness * 2) return null;

  const wallSegments: Shape3D[] = [];
  const overrideLookup = buildOverrideLookup(params.compartments.dividerOverrides);

  // Vertical walls: between column boundaries. We split runs not just by
  // "needs wall" but also by the (leftId, rightId) pair — otherwise a single
  // segment that spans multiple compartment pairs (e.g. col-boundary in a
  // 2×2 grid runs through pair 0|1 then 2|3) would only check the first
  // pair's override and apply it to the whole run, producing wrong geometry.
  // Touching axis-aligned boxes fuse cleanly in OCCT so the split is
  // visually transparent for non-tilted segments.
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const xPos = -innerW / 2 + colBoundary * cellW;
    const runs = findPairAwareRuns(rows, (row) => {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      return leftId !== rightId ? overrideKey(leftId, rightId) : null;
    });

    for (const { start, end, pairKey } of runs) {
      const override = overrideLookup.get(pairKey);
      if (override) {
        // Tilted: endpoints shifted in ±X. start = front edge (y = startY),
        // end = back edge (y = endY).
        const startY = -innerD / 2 + start * cellD;
        const endY = -innerD / 2 + end * cellD;
        const tilted = buildTiltedWallSegment(
          scope,
          xPos + override.offsetStart,
          startY,
          xPos + override.offsetEnd,
          endY,
          thickness,
          wallHeight,
          innerW,
          innerD
        );
        if (tilted) wallSegments.push(tilted);
      } else {
        const segLength = (end - start) * cellD;
        const yCenter = -innerD / 2 + (start + (end - start) / 2) * cellD;
        wallSegments.push(
          scope.register(buildWallSegment(thickness, segLength, wallHeight, xPos, yCenter))
        );
      }
    }
  }

  // Horizontal walls: between row boundaries (same pair-aware split as above).
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const yPos = -innerD / 2 + rowBoundary * cellD;
    const runs = findPairAwareRuns(cols, (col) => {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      return topId !== bottomId ? overrideKey(topId, bottomId) : null;
    });

    for (const { start, end, pairKey } of runs) {
      const override = overrideLookup.get(pairKey);
      if (override) {
        // Tilted: endpoints shifted in ±Y. start = left edge (x = startX),
        // end = right edge (x = endX).
        const startX = -innerW / 2 + start * cellW;
        const endX = -innerW / 2 + end * cellW;
        const tilted = buildTiltedWallSegment(
          scope,
          startX,
          yPos + override.offsetStart,
          endX,
          yPos + override.offsetEnd,
          thickness,
          wallHeight,
          innerW,
          innerD
        );
        if (tilted) wallSegments.push(tilted);
      } else {
        const segLength = (end - start) * cellW;
        const xCenter = -innerW / 2 + (start + (end - start) / 2) * cellW;
        wallSegments.push(
          scope.register(buildWallSegment(segLength, thickness, wallHeight, xCenter, yPos))
        );
      }
    }
  }

  if (wallSegments.length === 0) return null;
  if (wallSegments.length === 1) return wallSegments[0];
  return scope.register(unwrap(fuseAll(wallSegments as ValidSolid[])));
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';

export const compartmentWallsFeature: FeatureBuilder = {
  name: 'compartmentWalls',
  tag: FeatureTag.DIVIDER,
  target: 'fuse',
  // Skip when walls are already in the shell (multi-cavity cut path, #1753).
  shouldBuild: (ctx) => !ctx.dimensions.isSlotted && !ctx.dimensions.compartmentsBakedIntoShell,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v2',
        dim.shellKey,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        params.compartments.cols,
        params.compartments.rows,
        quantize(params.compartments.thickness),
        params.compartments.cells.join(','),
        stableSerialize(params.compartments.dividerOverrides ?? []),
        quantize(
          resolveCompartmentDividerHeight(params.compartments.dividerHeight, dim.interiorHeight)
        )
      )
    );
  },
  build: (ctx) => {
    const result = buildCompartmentWalls(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      resolveCompartmentDividerHeight(
        ctx.params.compartments.dividerHeight,
        ctx.dimensions.interiorHeight
      )
    );
    return result ? [result] : null;
  },
};
