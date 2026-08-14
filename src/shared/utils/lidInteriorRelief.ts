/**
 * How far a label shelf sinks to stay out of the lid's seating envelope (#3477).
 *
 * A one-line resolver rather than an inline expression, because four things
 * read it — the tab planner, the divider-pattern keep-outs, the ghost overlay
 * and the panel's height readout — and a shelf placed on one plane while its
 * pattern keep-out is computed on another is exactly the drift CLAUDE.md
 * gotcha #9 describes.
 *
 * Separate from `lidKeepout` (which owns the numbers) and from
 * `lidCompatibility` (which owns the gate) so a UI module can ask the question
 * without pulling either in wholesale.
 */

import type { BinParams } from '@/shared/types/bin';
import { interiorReliefActive } from '@/features/bin-designer/utils/lidCompatibility';
import { LID_KEEPOUT_BELOW_CEILING_MM } from '@/shared/constants/lidKeepout';

export function labelShelfKeepoutMm(params: BinParams): number {
  return interiorReliefActive(params) ? LID_KEEPOUT_BELOW_CEILING_MM : 0;
}
