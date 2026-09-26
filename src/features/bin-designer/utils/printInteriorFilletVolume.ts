/**
 * Material the interior fillet adds, for the print estimate.
 *
 * A fillet of radius r leaves (1 − π/4)·r² of material behind each side it runs
 * along, so every compartment is priced by its own cell outline: a merged L
 * pays for its real perimeter, not its bounding box. Each convex corner then
 * stands a column of the same cross-section at the corner radius, less what the
 * shell already rounds at the bin's own four corners.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { binFloorMm } from '@/features/bin-designer/types/base';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { baseWallHeight } from './binDimensions';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { interiorFilletCornerMm, interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';

const CROSS_SECTION = 1 - Math.PI / 4;

export function computeInteriorFilletVolume(
  params: BinParams,
  outerW: number,
  outerD: number
): number {
  const radius = interiorFilletRadiusMm(params);
  if (radius === 0) return 0;
  const wall = params.wallThickness;
  const { cols, rows, cells, thickness } = params.compartments;
  const cellW = (outerW - 2 * wall) / cols;
  const cellD = (outerD - 2 * wall) / rows;

  const totalH = params.height * params.heightUnitMm;
  const boxWallHeight = baseWallHeight(params.base, totalH);
  const height =
    computeInteriorHeight(boxWallHeight, params.base.stackingLip, GRIDFINITY.LIP_SMALL_TAPER) -
    binFloorMm(wall);
  if (height <= 0) return 0;

  const corner = interiorFilletCornerMm(params);
  const shellCorner = Math.max(GRIDFINITY.BOX_CORNER_RADIUS - wall, 0);
  const at = (c: number, r: number): number =>
    c < 0 || c >= cols || r < 0 || r >= rows ? -1 : cells[r * cols + c];

  let volume = 0;
  for (const id of new Set(cells)) {
    let perimeter = 0;
    let minCol = cols;
    let maxCol = -1;
    let minRow = rows;
    let maxRow = -1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (at(c, r) !== id) continue;
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        if (at(c, r - 1) !== id) perimeter += cellW;
        if (at(c, r + 1) !== id) perimeter += cellW;
        if (at(c - 1, r) !== id) perimeter += cellD;
        if (at(c + 1, r) !== id) perimeter += cellD;
      }
    }
    const span = Math.min((maxCol - minCol + 1) * cellW, (maxRow - minRow + 1) * cellD) - thickness;
    const r = Math.min(radius, span / 2);
    if (r <= 0) continue;
    volume += CROSS_SECTION * r * r * perimeter;
    const columnRadius = Math.min(corner, span / 2);

    // A grid vertex with exactly one of its four cells in the compartment is
    // one of its convex corners.
    for (let vr = 0; vr <= rows; vr++) {
      for (let vc = 0; vc <= cols; vc++) {
        const around = [at(vc - 1, vr - 1), at(vc, vr - 1), at(vc - 1, vr), at(vc, vr)];
        if (around.filter((x) => x === id).length !== 1) continue;
        const binCorner = (vc === 0 || vc === cols) && (vr === 0 || vr === rows);
        const already = binCorner ? shellCorner * shellCorner : 0;
        volume += CROSS_SECTION * Math.max(0, columnRadius * columnRadius - already) * height;
      }
    }
  }
  return volume;
}
