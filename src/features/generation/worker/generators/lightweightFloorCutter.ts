/**
 * Lightweight floor cutter for baseplate cells.
 *
 * When magnets are enabled, removes center floor material under each cell,
 * keeping only rectangular pads around the 4 magnet positions. The result is
 * a cross-shaped cutout with sharp inner corners — the cut is a vertical prism
 * so concave corners print cleanly, and dropping the former fillets roughly
 * halves the per-cell boolean cost.
 */

import { draw, drawRectangle, clone, unwrap, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import {
  SOCKET_HEIGHT,
  MAGNET_FLOOR,
  COPLANAR_MARGIN,
  INSET_BOT,
  HOLE_OFFSET,
} from './generatorConstants';
import { forEachCell } from './cellDecomposition';
import type { ForEachCellOptions } from './cellDecomposition';
import { sketch } from './meshUtils';

/** Margin around each magnet hole center that defines the pad extent (mm). */
const PAD_MARGIN = 1;

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
  // padHalf = distance from cell center to the inner edge of the magnet pad.
  // Magnets sit at HOLE_OFFSET (13mm) from center. The pad extends
  // magnetRadius + PAD_MARGIN around each hole, so the cross arm boundary
  // starts at HOLE_OFFSET - magnetRadius - PAD_MARGIN from center.
  const padHalf = HOLE_OFFSET - magnetRadius - PAD_MARGIN;
  // If magnets are so large they overlap the cell center, skip lightweight
  if (padHalf < MIN_ARM_WIDTH) return [];
  const cutterZ = -SOCKET_HEIGHT + COPLANAR_MARGIN;
  const cutterDepth = MAGNET_FLOOR + magnetDepth + 2 * COPLANAR_MARGIN;

  const cutters: Shape3D[] = [];
  const templates = new Map<string, Shape3D>();

  try {
    forEachCell(
      gridW,
      gridD,
      (cell) => {
        const cellW_mm = cell.widthUnits * gridUnitMm;
        const cellD_mm = cell.depthUnits * gridUnitMm;

        // Fractional cells (half-unit) have no magnets — cut through their
        // entire floor since the solid material serves no purpose.
        if (cell.widthUnits < 1 || cell.depthUnits < 1) {
          const fhw = cellW_mm / 2 - INSET_BOT;
          const fhd = cellD_mm / 2 - INSET_BOT;
          if (fhw <= 0 || fhd <= 0) return;
          const fractionalKey = `frac-${cell.widthUnits}x${cell.depthUnits}`;
          let fractionalTemplate = templates.get(fractionalKey);
          if (!fractionalTemplate) {
            const rectProfile = drawRectangle(fhw * 2, fhd * 2);
            fractionalTemplate = sketch(rectProfile, 'XY', cutterZ).extrude(-cutterDepth);
            templates.set(fractionalKey, fractionalTemplate);
          }
          const cloned = unwrap(clone(fractionalTemplate));
          try {
            const positioned = translate(cloned, [cell.centerX, cell.centerY, 0]);
            cutters.push(positioned);
          } finally {
            cloned.delete();
          }
          return;
        }

        // Inset by INSET_BOT so the cutout stays within the flat pocket floor
        // and doesn't undercut the tapered pocket walls (which would create overhangs).
        const hw = cellW_mm / 2 - INSET_BOT;
        const hd = cellD_mm / 2 - INSET_BOT;

        // Guard: skip if cross arms would be too narrow
        const armW = hw - padHalf;
        const armD = hd - padHalf;
        if (armW < MIN_ARM_WIDTH || armD < MIN_ARM_WIDTH) return;

        const cacheKey = `${cell.widthUnits}x${cell.depthUnits}`;
        let template = templates.get(cacheKey);

        if (!template) {
          // Cross-shaped profile (CCW), 12 straight segments. The inner corners
          // are left sharp: this is an underside material-relief pocket cut
          // straight down (vertical walls regardless of in-plane corner shape),
          // so sharp concave corners print fine — and the curved fillet faces
          // they replace made the per-cell boolean disproportionately expensive.
          // Walking CCW from top-right of vertical arm:
          const profile = draw([padHalf, hd])
            .lineTo([-padHalf, hd])
            .lineTo([-padHalf, padHalf])
            .lineTo([-hw, padHalf])
            .lineTo([-hw, -padHalf])
            .lineTo([-padHalf, -padHalf])
            .lineTo([-padHalf, -hd])
            .lineTo([padHalf, -hd])
            .lineTo([padHalf, -padHalf])
            .lineTo([hw, -padHalf])
            .lineTo([hw, padHalf])
            .lineTo([padHalf, padHalf])
            .close();

          template = sketch(profile, 'XY', cutterZ).extrude(-cutterDepth);
          templates.set(cacheKey, template);
        }

        const cloned = unwrap(clone(template));
        try {
          const positioned = translate(cloned, [cell.centerX, cell.centerY, 0]);
          cutters.push(positioned);
        } finally {
          cloned.delete();
        }
      },
      cellOpts
    );
  } catch (e) {
    for (const c of cutters) c.delete();
    throw e;
  } finally {
    // Dispose template shapes — they were allocated for this build only.
    // In a finally block so WASM handles are freed even if a BREP op throws.
    for (const t of templates.values()) t.delete();
  }

  return cutters;
}
