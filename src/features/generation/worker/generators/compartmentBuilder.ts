/**
 * Compartment divider wall builder for Gridfinity bins.
 *
 * Generates internal walls between compartments based on the compartment grid.
 * Walls appear at boundaries between cells with different compartment IDs.
 */

import { box, withScope, clone, unwrap, fuseAll, draw, intersect } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope, Drawing } from 'brepjs';
import type { BinParams, DividerOverride } from '@/shared/types/bin';
import { sketch } from './meshUtils';

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
  const { cols, rows, thickness, cells } = params.compartments;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const half = thickness / 2;

  const compIds = Array.from(new Set(cells));
  const drawings: Drawing[] = [];

  for (const id of compIds) {
    const bounds = findCompartmentBounds(id, cols, rows, cells);
    if (!bounds) continue;
    const { minCol, maxCol, minRow, maxRow } = bounds;

    // Cavity rectangle in the bin's inner frame (origin at center of inner cavity)
    const xMin = -innerW / 2 + minCol * cellW + (minCol > 0 ? half : 0);
    const xMax = -innerW / 2 + (maxCol + 1) * cellW - (maxCol < cols - 1 ? half : 0);
    const yMin = -innerD / 2 + minRow * cellD + (minRow > 0 ? half : 0);
    const yMax = -innerD / 2 + (maxRow + 1) * cellD - (maxRow < rows - 1 ? half : 0);

    drawings.push(
      draw([xMin, yMin]).lineTo([xMax, yMin]).lineTo([xMax, yMax]).lineTo([xMin, yMax]).close()
    );
  }

  return drawings;
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
function findPairAwareRuns(
  count: number,
  key: (i: number) => string | null
): Array<{ start: number; end: number; pairKey: string }> {
  const runs: Array<{ start: number; end: number; pairKey: string }> = [];
  // Carry start + key as a single nullable tuple so segStart and segKey can
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
function overrideKey(a: number, b: number): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildOverrideLookup(
  overrides: readonly DividerOverride[] | undefined
): Map<string, DividerOverride> {
  const lookup = new Map<string, DividerOverride>();
  if (!overrides) return lookup;
  for (const o of overrides) {
    lookup.set(overrideKey(o.compartmentA, o.compartmentB), o);
  }
  return lookup;
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
import { buildCacheKey, quantize, compactKey, stableSerialize } from './cacheKeyUtils';

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
        // Tilted-divider overrides change the wall geometry. `v1` → `v2`
        // bumps the namespace so any cached pre-feature mesh is rebuilt.
        stableSerialize(params.compartments.dividerOverrides ?? [])
      )
    );
  },
  build: (ctx) => {
    const result = buildCompartmentWalls(
      ctx.params,
      ctx.dimensions.innerW,
      ctx.dimensions.innerD,
      ctx.dimensions.interiorHeight
    );
    return result ? [result] : null;
  },
};
