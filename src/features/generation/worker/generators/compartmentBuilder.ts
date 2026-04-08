/**
 * Compartment divider wall builder for Gridfinity bins.
 *
 * Generates internal walls between compartments based on the compartment grid.
 * Walls appear at boundaries between cells with different compartment IDs.
 */

import { box, withScope, clone, unwrap, fuseAll } from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';

// Re-export for backwards compatibility with existing imports
export { fuseAllOrNull } from './utils/shapeOps';

/** Build a positioned wall segment solid. */
function buildWallSegment(w: number, d: number, height: number, x: number, y: number): Shape3D {
  return box(w, d, height, { at: [x, y, height / 2] });
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

  // Vertical walls: between column boundaries
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const xPos = -innerW / 2 + colBoundary * cellW;
    const segments = findWallSegments(rows, (row) => {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      return leftId !== rightId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellD;
      const yCenter = -innerD / 2 + (start + (end - start) / 2) * cellD;
      wallSegments.push(
        scope.register(buildWallSegment(thickness, segLength, wallHeight, xPos, yCenter))
      );
    }
  }

  // Horizontal walls: between row boundaries
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const yPos = -innerD / 2 + rowBoundary * cellD;
    const segments = findWallSegments(cols, (col) => {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      return topId !== bottomId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellW;
      const xCenter = -innerW / 2 + (start + (end - start) / 2) * cellW;
      wallSegments.push(
        scope.register(buildWallSegment(segLength, thickness, wallHeight, xCenter, yPos))
      );
    }
  }

  if (wallSegments.length === 0) return null;
  if (wallSegments.length === 1) return wallSegments[0];
  return scope.register(unwrap(fuseAll(wallSegments as ValidSolid[])));
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, compactKey } from './cacheKeyUtils';

export const compartmentWallsFeature: FeatureBuilder = {
  name: 'compartmentWalls',
  tag: FeatureTag.DIVIDER,
  target: 'fuse',
  shouldBuild: (ctx) => !ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        params.compartments.cols,
        params.compartments.rows,
        quantize(params.compartments.thickness),
        params.compartments.cells.join(',')
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
