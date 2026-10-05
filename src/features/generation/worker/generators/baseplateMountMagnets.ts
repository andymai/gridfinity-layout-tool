/**
 * BREP cutters for underside mount magnets. Placement lives in
 * `mountMagnetPlan.ts`, which the direct-mesh draft shares.
 */

import { translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { COPLANAR_MARGIN } from './generatorConstants';
import { buildMagnetHoleCutter } from './magnetHoleCutter';
import type { MountMagnetHole } from './mountMagnetPlan';

/**
 * One blind hole per position, opening on the underside. Z follows the BREP
 * build's convention (top face at 0, bottom at `-totalHeight`); the cutter
 * starts `COPLANAR_MARGIN` below the bottom face so the boolean never meets a
 * coplanar face, and the chamfer's mouth plane sits that far inside it.
 */
export function buildMountMagnetCutters(
  holes: readonly MountMagnetHole[],
  diameter: number,
  depth: number,
  totalHeight: number
): Shape3D[] {
  if (holes.length === 0) return [];
  const templates = new Map<boolean, Shape3D>();
  const cutters: Shape3D[] = [];
  try {
    for (const hole of holes) {
      let template = templates.get(hole.chamfer);
      if (template === undefined) {
        template = buildMagnetHoleCutter({
          radius: diameter / 2,
          height: depth + COPLANAR_MARGIN,
          style: { crushRibs: false, chamfer: hole.chamfer },
          mouth: { end: 'bottom', inset: COPLANAR_MARGIN },
        });
        templates.set(hole.chamfer, template);
      }
      cutters.push(translate(template, [hole.x, hole.y, -totalHeight - COPLANAR_MARGIN]));
    }
  } catch (e) {
    for (const c of cutters) c.delete();
    throw e;
  } finally {
    for (const t of templates.values()) t.delete();
  }
  return cutters;
}
