/**
 * Cut faces for a custom-shaped (cellMask) bin.
 *
 * A cut through a masked bin meets material only where the cells either side
 * of it are filled, so one rectangle-wide face would size the floor scarf off
 * empty cells and key walls that are not there. Each contiguous run of cells
 * filled on both sides becomes its own face: the scarf spans the run, and a
 * run end counts as a perimeter wall only where the cells beyond it are empty
 * on both sides, so both halves carry that wall for the tongue and its groove.
 */

import { MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import type { CellMask } from '@/shared/utils/cellMask';
import { CLEARANCE } from './generatorConstants';
import type { GridPitch } from './gridPitch';
import type { CutFace } from './splitConnectorFrame';

const EPSILON = 1e-6;

/**
 * How near a cell boundary a cut still counts as on it (mm). The split moves
 * an interior whole-grid cut 0.1mm off its boundary so the boolean never meets
 * the socket walls coplanar; the cells it separates are still the ones either
 * side of that boundary. A mask cell is at least 21mm, so this cannot mistake
 * a cut through a cell for one on its edge.
 */
const BOUNDARY_TOLERANCE_MM = 0.5;

export function maskCutFaces(
  faces: readonly CutFace[],
  mask: CellMask,
  pitch: GridPitch
): CutFace[] {
  return faces.flatMap((face) => runFaces(face, mask, pitch));
}

function runFaces(face: CutFace, mask: CellMask, pitch: GridPitch): CutFace[] {
  // An x-axis cut is a plane of constant X: it runs along the mask's rows and
  // sits between (or inside) its columns. A y-axis cut is the transpose.
  const xCut = face.axis === 'x';
  const alongCount = xCut ? mask.rows : mask.cols;
  const acrossCount = xCut ? mask.cols : mask.rows;
  const alongCellMm = MASK_CELL_SIZE * (xCut ? pitch.y : pitch.x);
  const acrossCellMm = MASK_CELL_SIZE * (xCut ? pitch.x : pitch.y);
  const alongOrigin = -(alongCount * alongCellMm) / 2;
  const acrossOrigin = -(acrossCount * acrossCellMm) / 2;

  const filled = (along: number, across: number): boolean => {
    if (along < 0 || along >= alongCount || across < 0 || across >= acrossCount) return false;
    const [col, row] = xCut ? [across, along] : [along, across];
    return mask.cells[row * mask.cols + col] === 1;
  };

  // The cell lines either side of the cut: its two neighbours when it lies on
  // a cell boundary, the one cell it runs through otherwise.
  const t = (face.position - acrossOrigin) / acrossCellMm;
  const onBoundary = Math.abs(t - Math.round(t)) * acrossCellMm < BOUNDARY_TOLERANCE_MM;
  const before = onBoundary ? Math.round(t) - 1 : Math.floor(t);
  const after = onBoundary ? Math.round(t) : Math.floor(t);
  const meets = (i: number): boolean => filled(i, before) && filled(i, after);
  const walledBeyond = (i: number): boolean => !filled(i, before) && !filled(i, after);

  const pieceMin = face.pieceCenterOffset - face.pieceEdgeLength / 2;
  const pieceMax = face.pieceCenterOffset + face.pieceEdgeLength / 2;
  const out: CutFace[] = [];
  for (let i = 0; i < alongCount;) {
    if (!meets(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j < alongCount && meets(j)) j++;

    // A wall's outer face stands a tolerance gap in from its cell edge, the
    // same inset the masked body is built with.
    const minWall = walledBeyond(i - 1) ? alongOrigin + i * alongCellMm + CLEARANCE / 2 : null;
    const maxWall = walledBeyond(j) ? alongOrigin + j * alongCellMm - CLEARANCE / 2 : null;
    const minInPiece = minWall !== null && minWall >= pieceMin - EPSILON;
    const maxInPiece = maxWall !== null && maxWall <= pieceMax + EPSILON;
    const lo = minInPiece ? minWall : Math.max(pieceMin, alongOrigin + i * alongCellMm);
    const hi = maxInPiece ? maxWall : Math.min(pieceMax, alongOrigin + j * alongCellMm);
    if (hi - lo > EPSILON) {
      out.push({
        ...face,
        binEdgeMin: minInPiece ? lo : Number.NEGATIVE_INFINITY,
        binEdgeMax: maxInPiece ? hi : Number.POSITIVE_INFINITY,
        pieceEdgeLength: hi - lo,
        pieceCenterOffset: (lo + hi) / 2,
      });
    }
    i = j;
  }
  return out;
}
