import type { BaseplateTiling } from '../../types/tiling';

export type SnapClipOrientation = 'verticalSeam' | 'horizontalSeam';

export interface SnapClipPosition {
  readonly x: number;
  readonly y: number;
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

  // Walk only +X and +Y join edges per piece — each seam is shared by two
  // pieces, so this avoids double-emitting clips.
  for (const piece of tiling.pieces) {
    const pieceWidthMm = piece.widthUnits * gridUnitMm;
    const pieceDepthMm = piece.depthUnits * gridUnitMm;
    const pieceCenterX = piece.gridOffsetX * gridUnitMm + pieceWidthMm / 2 - totalWidthMm / 2;
    const pieceCenterY = piece.gridOffsetY * gridUnitMm + pieceDepthMm / 2 - totalDepthMm / 2;

    if (piece.edges.right === 'join') {
      const seamX = pieceCenterX + pieceWidthMm / 2;
      const numBoundaries = Math.ceil(piece.depthUnits) - 1;
      for (let k = 1; k <= numBoundaries; k++) {
        const bpY = k * gridUnitMm - pieceDepthMm / 2 + pieceCenterY;
        positions.push({ x: seamX, y: bpY, orientation: 'verticalSeam' });
      }
    }

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
