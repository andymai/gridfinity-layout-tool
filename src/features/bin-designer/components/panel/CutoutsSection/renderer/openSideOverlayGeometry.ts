/**
 * Top-down outlines of the channels the design's open sides cut, for the 2D
 * cutout editor: one strip per opening from the shape's edge out past the
 * wall, so the pocket visibly runs out of the block the moment a side is
 * opened. The editor's frame is the interior, so the strip crosses
 * `wallThickness` of wall and then spills a little further: a pocket flush
 * against its wall would otherwise show a sliver one wall thick, which at
 * editor zoom is a hairline, not an opening.
 */

import { openSideChannels } from '@/shared/utils/cutoutOpenSides';
import type { OpenSideHost } from '@/shared/utils/cutoutOpenSides';

/** How far past the wall's outer face the strip runs (mm). */
export const OPEN_SIDE_SPILL_MM = 6;

/** A closed outline in world (bin-interior) mm coordinates. */
export type OpenSideOverlayLoop = readonly (readonly [number, number])[];

export interface OpenSideOverlayStrip {
  readonly loop: OpenSideOverlayLoop;
  /** A tunnel keeps the wall above the pocket, so its strip is drawn hollow. */
  readonly tunnel: boolean;
}

export interface OpenSideOverlayFrame {
  readonly binWidth: number;
  readonly binDepth: number;
  readonly wallThickness: number;
}

/**
 * Every channel strip the design carries, in world mm. Planned by the same
 * function the worker cuts from, so the overlay never shows a breach the part
 * will not have.
 */
export function openSideOverlayStrips(
  host: OpenSideHost,
  frame: OpenSideOverlayFrame
): readonly OpenSideOverlayStrip[] {
  const past = frame.wallThickness + OPEN_SIDE_SPILL_MM;
  return openSideChannels(host).map((ch) => {
    // A custom shape's wall face comes with the channel; a rectangle's is the
    // board's edge plus the wall.
    const end = (fallback: number, sign: 1 | -1): number =>
      ch.faceMm === undefined ? fallback : ch.faceMm + sign * OPEN_SIDE_SPILL_MM;
    switch (ch.side) {
      case 'right':
        return {
          tunnel: ch.tunnel,
          loop: strip(ch.edge, end(frame.binWidth + past, 1), ch.lo, ch.hi),
        };
      case 'left':
        return { tunnel: ch.tunnel, loop: strip(end(-past, -1), ch.edge, ch.lo, ch.hi) };
      case 'back':
        return {
          tunnel: ch.tunnel,
          loop: strip(ch.lo, ch.hi, ch.edge, end(frame.binDepth + past, 1)),
        };
      case 'front':
        return { tunnel: ch.tunnel, loop: strip(ch.lo, ch.hi, end(-past, -1), ch.edge) };
    }
  });
}

function strip(x0: number, x1: number, y0: number, y1: number): OpenSideOverlayLoop {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
