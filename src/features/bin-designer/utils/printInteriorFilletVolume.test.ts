import { describe, it, expect } from 'vitest';
import { computeInteriorFilletVolume } from './printInteriorFilletVolume';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { computeInteriorHeight } from '@/shared/utils/scoopCalculations';
import { resolveBinFloorMm } from '@/shared/utils/slotMath';
import { baseWallHeight } from './binDimensions';

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

describe('computeInteriorFilletVolume on a custom shape', () => {
  const lShape = {
    cols: 4,
    rows: 4,
    cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] as (0 | 1)[],
  };

  it('prices the mask outline, at the shell corners it already has', () => {
    const l = computeInteriorFilletVolume(
      bin({ width: 2, depth: 2, interiorFilletMm: 2.5, cellMask: lShape }),
      83.5,
      83.5
    );
    // An L cut from the corner of an 84mm square keeps the square's perimeter.
    const perimeter = 4 * 84;
    expect(l).toBeCloseTo(CROSS_SECTION * 2.5 * 2.5 * perimeter, 6);
  });

  it('stands its corner columns on the standard floor', () => {
    const params = bin({ width: 2, depth: 2, interiorFilletMm: 4, cellMask: lShape });
    const l = computeInteriorFilletVolume(params, 83.5, 83.5);
    const wallTop = baseWallHeight(params.base, params.height * params.heightUnitMm);
    const floorToTop =
      computeInteriorHeight(wallTop, params.base.stackingLip, GRIDFINITY.LIP_SMALL_TAPER) -
      resolveBinFloorMm(params);
    const shellCorner = GRIDFINITY.BOX_CORNER_RADIUS - params.wallThickness;
    // The L has five convex corners, every one of them a shell corner.
    const columns = 5 * CROSS_SECTION * (4 * 4 - shellCorner * shellCorner) * floorToTop;
    expect(l).toBeCloseTo(CROSS_SECTION * 4 * 4 * 4 * 84 + columns, 6);
  });
});

describe('a slotted bin', () => {
  it('counts the fillet the pieces leave room for, not the one asked for', () => {
    // Slots every 10 mm hold the fillet well under the 15 mm asked for.
    const params = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 6,
      interiorFilletMm: 15,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 10 },
        y: { enabled: false, pitch: 10 },
      },
    };
    const outer = 2 * 42 - 0.5;
    const asked = computeInteriorFilletVolume({ ...params, style: 'standard' }, outer, outer);
    const held = computeInteriorFilletVolume({ ...params, style: 'slotted' }, outer, outer);
    expect(held).toBeGreaterThan(0);
    expect(held).toBeLessThan(asked * 0.5);
    // Fully unclamped, the two would match.
  });
});
