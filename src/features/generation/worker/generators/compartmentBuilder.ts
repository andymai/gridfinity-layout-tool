/**
 * Compartment divider wall builder for Gridfinity bins.
 *
 * Generates internal walls between compartments based on the compartment grid.
 * Walls appear at boundaries between cells with different compartment IDs.
 */

import { box, withScope, clone, unwrap, fuseAll, cut } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
// Pure grid helpers, kept in the compartment-grid util so the main thread can
// reach them too — the lid's click rails notch around the same runs
// and cannot import this module, which pulls in brepjs.
import {
  buildOverrideLookup,
  dividerFootDrift,
  findPairAwareRuns,
  overrideKey,
} from '@/shared/types/bin';

export { buildOverrideLookup, findPairAwareRuns, overrideKey };
import { buildCacheKey, compactKey, quantize, stableSerialize } from './cacheKeyUtils';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { isAbortError } from './utils/abort';
import {
  buildSpanningDividerClipTools,
  planSpanningDividerClips,
  spanningDividerClipsKey,
} from './labelTabBuilder';
import type { SpanningDividerClip } from './labelTabBuilder';

// Re-export for backwards compatibility with existing imports
export { fuseAllOrNull } from './utils/shapeOps';
import { findCompartmentBounds } from './compartmentCavities';
export {
  buildCompartmentCavityDrawings,
  findCompartmentBounds,
  compartmentCornersRoundCleanly,
  compartmentCavitiesAreViableWithOverrides,
} from './compartmentCavities';
import { buildTiltedWallSegment } from './compartmentDividerSegments';
export { interiorDividerSegments, findWallSegments } from './compartmentDividerSegments';
export type { InteriorDividerSegment } from './compartmentDividerSegments';

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
  wallHeight: number,
  spanningClips: readonly SpanningDividerClip[] = []
): Shape3D | null {
  const { cols, rows, cells } = params.compartments;

  // Single compartment = no walls needed
  if (cols <= 1 && rows <= 1) return null;
  if (new Set(cells).size <= 1) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildCompartmentWallsInScope(scope, params, innerW, innerD, wallHeight);
    if (!fused) return null;
    const clipped = clipUnderSpanningTabs(scope, fused, spanningClips, wallHeight);
    return clipped ? unwrap(clone(clipped)) : null;
  });
}

/**
 * Drop the divider tops that a wall-to-wall label shelf passes over,
 * so the span reads as one unbroken surface instead of being sliced by
 * dividers standing proud of it.
 *
 * A failed cut returns the unclipped walls: a divider poking through the shelf
 * is cosmetically wrong, a missing divider set is a broken bin.
 */
function clipUnderSpanningTabs(
  scope: DisposalScope,
  walls: Shape3D,
  clips: readonly SpanningDividerClip[],
  wallHeight: number
): Shape3D | null {
  if (clips.length === 0) return walls;
  const tools = buildSpanningDividerClipTools(clips, wallHeight + 1).map((t) => scope.register(t));
  if (tools.length === 0) return walls;
  let result = walls;
  for (const tool of tools) {
    try {
      result = scope.register(unwrap(cut(result as ValidSolid, tool as ValidSolid)));
    } catch (e: unknown) {
      if (isAbortError(e)) throw e;
      return walls;
    }
  }
  return result;
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
        const tilted = buildTiltedWallSegment(scope, {
          startX: xPos + override.offsetStart,
          startY,
          endX: xPos + override.offsetEnd,
          endY,
          driftX: dividerFootDrift(override, wallHeight),
          driftY: 0,
          thickness,
          height: wallHeight,
          binInnerW: innerW,
          binInnerD: innerD,
        });
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
        const tilted = buildTiltedWallSegment(scope, {
          startX,
          startY: yPos + override.offsetStart,
          endX,
          endY: yPos + override.offsetEnd,
          driftX: 0,
          driftY: dividerFootDrift(override, wallHeight),
          thickness,
          height: wallHeight,
          binInnerW: innerW,
          binInnerD: innerD,
        });
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

/**
 * Spanning-shelf clips that actually reach this bin's dividers.
 *
 * A divider shortened below the shelf underside (an explicit
 * `compartments.dividerHeight`) already ends under the span, so its clip cuts
 * nothing. Filtering here rather than at the cut keeps the cache key honest —
 * otherwise identical geometry would key differently and miss the cache.
 */
function spanClipsThatBite(ctx: {
  params: BinParams;
  dimensions: { innerW: number; innerD: number; interiorHeight: number };
}): SpanningDividerClip[] {
  const { params, dimensions: dim } = ctx;
  const dividerHeight = resolveCompartmentDividerHeight(
    params.compartments.dividerHeight,
    dim.interiorHeight
  );
  return planSpanningDividerClips(
    params,
    dim.innerW,
    dim.innerD,
    dim.interiorHeight,
    params.wallThickness
  ).filter((clip) => clip.zMin < dividerHeight);
}

export const compartmentWallsFeature: FeatureBuilder = {
  name: 'compartmentWalls',
  tag: FeatureTag.DIVIDER,
  target: 'fuse',
  // Skip when walls are already in the shell (multi-cavity cut path,).
  shouldBuild: (ctx) => !ctx.dimensions.isSlotted && !ctx.dimensions.compartmentsBakedIntoShell,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        // `v3`: dividers crossed by a spanning label shelf are clipped to its
        // underside, so the same grid now yields shorter dividers.
        'v3',
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
        ),
        spanningDividerClipsKey(spanClipsThatBite(ctx))
      )
    );
  },
  build: (ctx) => {
    const { params, dimensions: dim } = ctx;
    const result = buildCompartmentWalls(
      params,
      dim.innerW,
      dim.innerD,
      resolveCompartmentDividerHeight(params.compartments.dividerHeight, dim.interiorHeight),
      spanClipsThatBite(ctx)
    );
    return result ? [result] : null;
  },
};
