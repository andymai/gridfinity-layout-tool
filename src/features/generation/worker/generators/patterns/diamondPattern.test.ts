import { describe, it, expect } from 'vitest';
import { DiamondPatternCalculator, createDiamondCalculator } from './diamondPattern';

describe('DiamondPatternCalculator', () => {
  it('rejects invalid construction', () => {
    expect(() => new DiamondPatternCalculator(0)).toThrow('radius must be positive');
  });

  it('describes an on-point 4-sided polygon (diamond), no rotation needed', () => {
    const calc = new DiamondPatternCalculator(2);
    expect(calc.getShapeDescriptor()).toEqual({ kind: 'polygon', radius: 2, sides: 4 });
    expect(calc.getPatternType()).toBe('diamond');
  });

  it('packs a staggered checkerboard lattice with uniform edge webs', () => {
    const web = 0.8;
    const calc = new DiamondPatternCalculator(2, web);
    const centers = calc.calculateCenters({ fillW: 40, fillH: 40 });
    expect(centers.length).toBeGreaterThan(0);

    const colSpacing = 2 * 2 + web * Math.SQRT2;
    const rows = [...new Set(centers.map((c) => Math.round(c.y * 1000)))].sort((a, b) => a - b);
    expect(rows.length).toBeGreaterThan(2);
    for (let i = 1; i < rows.length; i++) {
      expect((rows[i] - rows[i - 1]) / 1000).toBeCloseTo(colSpacing / 2, 2);
    }

    // Adjacent rows are offset half a column; diagonal neighbors' parallel
    // 45° edges then sit exactly one web thickness apart.
    const xs = (yKey: number): number[] =>
      centers
        .filter((c) => Math.round(c.y * 1000) === yKey)
        .map((c) => c.x)
        .sort((a, b) => a - b);
    const [row0, row1] = [xs(rows[0]), xs(rows[1])];
    expect(Math.abs(row1[0] - row0[0]) % colSpacing).toBeCloseTo(colSpacing / 2, 6);
    const edgeGap = (colSpacing - 2 * 2) / Math.SQRT2;
    expect(edgeGap).toBeCloseTo(web, 6);
  });
});

describe('createDiamondCalculator', () => {
  it('scales radius with the scale slider', () => {
    expect(createDiamondCalculator(5, 0.2).getShapeRadius()).toBeLessThan(
      createDiamondCalculator(5, 0.9).getShapeRadius()
    );
  });
});
