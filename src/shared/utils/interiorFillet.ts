/**
 * How far the interior fillet reaches, for the features that must stay clear
 * of it: pattern holes cut through a wall or divider would notch the rounding
 * where it climbs the face, and a floor pattern would leave half-holes in it.
 *
 * Upper bounds from the design alone. The worker clamps each compartment's
 * radius further, so a margin read from here never falls short of the solid.
 */

import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { MASK_CELL_SIZE, isPartialMask } from '@/shared/utils/cellMask';

/**
 * The radius the control starts at: the shell's own inner corner, rounded down
 * to the control's step, so the fillet meets the bin's corners without a lip.
 */
export function defaultInteriorFilletMm(wallThickness: number): number {
  const shellCorner = GRIDFINITY.BOX_CORNER_RADIUS - wallThickness;
  const stepped = Math.floor(shellCorner * 10) / 10;
  return Math.min(
    DESIGNER_CONSTRAINTS.MAX_INTERIOR_FILLET,
    Math.max(DESIGNER_CONSTRAINTS.MIN_INTERIOR_FILLET, stepped)
  );
}

/** The radius a design asks for, or 0 when it has no fillet. */
export function interiorFilletRadiusMm(params: Pick<BinParams, 'interiorFilletMm'>): number {
  const r = params.interiorFilletMm;
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : 0;
}

/**
 * Height above the base floor the fillet can climb a wall or divider: its
 * radius, standing on the highest raised compartment floor.
 */
export function interiorFilletRiseMm(
  params: Pick<BinParams, 'interiorFilletMm'> & {
    readonly compartments: Pick<BinParams['compartments'], 'floorRaises'>;
  }
): number {
  const r = interiorFilletRadiusMm(params);
  if (r === 0) return 0;
  const raises = (params.compartments.floorRaises ?? []).filter(
    (raise): raise is number => typeof raise === 'number' && Number.isFinite(raise) && raise > 0
  );
  return r + Math.max(0, ...raises);
}

/**
 * Width a rounded vertical corner takes along each face meeting it: never less
 * than the shell's own corner arc, which the fillet matches.
 */
export function interiorFilletCornerMm(
  params: Pick<BinParams, 'interiorFilletMm' | 'wallThickness'>
): number {
  const r = interiorFilletRadiusMm(params);
  if (r === 0) return 0;
  return Math.max(r, GRIDFINITY.BOX_CORNER_RADIUS - params.wallThickness);
}

/**
 * Each cavity's narrowest straight run of cells, in mm, keyed by compartment
 * id: the span a fillet cannot grow past half of. A merged L is as narrow as
 * its thinner arm, not its bounding box. A custom shape is one cavity, keyed by
 * its compartment id, measured across the mask's own cells.
 */
export function narrowestCavitySpansMm(
  params: Pick<
    BinParams,
    'width' | 'depth' | 'gridUnitMm' | 'gridUnitMmY' | 'wallThickness' | 'cellMask' | 'compartments'
  >
): Map<number, number> {
  const pitchX = params.gridUnitMm;
  const pitchY = params.gridUnitMmY ?? params.gridUnitMm;
  const mask = params.cellMask;
  if (isPartialMask(mask)) {
    const cellX = MASK_CELL_SIZE * pitchX;
    const cellY = MASK_CELL_SIZE * pitchY;
    const filled = (c: number, r: number): boolean =>
      c >= 0 && c < mask.cols && r >= 0 && r < mask.rows && mask.cells[r * mask.cols + c] === 1;
    const walls = 2 * params.wallThickness + GRIDFINITY.TOLERANCE;
    let narrowest = Infinity;
    forEachRun(mask.cols, mask.rows, filled, (length, alongX) => {
      narrowest = Math.min(narrowest, length * (alongX ? cellX : cellY) - walls);
    });
    return new Map([[params.compartments.cells[0] ?? 0, narrowest]]);
  }

  const { cols, rows, cells, thickness } = params.compartments;
  const cellW = (params.width * pitchX - GRIDFINITY.TOLERANCE - 2 * params.wallThickness) / cols;
  const cellD = (params.depth * pitchY - GRIDFINITY.TOLERANCE - 2 * params.wallThickness) / rows;
  const at = (c: number, r: number): number =>
    c < 0 || c >= cols || r < 0 || r >= rows ? -1 : cells[r * cols + c];
  const out = new Map<number, number>();
  for (const id of new Set(cells)) {
    let narrowest = Infinity;
    forEachRun(
      cols,
      rows,
      (c, r) => at(c, r) === id,
      (length, alongX, start) => {
        const end = start + length - 1;
        const count = alongX ? cols : rows;
        const dividers = ((start > 0 ? 1 : 0) + (end < count - 1 ? 1 : 0)) * (thickness / 2);
        narrowest = Math.min(narrowest, length * (alongX ? cellW : cellD) - dividers);
      }
    );
    out.set(id, narrowest);
  }
  return out;
}

/** Every maximal run of cells passing `inside`, along rows then along columns. */
function forEachRun(
  cols: number,
  rows: number,
  inside: (c: number, r: number) => boolean,
  visit: (length: number, alongX: boolean, start: number) => void
): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inside(c, r) || inside(c - 1, r)) continue;
      let length = 0;
      while (inside(c + length, r)) length++;
      visit(length, true, c);
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!inside(c, r) || inside(c, r - 1)) continue;
      let length = 0;
      while (inside(c, r + length)) length++;
      visit(length, false, r);
    }
  }
}
