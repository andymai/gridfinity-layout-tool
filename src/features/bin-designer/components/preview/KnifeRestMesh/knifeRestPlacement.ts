/**
 * Preview-side placement for the companion handle rest.
 *
 * The step past the block comes from `knifeRestMatedOffset`, so the preview
 * and the export assembly cannot disagree about where the part stands; only
 * the explode slider and the preview's own Z nudge live here.
 *
 * This file must contain only pure functions (no React) so the consuming
 * component file stays react-refresh friendly.
 */

import type { BinParams } from '@/features/bin-designer/types';
import type { KnifeRestPlan } from '@/shared/utils/knifeRestPlan';
import { knifeRestMatedOffset } from '@/shared/utils/knifeRestPlan';
import { PREVIEW_Z_OFFSET } from '../LidMesh/lidAnchorZ';

/**
 * Where the rest's own mesh origin lands in the block's preview frame: mated
 * beside the block, pushed a further `offsetMm` along the same axis.
 *
 * Z is the block's own group nudge rather than anything derived: both solids
 * are built Z=0-bottom, so standing them on one ground plane is exactly
 * sharing the offset `BinMesh` already carries.
 */
export function knifeRestGroupPosition(
  params: BinParams,
  plan: KnifeRestPlan,
  offsetMm: number
): [number, number, number] {
  const mated = knifeRestMatedOffset(params, plan);
  // The explode direction is read off the mated step instead of re-derived
  // from `plan.side`, so "away from the block" has a single definition.
  const stepLength = Math.hypot(mated.x, mated.y);
  const unitX = stepLength === 0 ? 0 : mated.x / stepLength;
  const unitY = stepLength === 0 ? 0 : mated.y / stepLength;
  return [mated.x + unitX * offsetMm, mated.y + unitY * offsetMm, PREVIEW_Z_OFFSET];
}
