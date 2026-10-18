import type { SlantSide } from '@/core/types';

const EPS = 1e-6;

/**
 * A linked bin whose footprint swaps its design's width and depth stands
 * turned a quarter, which the layout's 3D preview draws counterclockwise. A
 * square design never turns.
 */
export function isTurnedPlacement(
  placed: { readonly width: number; readonly depth: number },
  design: { readonly width: number; readonly depth: number }
): boolean {
  return (
    Math.abs(design.width - design.depth) > EPS &&
    Math.abs(placed.width - design.depth) < EPS &&
    Math.abs(placed.depth - design.width) < EPS
  );
}

const COUNTERCLOCKWISE: Record<SlantSide, SlantSide> = {
  right: 'back',
  back: 'left',
  left: 'front',
  front: 'right',
};

const CLOCKWISE: Record<SlantSide, SlantSide> = {
  back: 'right',
  left: 'back',
  front: 'left',
  right: 'front',
};

/** Where a design's side faces once the design stands turned. */
export function sideInPlacement(side: SlantSide): SlantSide {
  return COUNTERCLOCKWISE[side];
}

/** Which side of a turned design faces a given way in the drawer. */
export function sideInDesign(side: SlantSide): SlantSide {
  return CLOCKWISE[side];
}
