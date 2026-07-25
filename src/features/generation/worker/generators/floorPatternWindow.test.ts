import { describe, it, expect } from 'vitest';
import { FLOOR_PATTERN_BORDER, floorWindowInset, floorWindowSpan } from './floorPatternWindow';
import { CLEARANCE, INSET_BOT, SIZE } from './generatorConstants';

describe('floorWindowInset', () => {
  it('clears the foot underside when the wall is thinner than the taper', () => {
    expect(floorWindowInset(1.2)).toBeCloseTo(FLOOR_PATTERN_BORDER + INSET_BOT, 6);
  });

  it('clears the wall instead once it is thicker than the taper', () => {
    const thick = INSET_BOT + 1;
    expect(floorWindowInset(thick)).toBeCloseTo(FLOOR_PATTERN_BORDER + thick, 6);
  });

  it('never drops below the foot rule, whatever the wall', () => {
    for (const wallThickness of [0, 0.4, 0.8, 1.2, 2.4, 4, 8]) {
      expect(floorWindowInset(wallThickness)).toBeGreaterThanOrEqual(INSET_BOT);
    }
  });
});

describe('floorWindowSpan', () => {
  it('leaves the foot underside intact on a standard cell', () => {
    // The underside starts INSET_BOT in from the cell edge; the window must
    // finish inside it or a hole exits through the baseplate-mating taper.
    const span = floorWindowSpan(1, SIZE, 1.2);
    const flatSpan = SIZE - CLEARANCE - 2 * INSET_BOT;
    expect(span).toBeGreaterThan(0);
    expect(span).toBeLessThan(flatSpan);
  });

  it('scales with the cell — a half socket gets a narrower window', () => {
    expect(floorWindowSpan(0.5, SIZE, 1.2)).toBeLessThan(floorWindowSpan(1, SIZE, 1.2));
  });

  it('collapses to zero rather than going negative on a cell that cannot host one', () => {
    expect(floorWindowSpan(0.5, SIZE, 12)).toBe(0);
  });
});
