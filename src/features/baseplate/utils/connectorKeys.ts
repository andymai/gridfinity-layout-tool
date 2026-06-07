/**
 * Seated-connector accounting + placement for split baseplates.
 *
 * The dovetail-key and snap-clip styles both make every join edge female and
 * ship a separate part seated at each seam junction (a hammered-in key, or a
 * top-inserted snap clip). This module is the single source of truth for WHERE
 * those parts go (and therefore HOW MANY), so the export count, the print guide,
 * and the 3D preview never disagree.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';

/**
 * One seated dovetail key location, in the same centered world frame the preview
 * uses for pieces (origin at the baseplate center, +X right, +Y back, mm).
 */
export interface SeamJunction {
  readonly xMm: number;
  readonly yMm: number;
  /**
   * Orientation of the key's long axis:
   * - 'x': vertical seam (between left/right pieces) — key spans in X (no rotation).
   * - 'y': horizontal seam (between front/back pieces) — key rotated 90° about Z.
   */
  readonly axis: 'x' | 'y';
}

/**
 * Interior cell-boundary offsets along one edge of `units` grid units, measured
 * from the edge's center (mm). Mirrors `decomposeCells` + `computeCellBoundariesMm`
 * in the worker's `cellDecomposition.ts`: N full 1u cells plus an optional
 * trailing 0.5u cell, with one boundary between each adjacent pair. The trailing
 * half-cell flips to the start when `fractionalEdge === 'start'`. Replicated here
 * (rather than imported) to avoid a cross-feature dependency on the generation
 * worker; parity is guarded by unit tests.
 */
function interiorBoundaryOffsetsMm(
  units: number,
  gridUnitMm: number,
  fractionalEdge: 'start' | 'end' | 'none'
): number[] {
  const fullCells = Math.floor(units);
  const hasHalf = units - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array<number>(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  if (fractionalEdge === 'start') cells.reverse();

  const totalMm = units * gridUnitMm;
  const offsets: number[] = [];
  let pos = 0;
  for (let i = 0; i < cells.length - 1; i++) {
    pos += cells[i] * gridUnitMm;
    offsets.push(pos - totalMm / 2);
  }
  return offsets;
}

/** Styles that ship a separate part seated at every seam junction. */
function hasSeatedConnector(params: BaseplateParams): boolean {
  return (
    params.connectorNubs === true &&
    (params.connectorStyle === 'dovetailKey' || params.connectorStyle === 'snapClip')
  );
}

/**
 * Seated dovetail key locations for a split baseplate. Walk the pieces emitting a
 * junction for every interior boundary on each RIGHT (vertical seam) and BACK
 * (horizontal seam) join edge — so every internal seam junction is produced
 * exactly once. Valid because the tiling is a strict grid: a seam's two adjacent
 * pieces share the same cross-axis size, so their grooves align.
 *
 * Coordinates match `SplitBaseplateMeshes` piece centering exactly:
 *   center = gridOffset * gridUnitMm + pieceSize / 2 - total / 2
 *
 * Returns [] unless a seated-connector style (dovetail key / snap clip) is active.
 */
export function computeSeamJunctions(
  tiling: BaseplateTiling,
  params: BaseplateParams
): SeamJunction[] {
  if (!hasSeatedConnector(params)) return [];

  const g = params.gridUnitMm;
  const totalWmm = tiling.totalWidthUnits * g;
  const totalDmm = tiling.totalDepthUnits * g;
  const junctions: SeamJunction[] = [];

  for (const piece of tiling.pieces) {
    const pieceWmm = piece.widthUnits * g;
    const pieceDmm = piece.depthUnits * g;
    const centerX = piece.gridOffsetX * g + pieceWmm / 2 - totalWmm / 2;
    const centerY = piece.gridOffsetY * g + pieceDmm / 2 - totalDmm / 2;

    if (piece.edges.right === 'join') {
      const seamX = piece.gridOffsetX * g + pieceWmm - totalWmm / 2;
      for (const off of interiorBoundaryOffsetsMm(piece.depthUnits, g, piece.fractionalEdgeY)) {
        junctions.push({ xMm: seamX, yMm: centerY + off, axis: 'x' });
      }
    }
    if (piece.edges.back === 'join') {
      const seamY = piece.gridOffsetY * g + pieceDmm - totalDmm / 2;
      for (const off of interiorBoundaryOffsetsMm(piece.widthUnits, g, piece.fractionalEdgeX)) {
        junctions.push({ xMm: centerX + off, yMm: seamY, axis: 'y' });
      }
    }
  }
  return junctions;
}

/**
 * Number of seated connector parts a split baseplate needs — one per seam
 * junction. Derived from {@link computeSeamJunctions} so the count and the
 * placements can never diverge. Returns 0 unless a seated-connector style
 * (dovetail key or snap clip) is active.
 */
export function countConnectorKeys(tiling: BaseplateTiling, params: BaseplateParams): number {
  return computeSeamJunctions(tiling, params).length;
}
