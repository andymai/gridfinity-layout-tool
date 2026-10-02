/**
 * Pocket cutter geometry for baseplate cells.
 *
 * Each pocket is the pocket profile (`pocketProfileFor`) swept around the full grid cell: the bin
 * socket's contour offset outward by CLEARANCE/2 perpendicular, which leaves
 * the seated foot 0.25mm of air on every face and lands it on the pocket floor
 * rather than on its own tapers.
 *
 * Pockets are cached per (cellSize, throughCut). Preview and export build the
 * same cutter: a draft that lofts straight from the opening to the floor reads
 * as a plain cone, which is a different part, not a coarser one.
 */

import { drawRoundedRectangle, unwrap, clone } from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import {
  PLATE_PROFILE_HEIGHT,
  pocketProfileFor,
  POCKET_INSET_BOT,
  pocketCornerRadius,
  COPLANAR_MARGIN,
  safeSectionRect,
} from './generatorTypes';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { pocketTemplateCache } from './baseplateCaches';

function pocketCacheKey(
  cellW: number,
  cellD: number,
  throughCut: boolean,
  belowSocketMm: number,
  profileHeight: number
): string {
  return buildCacheKey(
    'v3',
    quantize(cellW),
    quantize(cellD),
    throughCut,
    quantize(belowSocketMm),
    ...(quantize(profileHeight) !== quantize(PLATE_PROFILE_HEIGHT)
      ? [`ph${quantize(profileHeight)}`]
      : [])
  );
}

function pocketSection(
  cellW_mm: number,
  cellD_mm: number,
  cornerR: number,
  z: number,
  inset: number
): Sketch {
  const { width, depth, radius } = safeSectionRect(
    cellW_mm - 2 * inset,
    cellD_mm - 2 * inset,
    cornerR - inset
  );
  return drawRoundedRectangle(width, depth, radius).sketchOnPlane('XY', z) as Sketch;
}

/**
 * Build a single pocket cutter at the origin using multi-section loft.
 *
 * Walks the pocket profile downward from Z=0 (the plate's top face), topped
 * by an extension above the block that avoids coplanar boolean failures.
 *
 * When throughCut is true the cutter extends past the profile to clear the
 * whole slab; when false the pocket stops at its floor, leaving material for
 * magnet or screw holes.
 *
 * `belowSocketMm` is the solid depth under the pocket the cut must still clear.
 * It was implicitly zero while through-cutting only ever happened on a floorless
 * plate, but a mount-down screw pad makes the slab taller while other
 * cells stay through-cut, and a fixed 1mm extension would leave those cells a
 * floor they were never meant to have.
 */
function buildPocketCutter(
  cellW_mm: number,
  cellD_mm: number,
  throughCut: boolean,
  belowSocketMm: number,
  profileHeight: number
): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const s = (z: number, inset: number): Sketch =>
    pocketSection(cellW_mm, cellD_mm, cornerR, z, inset);

  const s0 = s(COPLANAR_MARGIN, 0);
  const sections = pocketProfileFor(profileHeight).map(([depth, inset]) => s(-depth, inset));

  if (throughCut) {
    sections.push(s(-profileHeight - belowSocketMm - COPLANAR_MARGIN, POCKET_INSET_BOT));
  }

  return s0.loftWith(sections, { ruled: true });
}

/**
 * Get or build a pocket template for the given cell dimensions.
 * Returns a clone of the cached template (safe for translate).
 */
export function getPocketTemplate(
  cellW_mm: number,
  cellD_mm: number,
  throughCut: boolean,
  belowSocketMm = 0,
  profileHeight: number = PLATE_PROFILE_HEIGHT
): Shape3D {
  const key = pocketCacheKey(cellW_mm, cellD_mm, throughCut, belowSocketMm, profileHeight);
  const cached = pocketTemplateCache.get(key);
  if (cached !== undefined) {
    return unwrap(clone(cached));
  }
  const template = buildPocketCutter(cellW_mm, cellD_mm, throughCut, belowSocketMm, profileHeight);
  pocketTemplateCache.set(key, template);
  return unwrap(clone(template));
}
