import { describe, it, expect } from 'vitest';
import { computeInteriorFilletVolume } from './printInteriorFilletVolume';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

const OUTER = 41.5;
const CROSS_SECTION = 1 - Math.PI / 4;

function bin(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 4, ...overrides };
}

describe('computeInteriorFilletVolume', () => {
  it('is zero with the fillet off', () => {
    expect(computeInteriorFilletVolume(bin({}), OUTER, OUTER)).toBe(0);
  });

  it('prices a single cavity by its perimeter, the shell already rounding its corners', () => {
    const inner = OUTER - 2 * DEFAULT_BIN_PARAMS.wallThickness;
    const volume = computeInteriorFilletVolume(bin({ interiorFilletMm: 2.5 }), OUTER, OUTER);
    expect(volume).toBeCloseTo(CROSS_SECTION * 2.5 * 2.5 * 4 * inner, 6);
  });

  it('adds a full-height column at every divider junction corner', () => {
    const quartered = computeInteriorFilletVolume(
      bin({
        interiorFilletMm: 2.5,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      }),
      OUTER,
      OUTER
    );
    const merged = computeInteriorFilletVolume(
      bin({
        interiorFilletMm: 2.5,
        compartments: { cols: 2, rows: 2, cells: [0, 0, 0, 0], thickness: 1.2 },
      }),
      OUTER,
      OUTER
    );
    // Twice the floor run, plus twelve corner columns the single cavity lacks.
    expect(quartered).toBeGreaterThan(2 * merged);
  });

  it('stops growing once a radius passes what each compartment can hold', () => {
    const quartered = { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 };
    const at = (r: number): number =>
      computeInteriorFilletVolume(
        bin({ interiorFilletMm: r, compartments: quartered }),
        OUTER,
        OUTER
      );
    expect(at(12)).toBeGreaterThan(at(4));
    expect(at(15)).toBe(at(12));
  });
});
