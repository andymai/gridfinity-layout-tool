/**
 * Shape presets for the Shape section.
 *
 * Each preset produces a half-bin-resolution `CellMask` sized to the current
 * bin's `width × depth`. Presets use grid-unit-relative proportions rather
 * than fixed cell counts so they scale correctly across 2×2 through 10×10
 * bins. Small bins that can't express a given preset (e.g. a T-shape on a
 * 1×1 footprint has no room for a stem) report `isAvailable: false` and
 * leave the mask untouched.
 */
import { MASK_CELLS_PER_UNIT, type CellMask } from '@/shared/utils/cellMask';

export type ShapePresetId = 'rectangle' | 'l' | 't' | 'u';

export interface ShapePreset {
  readonly id: ShapePresetId;
  readonly isAvailable: (widthUnits: number, depthUnits: number) => boolean;
  /** Returns the mask, or `undefined` for the rectangle fast-path. */
  readonly build: (widthUnits: number, depthUnits: number) => CellMask | undefined;
}

function clearRect(
  cells: (0 | 1)[],
  cols: number,
  colStart: number,
  rowStart: number,
  colCount: number,
  rowCount: number
): void {
  for (let r = rowStart; r < rowStart + rowCount; r++) {
    for (let c = colStart; c < colStart + colCount; c++) {
      cells[r * cols + c] = 0;
    }
  }
}

export const RECTANGLE_PRESET: ShapePreset = {
  id: 'rectangle',
  isAvailable: () => true,
  build: () => undefined,
};

/**
 * L-shape: clears the bottom-right quarter of the footprint. Requires
 * W ≥ 2 and D ≥ 2 so both the kept and the cut regions are at least one
 * full grid cell.
 */
export const L_PRESET: ShapePreset = {
  id: 'l',
  isAvailable: (w, d) => w >= 2 && d >= 2,
  build: (w, d) => {
    const cols = Math.round(w * MASK_CELLS_PER_UNIT);
    const rows = Math.round(d * MASK_CELLS_PER_UNIT);
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    const cutW = Math.floor(cols / 2);
    const cutD = Math.floor(rows / 2);
    clearRect(cells, cols, cols - cutW, 0, cutW, cutD);
    return { cols, rows, cells };
  },
};

/**
 * T-shape: top row band full, bottom rows keep only the centre stem.
 * Requires W ≥ 3 and D ≥ 2 so the stem plus two cut shoulders all exist.
 */
export const T_PRESET: ShapePreset = {
  id: 't',
  isAvailable: (w, d) => w >= 3 && d >= 2,
  build: (w, d) => {
    const cols = Math.round(w * MASK_CELLS_PER_UNIT);
    const rows = Math.round(d * MASK_CELLS_PER_UNIT);
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    const stemHalf = Math.max(1, Math.floor(cols / 6)); // stem width in cells from centre
    const stemStart = Math.floor(cols / 2) - stemHalf;
    const stemCols = stemHalf * 2;
    const shoulderRows = Math.floor(rows / 2);
    // Clear left and right shoulders below the top band.
    clearRect(cells, cols, 0, 0, stemStart, shoulderRows);
    clearRect(cells, cols, stemStart + stemCols, 0, cols - stemStart - stemCols, shoulderRows);
    return { cols, rows, cells };
  },
};

/**
 * U-shape: bottom band full, upper rows split by a central gap.
 * Requires W ≥ 3 and D ≥ 2 so the two arms plus the gap all exist.
 */
export const U_PRESET: ShapePreset = {
  id: 'u',
  isAvailable: (w, d) => w >= 3 && d >= 2,
  build: (w, d) => {
    const cols = Math.round(w * MASK_CELLS_PER_UNIT);
    const rows = Math.round(d * MASK_CELLS_PER_UNIT);
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    const gapHalf = Math.max(1, Math.floor(cols / 6));
    const gapStart = Math.floor(cols / 2) - gapHalf;
    const gapCols = gapHalf * 2;
    const gapRowStart = Math.floor(rows / 2);
    // Clear the central gap from halfway up to the top edge.
    clearRect(cells, cols, gapStart, gapRowStart, gapCols, rows - gapRowStart);
    return { cols, rows, cells };
  },
};

export const SHAPE_PRESETS: readonly ShapePreset[] = [
  RECTANGLE_PRESET,
  L_PRESET,
  T_PRESET,
  U_PRESET,
];

export function getPreset(id: ShapePresetId): ShapePreset {
  return SHAPE_PRESETS.find((p) => p.id === id) ?? RECTANGLE_PRESET;
}
