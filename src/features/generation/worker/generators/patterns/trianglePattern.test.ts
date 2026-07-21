import { describe, it, expect } from 'vitest';
import { TrianglePatternCalculator, createTriangleCalculator } from './trianglePattern';

describe('TrianglePatternCalculator', () => {
  it('rejects invalid construction', () => {
    expect(() => new TrianglePatternCalculator(0)).toThrow('radius must be positive');
  });

  it('describes a 3-sided polygon with per-center flip (no baked rotation)', () => {
    const calc = new TrianglePatternCalculator(2);
    expect(calc.getShapeDescriptor()).toEqual({ kind: 'polygon', radius: 2, sides: 3 });
    expect(calc.getPatternType()).toBe('triangle');
  });

  it('alternates apex-up / apex-down across the field', () => {
    const calc = new TrianglePatternCalculator(2);
    const centers = calc.calculateCenters({ fillW: 50, fillH: 50 });
    expect(centers.length).toBeGreaterThan(1);
    const rotations = new Set(centers.map((c) => c.rotation));
    // Both orientations present → apex-up (0°) / apex-down (180°) checkerboard.
    expect(rotations.has(0)).toBe(true);
    expect(rotations.has(180)).toBe(true);
  });

  it('returns no centers when the fill area is too small', () => {
    expect(new TrianglePatternCalculator(4).calculateCenters({ fillW: 3, fillH: 3 })).toEqual([]);
  });
});

describe('createTriangleCalculator', () => {
  it('scales radius with the scale slider', () => {
    expect(createTriangleCalculator(5, 0.2).getShapeRadius()).toBeLessThan(
      createTriangleCalculator(5, 0.9).getShapeRadius()
    );
  });
});
