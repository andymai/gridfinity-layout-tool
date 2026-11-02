import type { BinParams } from '@/features/bin-designer/types';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import { cutoutDepthFrame } from '@/shared/utils/cutoutDepth';

/**
 * Smallest whole height whose fill holds `depthMm`, or null when none does or
 * the fill is anchored to the floor, where a taller bin only deepens the
 * recess above the fill.
 */
export function heightForCutDepth(params: BinParams, depthMm: number): number | null {
  if (params.cutoutConfig.fillReference === 'floor') return null;
  for (let h = Math.floor(params.height) + 1; h <= DESIGNER_CONSTRAINTS.MAX_HEIGHT; h += 1) {
    if (cutoutDepthFrame({ ...params, height: h }).fillDepthMm >= depthMm) return h;
  }
  return null;
}
