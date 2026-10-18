/**
 * Main-thread entry point to the sliding-lid plan.
 *
 * `resolveSlideLidPlan` takes measurements, not a design, so that it can be
 * pure and kernel-free. This is the adapter that supplies them from
 * `binDimensions` — which already mirrors the worker's `deriveDimensions` — plus
 * the overhang expansion, so the panel, the compatibility checks and the cutout
 * window all read the same channel the worker builds.
 *
 * The worker has its own adapter over `dimensions`; the two meet at
 * {@link slideLidPlanInput}, which is where the derivations that could disagree
 * (the entry wall's thickness, the cavity's depth) actually live.
 */

import { isPartialMask } from '@/shared/utils/cellMask';
import { wallOpenings } from '@/shared/utils/lipGapPlan';
import { overhangExpansion, resolveOverhang } from '@/shared/utils/overhang';
import {
  resolveSlideLidPlan,
  slideJointDepthBelowWallTopMm,
  slideLidPlanInput,
  type SlideLidPlan,
} from '@/shared/utils/slideLidPlan';
import { liningBand, withLiningOpenings } from '@/shared/utils/slideLidLiningOpenings';
import type { BinParams } from '../types';
import { isSlideLid, resolveLidPlateThickness, resolveLidSlide } from '../types/lid';
import { resolveLipTip } from '../types/base';
import { binDimensions } from './binDimensions';
import { CUTOUT_FILL_STEP_MM, cutoutWallHeightMm, maxCutoutTopOffsetMm } from './cutoutFill';

/**
 * Resolve this design's sliding-lid geometry, or say why it has none.
 *
 * Returns the `'not-slide'` rejection for any other attachment, so callers can
 * ask unconditionally rather than guarding first. Deliberately does NOT consult
 * `shouldGenerateLid`: that reaches `checkLidCompatibility`, which reaches this,
 * and the interior-relief gate has already been round that loop once
 * (CLAUDE.md gotcha #18).
 */
export function slideLidPlanForParams(params: BinParams): SlideLidPlan {
  if (!isSlideLid(params.lid)) return { geometry: null, rejection: 'not-slide' };

  const base = binDimensions(params);
  const polygon = isPartialMask(params.cellMask);
  // Polygon footprints suppress overhang, mirroring the box builder — and the
  // plan refuses them anyway, but the expansion has to be right for the
  // rejection to be reported against the shape the user actually has.
  const expansion = polygon
    ? { addW: 0, addD: 0, offsetX: 0, offsetY: 0 }
    : overhangExpansion(resolveOverhang(params.overhang));

  const plan = resolveSlideLidPlan(
    slideLidPlanInput(
      resolveLidSlide(params.lid),
      resolveLidPlateThickness(params),
      params.wallThickness,
      polygon,
      {
        outerW: base.outerW + expansion.addW,
        outerD: base.outerD + expansion.addD,
        innerW: base.innerW + expansion.addW,
        innerD: base.innerD + expansion.addD,
        innerOffsetX: expansion.offsetX,
        innerOffsetY: expansion.offsetY,
        wallHeight: base.wallHeight,
        hasLip: params.base.stackingLip,
        solidRecessMm: params.style === 'solid' ? params.cutoutConfig.topOffset : null,
        isSlotted: params.style === 'slotted',
        isTile: params.base.tile === true,
        lipTip: resolveLipTip(params.base),
      }
    )
  );

  const { geometry } = plan;
  if (!geometry?.wallLining) return plan;
  const gaps = wallOpenings(params, liningBand(geometry, geometry.wallLining));
  return { ...plan, geometry: withLiningOpenings(geometry, gaps) };
}

/**
 * The fill offset (`cutoutConfig.topOffset`) that leaves a solid bin just room
 * for its sliding lid's channel, or null when lowering the fill would not get
 * one built: the bin is too short for any fill to clear the joint, or the plan
 * refuses it for a reason the fill does not touch.
 *
 * Rounded up to the next fill step strictly past the joint, since the plan
 * refuses a cavity exactly as deep as the joint.
 */
export function slideLidFillOffsetMm(params: BinParams): number | null {
  if (!isSlideLid(params.lid) || params.style !== 'solid') return null;
  const joint = slideJointDepthBelowWallTopMm(
    resolveLidSlide(params.lid),
    resolveLidPlateThickness(params),
    params.base.stackingLip
  );
  const offset = (Math.floor(joint / CUTOUT_FILL_STEP_MM) + 1) * CUTOUT_FILL_STEP_MM;
  if (offset > maxCutoutTopOffsetMm(cutoutWallHeightMm(params))) return null;
  const lowered = { ...params, cutoutConfig: { ...params.cutoutConfig, topOffset: offset } };
  return slideLidPlanForParams(lowered).geometry ? offset : null;
}
