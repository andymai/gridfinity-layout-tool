/**
 * The printable calibration sheet's geometry — the single source of truth for
 * both the detector (`gridDetect.ts`) and the printable itself
 * (`scanImport/calibrationSheetSvg.ts`).
 *
 * The sheet is a rectangular lattice of solid black squares on white, with
 * markers only on the OUTER RING. Two reasons for the ring rather than a full
 * lattice:
 *
 *  - The tool sits on the sheet. Interior markers would be occluded by it, and
 *    a marker touching the tool merges into its blob — which contaminates the
 *    silhouette the classical tracer reads. A clear white interior is also the
 *    best possible background for segmentation.
 *  - A homography is far better behaved interpolating inside its point set than
 *    extrapolating beyond it. Ring markers bracket the tool on all four sides,
 *    which is exactly where the single-card reference falls down: the card sits
 *    off to one side, so the tool is solved by extrapolation.
 *
 * The pitch is 42mm — Gridfinity's own unit, so the printed lattice lines up
 * with a baseplate if you happen to have one under the paper.
 */

export const CALIBRATION_PITCH_MM = 42;
export const CALIBRATION_MARKER_MM = 14;
export const CALIBRATION_COLS = 5;
export const CALIBRATION_ROWS = 6;

export interface GridNode {
  readonly col: number;
  readonly row: number;
  /** Marker centre in sheet millimetres, origin at the top-left node. */
  readonly x: number;
  readonly y: number;
}

/**
 * The lattice's marker centres, in millimetres. `cols`/`rows` are parameters
 * rather than constants because detection tries the transposed lattice too — a
 * sheet photographed sideways is the same sheet with its axes swapped.
 */
export function calibrationNodes(
  cols: number = CALIBRATION_COLS,
  rows: number = CALIBRATION_ROWS,
  pitchMm: number = CALIBRATION_PITCH_MM
): GridNode[] {
  const nodes: GridNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col !== 0 && col !== cols - 1 && row !== 0 && row !== rows - 1) continue;
      nodes.push({ col, row, x: col * pitchMm, y: row * pitchMm });
    }
  }
  return nodes;
}

/** Outer dimensions of the lattice (node centre to node centre), in millimetres. */
export function calibrationSpanMm(
  cols: number = CALIBRATION_COLS,
  rows: number = CALIBRATION_ROWS,
  pitchMm: number = CALIBRATION_PITCH_MM
): { readonly width: number; readonly height: number } {
  return { width: (cols - 1) * pitchMm, height: (rows - 1) * pitchMm };
}
