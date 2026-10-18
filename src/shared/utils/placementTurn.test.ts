import { describe, expect, it } from 'vitest';
import { SLANT_SIDES } from '@/core/types';
import { isTurnedPlacement, sideInDesign, sideInPlacement } from './placementTurn';

describe('isTurnedPlacement', () => {
  it('is true when the footprint swaps the design width and depth', () => {
    expect(isTurnedPlacement({ width: 1, depth: 2 }, { width: 2, depth: 1 })).toBe(true);
    expect(isTurnedPlacement({ width: 2, depth: 1 }, { width: 2, depth: 1 })).toBe(false);
  });

  it('never turns a square design, nor a footprint of another size', () => {
    expect(isTurnedPlacement({ width: 2, depth: 2 }, { width: 2, depth: 2 })).toBe(false);
    expect(isTurnedPlacement({ width: 1, depth: 3 }, { width: 2, depth: 1 })).toBe(false);
  });
});

describe('turned sides', () => {
  it('turns counterclockwise: right faces back, back faces left', () => {
    expect(sideInPlacement('right')).toBe('back');
    expect(sideInPlacement('back')).toBe('left');
  });

  it('undoes itself', () => {
    for (const side of SLANT_SIDES) expect(sideInDesign(sideInPlacement(side))).toBe(side);
  });
});
