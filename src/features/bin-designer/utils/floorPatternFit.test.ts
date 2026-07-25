import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '../constants';
import type { BinParams } from '../types';
import { assessFloorPatternFit } from './floorPatternFit';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    floorPattern: { enabled: true, pattern: 'round', scale: 0.5 },
    ...overrides,
  };
}

describe('assessFloorPatternFit', () => {
  it('is unavailable when the feature is off or absent', () => {
    expect(
      assessFloorPatternFit(makeParams({ floorPattern: { enabled: false, pattern: 'round' } }))
    ).toBe('unavailable');
    expect(assessFloorPatternFit(makeParams({ floorPattern: undefined }))).toBe('unavailable');
  });

  it('is unavailable on the bins the generator refuses', () => {
    expect(
      assessFloorPatternFit(makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } }))
    ).toBe('unavailable');
    expect(
      assessFloorPatternFit(
        makeParams({ style: 'solid', base: { ...DEFAULT_BIN_PARAMS.base, solid: true } })
      )
    ).toBe('unavailable');
  });

  it('fits a standard foot at neutral scale', () => {
    expect(assessFloorPatternFit(makeParams())).toBe('fits');
  });

  it('reports no fit when the element outgrows the window', () => {
    // A half-socket foot is a quarter of a cell; a thick wall widens the inset
    // on top of that, so the boldest honeycomb has nowhere to land.
    expect(
      assessFloorPatternFit(
        makeParams({
          height: 10,
          wallThickness: 4,
          floorPattern: { enabled: true, pattern: 'honeycomb', scale: 1 },
          base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
        })
      )
    ).toBe('none');
  });

  it('measures a flat base against the whole cavity floor', () => {
    // The same element that cannot fit a quarter foot fits easily once the
    // socket constraint is gone.
    const bold = {
      height: 10,
      wallThickness: 4,
      floorPattern: { enabled: true, pattern: 'honeycomb', scale: 1 },
    } as const;
    expect(
      assessFloorPatternFit(
        makeParams({ ...bold, base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } })
      )
    ).toBe('none');
    expect(
      assessFloorPatternFit(
        makeParams({ ...bold, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } })
      )
    ).toBe('fits');
  });
});
