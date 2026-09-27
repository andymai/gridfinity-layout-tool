/**
 * Material the interior fillet adds, for the print estimate.
 *
 * A fillet of radius r leaves (1 − π/4)·r² of material behind each side it runs
 * along, so every cavity is priced by its own outline: a merged L pays for its
 * real perimeter, not its bounding box, and a custom shape for its mask's outer
 * loop. Each convex corner then stands a column of the same cross-section at
 * the corner radius, less what the shell already rounds: the bin's own four
 * corners, and every corner of a custom shape.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { binFloorMm } from '@/features/bin-designer/types/base';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { baseWallHeight } from './binDimensions';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { isPartialMask, maskToPolygon } from '@/shared/utils/cellMask';
import {
  interiorFilletCornerMm,
  interiorFilletRadiusMm,
  narrowestCavitySpansMm,
} from '@/shared/utils/interiorFillet';

const CROSS_SECTION = 1 - Math.PI / 4;

export function computeInteriorFilletVolume(
  params: BinParams,
  outerW: number,
  outerD: number
): number {
  const radius = interiorFilletRadiusMm(params);
  if (radius === 0) return 0;
  const wall = params.wallThickness;
  const totalH = params.height * params.heightUnitMm;
  const boxWallHeight = baseWallHeight(params.base, totalH);
  // A custom shape's cavity floor is its wall thickness: the polygon hollow
  // has no spec floor slab.
  const floor = isPartialMask(params.cellMask) ? wall : binFloorMm(wall);
  const height =
    computeInteriorHeight(boxWallHeight, params.base.stackingLip, GRIDFINITY.LIP_SMALL_TAPER) -
    floor;
  if (height <= 0) return 0;

  const corner = interiorFilletCornerMm(params);
  const shellCorner = Math.max(GRIDFINITY.BOX_CORNER_RADIUS - wall, 0);
  const spans = narrowestCavitySpansMm(params);
  const column = (span: number, alreadyRounded: boolean): number => {
    const c = Math.min(corner, span / 2);
    const already = alreadyRounded ? shellCorner * shellCorner : 0;
    return CROSS_SECTION * Math.max(0, c * c - already) * height;
  };

  const mask = params.cellMask;
  if (isPartialMask(mask)) {
    const span = spans.get(params.compartments.cells[0] ?? 0) ?? 0;
    const r = Math.min(radius, span / 2);
    if (r <= 0) return 0;
    // `maskToPolygon` answers in grid units.
    const sx = params.gridUnitMm;
    const sy = params.gridUnitMmY ?? params.gridUnitMm;
    const loop = maskToPolygon(mask)[0];
    let volume = 0;
    for (let i = 0; i < loop.length; i++) {
      const prev = loop[(i - 1 + loop.length) % loop.length];
      const p = loop[i];
      const next = loop[(i + 1) % loop.length];
      volume += CROSS_SECTION * r * r * Math.hypot((next.x - p.x) * sx, (next.y - p.y) * sy);
      const turn = (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x);
      if (turn > 0) volume += column(span, true);
    }
    return volume;
  }

  const { cols, rows, cells } = params.compartments;
  const cellW = (outerW - 2 * wall) / cols;
  const cellD = (outerD - 2 * wall) / rows;
  const at = (c: number, r: number): number =>
    c < 0 || c >= cols || r < 0 || r >= rows ? -1 : cells[r * cols + c];

  let volume = 0;
  for (const id of new Set(cells)) {
    const span = spans.get(id) ?? 0;
    const r = Math.min(radius, span / 2);
    if (r <= 0) continue;
    let perimeter = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (at(col, row) !== id) continue;
        if (at(col, row - 1) !== id) perimeter += cellW;
        if (at(col, row + 1) !== id) perimeter += cellW;
        if (at(col - 1, row) !== id) perimeter += cellD;
        if (at(col + 1, row) !== id) perimeter += cellD;
      }
    }
    volume += CROSS_SECTION * r * r * perimeter;

    // A grid vertex with exactly one of its four cells in the compartment is
    // one of its convex corners.
    for (let vr = 0; vr <= rows; vr++) {
      for (let vc = 0; vc <= cols; vc++) {
        const around = [at(vc - 1, vr - 1), at(vc, vr - 1), at(vc - 1, vr), at(vc, vr)];
        if (around.filter((x) => x === id).length !== 1) continue;
        const binCorner = (vc === 0 || vc === cols) && (vr === 0 || vr === rows);
        volume += column(span, binCorner);
      }
    }
  }
  return volume;
}
