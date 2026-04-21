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
 * Prefer cuts that land on integer grid-unit boundaries so presets don't
 * leak half-bin detail (mixed-filled 1u regions) into the generator. For
 * fractional widths/depths the trailing 0.5u fringe stays filled.
 *
 * Central stem/gap width: 1u when the integer dimension is odd (so
 * shoulders stay equal), 2u when even.
 */
function stemUnits(wholeUnits: number): number {
  return wholeUnits % 2 === 1 ? 1 : 2;
}

/**
 * L-shape: clears a floor(W/2) × floor(D/2) grid-unit corner from the
 * bottom-right. Requires W ≥ 2 and D ≥ 2 so both the kept and the cut
 * regions are at least one full grid cell.
 */
export const L_PRESET: ShapePreset = {
  id: 'l',
  isAvailable: (w, d) => w >= 2 && d >= 2,
  build: (w, d) => {
    const cols = Math.round(w * MASK_CELLS_PER_UNIT);
    const rows = Math.round(d * MASK_CELLS_PER_UNIT);
    const wWhole = Math.floor(w);
    const dWhole = Math.floor(d);
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    const cutWUnits = Math.max(1, Math.floor(wWhole / 2));
    const cutDUnits = Math.max(1, Math.floor(dWhole / 2));
    const cutWCols = cutWUnits * MASK_CELLS_PER_UNIT;
    const cutDRows = cutDUnits * MASK_CELLS_PER_UNIT;
    // Anchor to the bottom-right 1u-aligned corner. For fractional widths
    // the trailing 0.5u fringe column stays filled so the cut edge lands
    // on a whole-grid boundary.
    const colStart = wWhole * MASK_CELLS_PER_UNIT - cutWCols;
    clearRect(cells, cols, colStart, 0, cutWCols, cutDRows);
    return { cols, rows, cells };
  },
};

/**
 * T-shape: top 1u row band full, lower rows keep only the centred stem.
 * Requires W ≥ 3 and D ≥ 2 so the stem plus two cut shoulders all exist.
 */
export const T_PRESET: ShapePreset = {
  id: 't',
  isAvailable: (w, d) => w >= 3 && d >= 2,
  build: (w, d) => {
    const cols = Math.round(w * MASK_CELLS_PER_UNIT);
    const rows = Math.round(d * MASK_CELLS_PER_UNIT);
    const wWhole = Math.floor(w);
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    const stemWidthUnits = stemUnits(wWhole);
    const stemCols = stemWidthUnits * MASK_CELLS_PER_UNIT;
    // Floor the left shoulder to 1u so the stem lands on a whole-grid
    // boundary. Any trailing 0.5u fringe falls onto the right shoulder.
    const leftShoulderUnits = Math.floor((wWhole - stemWidthUnits) / 2);
    const stemStart = leftShoulderUnits * MASK_CELLS_PER_UNIT;
    // Top band = exactly 1u; shoulders occupy the rest.
    const shoulderRows = rows - MASK_CELLS_PER_UNIT;
    clearRect(cells, cols, 0, 0, stemStart, shoulderRows);
    clearRect(cells, cols, stemStart + stemCols, 0, cols - stemStart - stemCols, shoulderRows);
    return { cols, rows, cells };
  },
};

/**
 * U-shape: bottom 1u row band full, upper rows split by a centred gap.
 * Requires W ≥ 3 and D ≥ 2 so the two arms plus the gap all exist.
 */
export const U_PRESET: ShapePreset = {
  id: 'u',
  isAvailable: (w, d) => w >= 3 && d >= 2,
  build: (w, d) => {
    const cols = Math.round(w * MASK_CELLS_PER_UNIT);
    const rows = Math.round(d * MASK_CELLS_PER_UNIT);
    const wWhole = Math.floor(w);
    const cells = new Array<0 | 1>(cols * rows).fill(1);
    const gapWidthUnits = stemUnits(wWhole);
    const gapCols = gapWidthUnits * MASK_CELLS_PER_UNIT;
    const leftArmUnits = Math.floor((wWhole - gapWidthUnits) / 2);
    const gapStart = leftArmUnits * MASK_CELLS_PER_UNIT;
    // Bottom band = exactly 1u; gap opens from 1u above the bottom up.
    const gapRowStart = MASK_CELLS_PER_UNIT;
    clearRect(cells, cols, gapStart, gapRowStart, gapCols, rows - gapRowStart);
    return { cols, rows, cells };
  },
};

/**
 * Preset palette shown inside the Custom-shape editor. Rectangle is
 * intentionally omitted — disabling the Custom-shape toggle itself clears
 * the mask back to the fast path, so offering it here would be redundant.
 */
export const SHAPE_PRESETS: readonly ShapePreset[] = [L_PRESET, T_PRESET, U_PRESET];

export function getPreset(id: ShapePresetId): ShapePreset {
  return SHAPE_PRESETS.find((p) => p.id === id) ?? RECTANGLE_PRESET;
}
