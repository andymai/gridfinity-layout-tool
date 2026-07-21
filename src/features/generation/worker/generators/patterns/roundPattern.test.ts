import { describe, it, expect } from 'vitest';
import { RoundPatternCalculator, createRoundCalculator, ROUND_SIDES } from './roundPattern';

describe('RoundPatternCalculator', () => {
  it('rejects invalid construction', () => {
    expect(() => new RoundPatternCalculator(0)).toThrow('radius must be positive');
    expect(() => new RoundPatternCalculator(2, -1)).toThrow('webThickness must be non-negative');
  });

  it('describes a many-sided polygon approximating a circle', () => {
    const calc = new RoundPatternCalculator(2);
    expect(calc.getShapeDescriptor()).toEqual({ kind: 'polygon', radius: 2, sides: ROUND_SIDES });
    expect(calc.getShapeRadius()).toBe(2);
    expect(calc.getPatternType()).toBe('round');
  });

  it('packs centers strictly within the fill bounds', () => {
    const calc = new RoundPatternCalculator(2);
    const centers = calc.calculateCenters({ fillW: 40, fillH: 30 });
    expect(centers.length).toBeGreaterThan(0);
    for (const c of centers) {
      expect(Math.abs(c.x)).toBeLessThanOrEqual(40 / 2 - 2 + 1e-9);
      expect(Math.abs(c.y)).toBeLessThanOrEqual(30 / 2 - 2 + 1e-9);
    }
  });

  it('returns no centers when the fill area is too small', () => {
    expect(new RoundPatternCalculator(4).calculateCenters({ fillW: 3, fillH: 3 })).toEqual([]);
  });
});

describe('createRoundCalculator', () => {
  it('scales radius up with the scale slider', () => {
    expect(createRoundCalculator(5, 0.2).getShapeRadius()).toBeLessThan(
      createRoundCalculator(5, 0.9).getShapeRadius()
    );
  });
});
