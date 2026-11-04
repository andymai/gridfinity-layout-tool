import { describe, expect, it } from 'vitest';
import { SLANT_SIDES } from '@/core/types';
import { designId, gridUnits } from '@/core/types';
import {
  canHalfTurn,
  isTurnedPlacement,
  oppositeSide,
  overhangInDesign,
  placedSideInDesign,
  sideInDesign,
  sideInPlacement,
} from './placementTurn';

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

describe('canHalfTurn', () => {
  const linked = {
    linkedDesignId: designId('d1'),
    width: gridUnits(2),
    depth: gridUnits(1),
  };

  it('is true for a linked bin on whole units', () => {
    expect(canHalfTurn(linked)).toBe(true);
  });

  it('is false for a bin with no design to look different', () => {
    expect(canHalfTurn({ ...linked, linkedDesignId: undefined })).toBe(false);
  });

  it('is false for half of a pair, which stands where its partner needs it', () => {
    expect(canHalfTurn({ ...linked, pairId: 'p1' })).toBe(false);
  });

  it('is false on a half-unit footprint, whose whole feet would land off the grid', () => {
    expect(canHalfTurn({ ...linked, width: gridUnits(1.5) })).toBe(false);
    expect(canHalfTurn({ ...linked, depth: gridUnits(1.5) })).toBe(false);
  });
});

describe('placedSideInDesign', () => {
  const design = { width: 2, depth: 1 };
  const asDrawn = { width: gridUnits(2), depth: gridUnits(1) };
  const turned = { width: gridUnits(1), depth: gridUnits(2) };

  it.each(SLANT_SIDES)('leaves %s alone on a design standing as drawn', (side) => {
    expect(placedSideInDesign(side, asDrawn, design)).toBe(side);
  });

  it.each(SLANT_SIDES)('maps %s through a quarter turn', (side) => {
    expect(placedSideInDesign(side, turned, design)).toBe(sideInDesign(side));
  });

  it.each(SLANT_SIDES)('faces %s the other way on a half turn', (side) => {
    expect(placedSideInDesign(side, { ...asDrawn, halfTurned: true }, design)).toBe(
      oppositeSide(side)
    );
  });

  it.each(SLANT_SIDES)('composes both turns for %s', (side) => {
    expect(placedSideInDesign(side, { ...turned, halfTurned: true }, design)).toBe(
      oppositeSide(sideInDesign(side))
    );
  });
});

describe('overhangInDesign', () => {
  const overhang = { left: 1, right: 2, front: 3, back: 4, enabled: true, feet: true };

  it('leaves an overhang alone on a bin that has not half turned', () => {
    expect(overhangInDesign(overhang, {})).toBe(overhang);
    expect(overhangInDesign(overhang, { halfTurned: false })).toBe(overhang);
  });

  it('takes a taper round with the overhang it belongs to', () => {
    const taper = {
      profile: 'chamfer' as const,
      bandHeight: 8,
      left: 2,
      right: 0,
      front: 0,
      back: 1,
    };
    expect(overhangInDesign({ ...overhang, taper }, { halfTurned: true }).taper).toEqual({
      profile: 'chamfer',
      bandHeight: 8,
      left: 0,
      right: 2,
      front: 1,
      back: 0,
    });
  });

  it('swaps opposite sides on a half-turned bin and keeps the rest', () => {
    expect(overhangInDesign(overhang, { halfTurned: true })).toEqual({
      left: 2,
      right: 1,
      front: 4,
      back: 3,
      enabled: true,
      feet: true,
    });
  });
});
