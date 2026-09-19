/**
 * Top-down outlines of the channels an open-sided rectangle cuts through the
 * bin's walls, for the 2D cutout editor: one strip per open side from the
 * pocket's edge out past the wall, so the pocket visibly runs out of the block
 * the moment a side is opened. The editor's frame is the interior, so the
 * strip crosses `wallThickness` of wall and then spills a little further: a
 * pocket flush against its wall would otherwise show a sliver one wall thick,
 * which at editor zoom is a hairline, not an opening.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { effectiveOpenSides, rectangleWorldHalfExtents } from '@/shared/utils/cutoutOpenSides';
import type { OpenSideHost } from '@/shared/utils/cutoutOpenSides';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';

/** How far past the wall's outer face the strip runs (mm). */
export const OPEN_SIDE_SPILL_MM = 6;

/** A closed outline in world (bin-interior) mm coordinates. */
export type OpenSideOverlayLoop = readonly (readonly [number, number])[];

export interface OpenSideOverlayFrame {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly wallThickness: number;
}

/**
 * The channel strips a cutout's open sides carry, in world mm. Empty for a
 * cutout the builder would leave enclosed, so the overlay never shows a breach
 * the part will not have. Repeat arrays draw one strip per copy.
 */
export function openSideOverlayLoops(
  cutout: Cutout,
  host: OpenSideHost,
  frame: OpenSideOverlayFrame
): readonly OpenSideOverlayLoop[] {
  const sides = effectiveOpenSides(cutout, host);
  if (sides.length === 0) return [];
  const past = frame.wallThickness + OPEN_SIDE_SPILL_MM;
  const loops: OpenSideOverlayLoop[] = [];
  for (const inst of cutout.array ? expandCutoutArray(cutout) : [cutout]) {
    const { halfX, halfY } = rectangleWorldHalfExtents(inst);
    const cx = inst.x + inst.width / 2;
    const cy = inst.y + inst.depth / 2;
    for (const side of sides) {
      switch (side) {
        case 'right':
          loops.push(strip(cx + halfX, frame.binWidth + past, cy - halfY, cy + halfY));
          break;
        case 'left':
          loops.push(strip(-past, cx - halfX, cy - halfY, cy + halfY));
          break;
        case 'back':
          loops.push(strip(cx - halfX, cx + halfX, cy + halfY, frame.binDepth + past));
          break;
        case 'front':
          loops.push(strip(cx - halfX, cx + halfX, -past, cy - halfY));
          break;
      }
    }
  }
  return loops;
}

function strip(x0: number, x1: number, y0: number, y1: number): OpenSideOverlayLoop {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
