/**
 * Bowtie connector key accounting for split baseplates.
 *
 * In bowtie mode every join edge is a female groove and a separate, identical
 * key part is hammered into each seam junction. This module is the single
 * source of truth for HOW MANY keys a tiling needs, so the export count and the
 * print guide never disagree.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';

/**
 * Interior cell boundaries along one edge of `units` grid units.
 *
 * Mirrors `decomposeCells()` in the worker's `cellDecomposition.ts`: N full
 * 1u cells plus an optional trailing 0.5u cell, with one boundary between each
 * adjacent pair. Replicated here (rather than imported) to avoid a cross-feature
 * dependency on the generation worker; the count is guarded by a unit test.
 */
function interiorBoundaries(units: number): number {
  const fullCells = Math.floor(units);
  const hasHalf = units - fullCells >= 0.5 - 1e-10;
  const cellCount = fullCells + (hasHalf ? 1 : 0);
  return Math.max(0, cellCount - 1);
}

/**
 * Number of bowtie connector keys needed to assemble a split baseplate — one
 * per seam junction. Each junction is an interior cell boundary along a join
 * edge. Walk the pieces counting only RIGHT (vertical seams) and BACK
 * (horizontal seams) join edges, so every internal junction is counted exactly
 * once. Valid because the tiling is a strict grid: a vertical seam's two
 * adjacent pieces share the same row depth, so their grooves align.
 *
 * Returns 0 unless bowtie connectors are active.
 */
export function countConnectorKeys(tiling: BaseplateTiling, params: BaseplateParams): number {
  if (!params.connectorNubs || params.connectorStyle !== 'bowtie') return 0;

  let count = 0;
  for (const piece of tiling.pieces) {
    if (piece.edges.right === 'join') count += interiorBoundaries(piece.depthUnits);
    if (piece.edges.back === 'join') count += interiorBoundaries(piece.widthUnits);
  }
  return count;
}
