import { isFractional } from '@/core/constants';
import type { Bin, OverhangConfig, SlantSide } from '@/core/types';

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

const OPPOSITE: Record<SlantSide, SlantSide> = {
  left: 'right',
  right: 'left',
  front: 'back',
  back: 'front',
};

export function oppositeSide(side: SlantSide): SlantSide {
  return OPPOSITE[side];
}

/**
 * Whether a bin can stand half a turn from its footprint. Only a linked bin has
 * a design that looks different turned round. A pair stands where its partner
 * needs it, and a half-unit footprint's whole feet would land off the grid.
 */
export function canHalfTurn(
  bin: Pick<Bin, 'linkedDesignId' | 'pairId' | 'width' | 'depth'>
): boolean {
  return (
    bin.linkedDesignId !== undefined &&
    bin.pairId === undefined &&
    !isFractional(bin.width) &&
    !isFractional(bin.depth)
  );
}

/** Which side of a placed design faces a given way in the drawer, however it stands. */
export function placedSideInDesign(
  side: SlantSide,
  placed: Pick<Bin, 'width' | 'depth' | 'halfTurned'>,
  design: { readonly width: number; readonly depth: number }
): SlantSide {
  const turned = isTurnedPlacement(placed, design) ? sideInDesign(side) : side;
  return placed.halfTurned ? oppositeSide(turned) : turned;
}

/**
 * A placement's overhang is stated in the drawer; the design is built facing its
 * own way. Covers the half turn only: a quarter-turned bin's sides are not
 * remapped here.
 */
export function overhangInDesign(
  overhang: OverhangConfig,
  placed: Pick<Bin, 'halfTurned'>
): OverhangConfig {
  if (!placed.halfTurned) return overhang;
  const { taper } = overhang;
  return {
    ...overhang,
    left: overhang.right,
    right: overhang.left,
    front: overhang.back,
    back: overhang.front,
    ...(taper
      ? {
          taper: {
            ...taper,
            left: taper.right,
            right: taper.left,
            front: taper.back,
            back: taper.front,
          },
        }
      : {}),
  };
}
