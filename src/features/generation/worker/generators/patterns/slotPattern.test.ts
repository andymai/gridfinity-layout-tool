import { describe, it, expect } from 'vitest';
import { SlotPatternCalculator, createSlotCalculator } from './slotPattern';

describe('SlotPatternCalculator', () => {
  it('rejects invalid construction', () => {
    expect(() => new SlotPatternCalculator(0)).toThrow('slotWidth must be positive');
  });

  it('lays out a single row of columns (all centers at y = 0)', () => {
    const calc = new SlotPatternCalculator(3);
    const centers = calc.calculateCenters({ fillW: 60, fillH: 40 });
    expect(centers.length).toBeGreaterThan(1);
    for (const c of centers) expect(c.y).toBe(0);
  });

  it('sizes the rect to the full fill height and rounds its corners', () => {
    const calc = new SlotPatternCalculator(3);
    const d = calc.getShapeDescriptor({ fillW: 60, fillH: 40 });
    expect(d).toEqual({ kind: 'rect', width: 3, height: 40, cornerRadius: expect.any(Number) });
    if (d.kind === 'rect') {
      expect(d.cornerRadius).toBeGreaterThan(0);
      expect(d.cornerRadius).toBeLessThanOrEqual(d.width / 2);
    }
  });

  it('reports a horizontal half-width bound (not the tall half-diagonal)', () => {
    // A full-height half-diagonal would over-clip near dividers.
    expect(new SlotPatternCalculator(3).getShapeRadius()).toBe(1.5);
  });

  it('returns no centers when the wall is too short for a slot', () => {
    expect(new SlotPatternCalculator(3).calculateCenters({ fillW: 60, fillH: 2 })).toEqual([]);
  });
});

describe('createSlotCalculator', () => {
  it('scales slot width with the scale slider', () => {
    expect(createSlotCalculator(5, 0.2).slotWidth).toBeLessThan(
      createSlotCalculator(5, 0.9).slotWidth
    );
  });
});
