/**
 * Worker-side adapter for the wall-text solver.
 *
 * The solver itself lives in `@/shared/utils/wallTextPlan` so the designer's
 * ghost overlay can run it on the main thread. All this adds is the worker's
 * own font measurer, so a caller inside the pipeline does not have to know one
 * exists.
 */

import type { BinParams } from '@/shared/types/bin';
import {
  computeWallTextLayouts as planWallText,
  type WallTextDims,
  type WallTextLayout,
} from '@/shared/utils/wallTextPlan';
import { getTypeMeasurer } from './textBuilder';

export {
  wallTextReadingSign,
  WALL_TEXT_ENGRAVE_FLOOR,
  WALL_TEXT_MAX_EMBOSS,
} from '@/shared/utils/wallTextPlan';
export type { WallTextDims, WallTextLayout } from '@/shared/utils/wallTextPlan';

export function computeWallTextLayouts(params: BinParams, dim: WallTextDims): WallTextLayout[] {
  return planWallText(params, dim, getTypeMeasurer());
}
