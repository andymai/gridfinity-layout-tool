/**
 * Compute scene-space placements for snap-clip preview meshes.
 *
 * Walks the tiling's pieces, considers each piece's right and back edges
 * (this avoids double-counting since every seam is shared by two pieces),
 * and emits one clip per grid-cell boundary along each join.
 *
 * Coordinate convention matches `BaseplateMesh` / `SplitBaseplateMeshes`:
 * the scene origin is the slab center, +X is right, +Y is back, +Z is up.
 */

import type { BaseplateTiling } from '../../types/tiling';

export type SnapClipOrientation = 'verticalSeam' | 'horizontalSeam';

export interface SnapClipPosition {
  /** Scene-space (x, y) of the clip center (above the seam at the boundary). */
  readonly x: number;
  readonly y: number;
  /** 'verticalSeam' = seam runs along Y; clip long axis is along X (no rotation).
   *  'horizontalSeam' = seam runs along X; clip rotated 90° about Z. */
  readonly orientation: SnapClipOrientation;
}

export function computeSnapClipPositions(
  tiling: BaseplateTiling,
  gridUnitMm: number
): SnapClipPosition[] {
  const positions: SnapClipPosition[] = [];
  if (!tiling.isSplit) return positions;

  const totalWidthMm = tiling.totalWidthUnits * gridUnitMm;
  const totalDepthMm = tiling.totalDepthUnits * gridUnitMm;

  for (const piece of tiling.pieces) {
    const pieceWidthMm = piece.widthUnits * gridUnitMm;
    const pieceDepthMm = piece.depthUnits * gridUnitMm;
    const pieceCenterX = piece.gridOffsetX * gridUnitMm + pieceWidthMm / 2 - totalWidthMm / 2;
    const pieceCenterY = piece.gridOffsetY * gridUnitMm + pieceDepthMm / 2 - totalDepthMm / 2;

    // Right join: vertical seam at piece's +X edge. Boundaries run along Y.
    if (piece.edges.right === 'join') {
      const seamX = pieceCenterX + pieceWidthMm / 2;
      const numBoundaries = Math.ceil(piece.depthUnits) - 1;
      for (let k = 1; k <= numBoundaries; k++) {
        const bpY = k * gridUnitMm - pieceDepthMm / 2 + pieceCenterY;
        positions.push({ x: seamX, y: bpY, orientation: 'verticalSeam' });
      }
    }

    // Back join: horizontal seam at piece's +Y edge. Boundaries run along X.
    if (piece.edges.back === 'join') {
      const seamY = pieceCenterY + pieceDepthMm / 2;
      const numBoundaries = Math.ceil(piece.widthUnits) - 1;
      for (let k = 1; k <= numBoundaries; k++) {
        const bpX = k * gridUnitMm - pieceWidthMm / 2 + pieceCenterX;
        positions.push({ x: bpX, y: seamY, orientation: 'horizontalSeam' });
      }
    }
  }

  return positions;
}
