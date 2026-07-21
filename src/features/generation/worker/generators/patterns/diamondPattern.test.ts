import { describe, it, expect } from 'vitest';
import { DiamondPatternCalculator, createDiamondCalculator } from './diamondPattern';

describe('DiamondPatternCalculator', () => {
  it('rejects invalid construction', () => {
    expect(() => new DiamondPatternCalculator(0)).toThrow('radius must be positive');
  });

  it('describes a 4-sided polygon rotated 45° into a diamond', () => {
    const calc = new DiamondPatternCalculator(2);
    expect(calc.getShapeDescriptor()).toEqual({
      kind: 'polygon',
      radius: 2,
      sides: 4,
      rotation: 45,
    });
    expect(calc.getPatternType()).toBe('diamond');
  });

  it('uses an aligned (non-staggered) grid — rows share the same x positions', () => {
    const calc = new DiamondPatternCalculator(2);
    const centers = calc.calculateCenters({ fillW: 40, fillH: 40 });
    expect(centers.length).toBeGreaterThan(0);
    const xsAtY0 = centers.filter((c) => Math.abs(c.y) < 1e-6).map((c) => c.x);
    const ys = [...new Set(centers.map((c) => Math.round(c.y * 1000)))];
    // Every row reuses the same column x-set (no half-column stagger).
    for (const yKey of ys) {
      const xsAtRow = centers
        .filter((c) => Math.round(c.y * 1000) === yKey)
        .map((c) => c.x)
        .sort((a, b) => a - b);
      expect(xsAtRow).toEqual([...xsAtY0].sort((a, b) => a - b));
    }
  });
});

describe('createDiamondCalculator', () => {
  it('scales radius with the scale slider', () => {
    expect(createDiamondCalculator(5, 0.2).getShapeRadius()).toBeLessThan(
      createDiamondCalculator(5, 0.9).getShapeRadius()
    );
  });
});
