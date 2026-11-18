import { describe, expect, it } from 'vitest';
import { applyGrowUnits } from './useImportGrow';

// A 10-unit grid at 42mm in a 504mm measured drawer.
const axis = (bbox: number) => ({ bbox, bound: 504, grid: 420, pitch: 42 });

describe('applyGrowUnits', () => {
  it('keeps the drawer when the sketch fits', () => {
    expect(applyGrowUnits(10, axis(400))).toBe(10);
  });

  it('grows to hold a sketch past the measured drawer', () => {
    expect(applyGrowUnits(10, axis(520))).toBe(12.5);
  });

  it("grows to an import's size while the sketch passes the grid", () => {
    expect(applyGrowUnits(10, axis(500), 12)).toBe(12);
  });

  it("ignores an import's size once the sketch fits the grid", () => {
    expect(applyGrowUnits(10, axis(400), 12)).toBe(10);
  });
});
