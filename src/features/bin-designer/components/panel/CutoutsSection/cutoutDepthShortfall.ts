/**
 * Detects when a cutout's requested cut depth cannot be fully generated.
 *
 * The worker clips every tool to the bin interior and cuts at most the
 * remaining fill (`effectiveDepth = min(cutDepth, fill surface)`), so a cut
 * can silently come out shallower than the number in the inspector: the plain
 * vertical case when the bin shrinks under a stored depth, and the leaned case
 * where the pocket's floor slides sideways into a wall or through the bin's
 * own floor before reaching full depth.
 *
 * The floor position mirrors the tool math (`applyCutoutLean` + plan
 * rotation): each footprint corner's floor point is linear in the depth D, so
 * every interior face yields a linear bound on D and the achievable depth is
 * their minimum. The footprint box stands in for the exact outline, which is
 * slightly conservative for round shapes — a warning threshold, not geometry.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { resolveCutoutLeanDeg } from '@/features/bin-designer/types';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';

export interface DepthShortfall {
  readonly requested: number;
  /** Depth (mm) the generator can actually reach before clipping, >= 0. */
  readonly achievable: number;
}

/** Ignore sub-tenth-mm float noise; a shortfall below this is not worth a warning. */
const SHORTFALL_TOLERANCE_MM = 0.1;

/** Slack for "the mouth itself is off the board" — the off-board cue owns that. */
const BOARD_EDGE_TOLERANCE_MM = 0.01;

/**
 * Returns the shortfall for a cutout, or null when the full requested depth
 * generates (or when the judgment is not this module's to make: mesh imprints
 * cut in the mesh domain, and a mouth already off the board is the off-board
 * warning's case). A repeat master answers for every instance — the worker
 * cuts them all, so the reported depth is the worst instance's.
 */
export function cutoutDepthShortfall(
  cutout: Cutout,
  binWidth: number,
  binDepth: number,
  fillSurface: number
): DepthShortfall | null {
  if (cutout.shape === 'mesh' || cutout.shape === 'text') return null;
  const requested = cutout.cutDepth;
  if (!(requested > 0) || cutout.width <= 0 || cutout.depth <= 0) return null;

  let achievable = requested;
  for (const instance of expandCutoutArray(cutout)) {
    const instAchievable = instanceAchievableDepth(instance, binWidth, binDepth, fillSurface);
    if (instAchievable !== null) achievable = Math.min(achievable, instAchievable);
  }

  if (achievable >= requested - SHORTFALL_TOLERANCE_MM) return null;
  return { requested, achievable };
}

/**
 * Depth one concrete instance can reach before clipping, or null when its
 * mouth is already off the board (the off-board cue's case, not ours).
 */
function instanceAchievableDepth(
  cutout: Cutout,
  binWidth: number,
  binDepth: number,
  fillSurface: number
): number | null {
  const lean = (resolveCutoutLeanDeg(cutout) * Math.PI) / 180;
  const sinL = Math.sin(lean);
  const cosL = Math.cos(lean);
  const rad = (-cutout.rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  const hw = cutout.width / 2;
  const hd = cutout.depth / 2;

  let achievable = cutout.cutDepth;
  const bound = (value: number): void => {
    achievable = Math.min(achievable, Math.max(0, value));
  };

  for (const px of [-hw, hw]) {
    for (const py of [-hd, hd]) {
      // NOMINAL footprint corner already outside the board: the off-board
      // warning's case, judged on the same un-leaned footprint it measures so
      // the two warnings cannot both fire for one corner.
      const nominalX = cx + px * cosR - py * sinR;
      const nominalY = cy + px * sinR + py * cosR;
      if (
        nominalX < -BOARD_EDGE_TOLERANCE_MM ||
        nominalX > binWidth + BOARD_EDGE_TOLERANCE_MM ||
        nominalY < -BOARD_EDGE_TOLERANCE_MM ||
        nominalY > binDepth + BOARD_EDGE_TOLERANCE_MM
      ) {
        return null;
      }

      // Floor corner at depth D: q = py·cos(lean) + D·sin(lean) along the
      // local tilt axis, then plan-rotated. Linear in D on every axis.
      const bx = cx + px * cosR - py * cosL * sinR;
      const ax = -sinL * sinR;
      const by = cy + px * sinR + py * cosL * cosR;
      const ay = sinL * cosR;

      // Interior floor: z = fillSurface + py·sin(lean) − D·cos(lean) >= 0.
      bound((fillSurface + py * sinL) / cosL);
      // Interior walls: bx + ax·D in [0, binWidth], by + ay·D in [0, binDepth].
      if (ax > Number.EPSILON) bound((binWidth - bx) / ax);
      else if (ax < -Number.EPSILON) bound(bx / -ax);
      if (ay > Number.EPSILON) bound((binDepth - by) / ay);
      else if (ay < -Number.EPSILON) bound(by / -ay);
    }
  }

  return achievable;
}
