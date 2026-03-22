/**
 * Lightweight floor cutter for baseplate cells.
 *
 * When magnets are enabled, removes center floor material under each cell,
 * keeping only rectangular pads around the 4 magnet positions. The result is
 * a cross-shaped cutout whose inner concave corners are filleted with the
 * magnet hole radius for a clean transition.
 */

import { draw, clone, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { SOCKET_HEIGHT, MAGNET_FLOOR, COPLANAR_MARGIN } from './generatorConstants';
import { forEachCell } from './cellDecomposition';
import type { ForEachCellOptions } from './cellDecomposition';
import { sketch } from './meshUtils';

/** Margin around each magnet hole center that defines the pad extent (mm). */
const PAD_MARGIN = 2;

/** Minimum arm width for the cross cutout (mm). Skip cell if arms too narrow. */
const MIN_ARM_WIDTH = 2;

/**
 * Build cross-shaped floor cutters that remove center material under each cell,
 * keeping only pads around the 4 magnet positions.
 *
 * @param gridW Grid width in units
 * @param gridD Grid depth in units
 * @param magnetRadius Magnet hole radius in mm
 * @param magnetDepth Magnet hole depth in mm
 * @param cellOpts Cell iteration options including gridUnitMm
 * @param lightweight Whether lightweight floor is enabled (default true)
 * @returns Array of cutter solids to subtract from the baseplate
 */
export function buildLightweightFloorCutters(
  gridW: number,
  gridD: number,
  magnetRadius: number,
  magnetDepth: number,
  cellOpts: ForEachCellOptions & { gridUnitMm: number },
  lightweight?: boolean
): Shape3D[] {
  if (lightweight === false) return [];

  const gridUnitMm = cellOpts.gridUnitMm;
  const padHalf = magnetRadius + PAD_MARGIN;
  const cutterZ = -SOCKET_HEIGHT + COPLANAR_MARGIN;
  const cutterDepth = MAGNET_FLOOR + magnetDepth + 2 * COPLANAR_MARGIN;

  const cutters: Shape3D[] = [];
  const templates = new Map<string, Shape3D>();

  forEachCell(
    gridW,
    gridD,
    (cell) => {
      // Skip fractional cells -- no magnet holes in sub-unit cells
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

      const cellW_mm = cell.widthUnits * gridUnitMm;
      const cellD_mm = cell.depthUnits * gridUnitMm;
      const hw = cellW_mm / 2;
      const hd = cellD_mm / 2;

      // Guard: skip if cross arms would be too narrow
      const armW = hw - padHalf;
      const armD = hd - padHalf;
      if (armW < MIN_ARM_WIDTH || armD < MIN_ARM_WIDTH) return;

      const cacheKey = `${cell.widthUnits}x${cell.depthUnits}`;
      let template = templates.get(cacheKey);

      if (!template) {
        const r = Math.min(magnetRadius, Math.min(armW, armD));

        // Cross-shaped profile (CCW), 12 segments + 4 inner corner fillets.
        // Walking CCW from top-right of vertical arm:
        const profile = draw([padHalf, hd])
          .lineTo([-padHalf, hd])
          .lineTo([-padHalf, padHalf])
          .customCorner(r)
          .lineTo([-hw, padHalf])
          .lineTo([-hw, -padHalf])
          .lineTo([-padHalf, -padHalf])
          .customCorner(r)
          .lineTo([-padHalf, -hd])
          .lineTo([padHalf, -hd])
          .lineTo([padHalf, -padHalf])
          .customCorner(r)
          .lineTo([hw, -padHalf])
          .lineTo([hw, padHalf])
          .lineTo([padHalf, padHalf])
          .customCorner(r)
          .close();

        template = sketch(profile, 'XY', cutterZ).extrude(-cutterDepth);
        templates.set(cacheKey, template);
      }

      cutters.push(translate(clone(template), [cell.centerX, cell.centerY, 0]));
    },
    cellOpts
  );

  return cutters;
}
