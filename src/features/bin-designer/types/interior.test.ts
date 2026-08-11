import { describe, it, expect } from 'vitest';
import { cardToStyle, deriveInteriorCard, hasMovedWalls, INTERIOR_CARDS } from './interior';
import type { CompartmentConfig } from './compartments';

const grid = (overrides?: Partial<CompartmentConfig>): CompartmentConfig => ({
  cols: 2,
  rows: 2,
  thickness: 1.2,
  cells: [0, 1, 2, 3],
  ...overrides,
});

const movedWall = { compartmentA: 0, compartmentB: 1, offsetStart: -4, offsetEnd: -4 };

describe('cardToStyle', () => {
  it('maps bento onto the standard style', () => {
    expect(cardToStyle('bento')).toBe('standard');
  });

  it('passes every other card through unchanged', () => {
    expect(cardToStyle('standard')).toBe('standard');
    expect(cardToStyle('slotted')).toBe('slotted');
    expect(cardToStyle('solid')).toBe('solid');
  });

  it('maps every card to a real BinStyle', () => {
    for (const card of INTERIOR_CARDS) {
      expect(['standard', 'slotted', 'solid']).toContain(cardToStyle(card));
    }
  });
});

describe('hasMovedWalls', () => {
  it('is false for a plain grid', () => {
    expect(hasMovedWalls(grid())).toBe(false);
  });

  it('is false when the override list is present but empty', () => {
    expect(hasMovedWalls(grid({ dividerOverrides: [] }))).toBe(false);
  });

  it('is true once any wall carries an override', () => {
    expect(hasMovedWalls(grid({ dividerOverrides: [movedWall] }))).toBe(true);
  });
});

describe('deriveInteriorCard', () => {
  it('opens a uniform standard design on Grid Dividers', () => {
    expect(deriveInteriorCard('standard', grid())).toBe('standard');
  });

  it('opens a standard design with moved walls on Bento', () => {
    expect(deriveInteriorCard('standard', grid({ dividerOverrides: [movedWall] }))).toBe('bento');
  });

  it('ignores overrides for non-standard styles', () => {
    // Slotted and solid are their own cards; a stray override must not
    // reroute them to Bento, which cannot represent either.
    expect(deriveInteriorCard('slotted', grid({ dividerOverrides: [movedWall] }))).toBe('slotted');
    expect(deriveInteriorCard('solid', grid({ dividerOverrides: [movedWall] }))).toBe('solid');
  });
});
