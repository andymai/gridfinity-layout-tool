import { describe, it, expect } from 'vitest';
import type { CellInfo } from './cellDecomposition';
import { keepFootHolesOffFlank, magnetPositionsForCell } from './magnetPositions';

const PITCH = 42;
const FULL: CellInfo = { centerX: -21, centerY: 0, widthUnits: 1, depthUnits: 1 };

describe('keepFootHolesOffFlank', () => {
  it('returns the very same coordinates when every hole keeps its wall', () => {
    const spec = magnetPositionsForCell(FULL, 3.25, PITCH, PITCH);
    const kept = keepFootHolesOffFlank(spec, FULL, 3.25, PITCH, PITCH);
    kept.forEach(([x, y], i) => {
      expect(Object.is(x, spec[i][0])).toBe(true);
      expect(Object.is(y, spec[i][1])).toBe(true);
    });
  });

  it('pulls every corner of a foot in by the same amount, around its centre', () => {
    const spec = magnetPositionsForCell(FULL, 5, PITCH, PITCH);
    const kept = keepFootHolesOffFlank(spec, FULL, 5, PITCH, PITCH);
    const rounded = kept.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    expect(rounded).toEqual([
      [-33.4, -12.4],
      [-8.6, -12.4],
      [-8.6, 12.4],
      [-33.4, 12.4],
    ]);
  });

  it("keeps a half foot's centred hole centred and pulls it in on the full axis", () => {
    const half: CellInfo = { centerX: 21, centerY: 0, widthUnits: 0.5, depthUnits: 1 };
    const kept = keepFootHolesOffFlank([[21, 13]], half, 5, PITCH, PITCH);
    expect(kept[0][0]).toBe(21);
    expect(kept[0][1]).toBeCloseTo(12.4, 9);
  });
});
