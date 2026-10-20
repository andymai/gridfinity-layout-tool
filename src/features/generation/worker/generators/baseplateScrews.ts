/**
 * Mount-down screw hole cutters for the baseplate: one template per site (and
 * junction seat), translated to each position the same way magnets are.
 *
 * Where the holes go is decided in `@/shared/generation/screwHolePlacement`,
 * kernel-free, so the draft mesh and the plate-level pad decision on the main
 * thread run the same planner this build does.
 */

import { cylinder, drawCircle, unwrap, translate, fuse } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import {
  resolveScrewHeadDiameter,
  screwCutDepths,
  type ScrewSite,
} from '@/shared/generation/screwHolePlan';
import type { ResolvedScrewHole } from '@/shared/generation/screwHolePlacement';
import { COPLANAR_MARGIN } from './generatorTypes';

/**
 * One cutter template for a site, centred on the origin in XY.
 *
 * Z follows the BREP build's convention (top face at 0, growing downward), which
 * `screwCutDepths` converts to from its top-face datum.
 *
 * The recess is lofted rather than built from a cone primitive so the profile is
 * explicit: full head width AT the entry plane, narrowing to the shaft over
 * exactly `recessDepth`. It is extended at full width up to `COPLANAR_MARGIN`
 * above the plane the bore opens on, which cuts only air and keeps the boolean
 * off a coplanar face. For a junction that plane is the top face, so the same
 * full-width run is the bore the head goes down.
 */
function buildScrewTemplate(
  params: ScrewHoleParams,
  site: ScrewSite,
  totalHeightMm: number,
  profileHeightMm: number,
  seatBelowTopMm: number
): Shape3D {
  const { openBelowTop, entryBelowTop, recessDepth, throughDepth } = screwCutDepths(
    params,
    site,
    profileHeightMm,
    totalHeightMm,
    seatBelowTopMm
  );
  const openZ = -openBelowTop;
  const entryZ = -entryBelowTop;
  const shaftRadius = params.diameter / 2;
  const headRadius = resolveScrewHeadDiameter(params.headStyle, params.headDiameter) / 2;

  // Shaft runs from just above the opening clear through the underside.
  const shaft = cylinder(shaftRadius, openZ - entryZ + throughDepth + 2 * COPLANAR_MARGIN, {
    at: [0, 0, openZ + COPLANAR_MARGIN],
    axis: [0, 0, -1],
  });

  // No recess to cut when the head is no wider than the shaft: a countersink
  // would loft between coincident sections and a counterbore would be a pocket
  // narrower than the hole through it. Both kernels happen to tolerate the
  // degenerate loft today, which is not something to depend on. Reachable from
  // the UI, where the shaft tops out at 8mm, the width an unset countersink
  // head resolves to.
  if (headRadius <= shaftRadius || recessDepth <= 0) {
    return shaft;
  }

  let recess: Shape3D;
  try {
    if (params.headStyle === 'counterbore') {
      recess = cylinder(headRadius, openZ - entryZ + recessDepth + COPLANAR_MARGIN, {
        at: [0, 0, openZ + COPLANAR_MARGIN],
        axis: [0, 0, -1],
      });
    } else {
      const section = (r: number, z: number): Sketch =>
        drawCircle(r).sketchOnPlane('XY', z) as Sketch;
      const start = section(headRadius, openZ + COPLANAR_MARGIN);
      try {
        recess = start.loftWith(
          [section(headRadius, entryZ), section(shaftRadius, entryZ - recessDepth)],
          { ruled: true }
        );
      } finally {
        start.delete();
      }
    }
  } catch (e) {
    shaft.delete();
    throw e;
  }

  try {
    return unwrap(fuse(shaft, recess));
  } finally {
    shaft.delete();
    recess.delete();
  }
}

/**
 * Build cutters for every resolved hole. Templates are built once per site (and
 * junction seat) and translated into place, matching how magnets amortise their
 * construction.
 */
export function buildScrewCutters(
  holes: readonly ResolvedScrewHole[],
  params: ScrewHoleParams,
  totalHeightMm: number,
  profileHeightMm: number
): Shape3D[] {
  if (holes.length === 0) return [];

  const templates = new Map<string, Shape3D>();
  const cutters: Shape3D[] = [];

  try {
    for (const hole of holes) {
      const seat = hole.seatBelowTopMm ?? 0;
      const key = `${hole.site}:${seat}`;
      let template = templates.get(key);
      if (template === undefined) {
        template = buildScrewTemplate(params, hole.site, totalHeightMm, profileHeightMm, seat);
        templates.set(key, template);
      }
      cutters.push(translate(template, [hole.x, hole.y, 0]));
    }
  } catch (e) {
    for (const c of cutters) c.delete();
    throw e;
  } finally {
    for (const t of templates.values()) t.delete();
  }

  return cutters;
}
