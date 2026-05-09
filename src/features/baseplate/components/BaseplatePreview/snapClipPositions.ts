import type { BaseplateTiling } from '../../types/tiling';

// Cell-center positions along an axis, relative to piece center. One position
// per cell, including a trailing half-cell. Mirrors `cellCentersAlong` in the
// worker generator (kept local here to respect feature module boundaries).
function cellCenters(units: number, gridUnitMm: number, halfAtStart: boolean): number[] {
  const fullCells = Math.floor(units);
  const hasHalf = units - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array<number>(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  if (halfAtStart) cells.reverse();
  const total = units * gridUnitMm;
  const out: number[] = [];
  let offset = 0;
  for (const c of cells) {
    out.push(offset + (c * gridUnitMm) / 2 - total / 2);
    offset += c * gridUnitMm;
  }
  return out;
}

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
    const halfAtStartX = piece.fractionalEdgeX === 'start';
    const halfAtStartY = piece.fractionalEdgeY === 'start';

    if (piece.edges.right === 'join') {
      const seamX = pieceCenterX + pieceWidthMm / 2;
      for (const c of cellCenters(piece.depthUnits, gridUnitMm, halfAtStartY)) {
        positions.push({ x: seamX, y: pieceCenterY + c, orientation: 'verticalSeam' });
      }
    }

    if (piece.edges.back === 'join') {
      const seamY = pieceCenterY + pieceDepthMm / 2;
      for (const c of cellCenters(piece.widthUnits, gridUnitMm, halfAtStartX)) {
        positions.push({ x: pieceCenterX + c, y: seamY, orientation: 'horizontalSeam' });
      }
    }
  }

  return positions;
}
