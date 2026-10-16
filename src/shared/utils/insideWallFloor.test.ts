// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { floorObstacles } from './insideWallFloor';
import { resolveBinFloorMm } from './slotMath';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

const DIMS = { innerW: 81.1, innerD: 81.1, interiorHeight: 22.55 };

const params = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 4,
  ...over,
});

const grid = (over: Partial<BinParams['compartments']>): BinParams['compartments'] => ({
  ...DEFAULT_BIN_PARAMS.compartments,
  ...over,
});

describe('floorObstacles', () => {
  it('is empty with a flat floor and no fillet', () => {
    expect(floorObstacles(params(), DIMS, 'back')).toEqual([]);
  });

  it('keeps a raised floor and its fillet clear only along its own cells', () => {
    const p = params({
      interiorFilletMm: 2,
      compartments: grid({ cols: 1, rows: 2, cells: [0, 1], floorRaises: [3] }),
    });
    const floor = resolveBinFloorMm(p);
    for (const o of floorObstacles(p, DIMS, 'back')) expect(o.maxZ).toBeCloseTo(floor + 2, 6);
    const [front] = floorObstacles(p, DIMS, 'front');
    expect(front.maxZ).toBeCloseTo(floor + 5, 6);
    const left = floorObstacles(p, DIMS, 'left');
    const raised = left.filter((o) => o.maxZ > floor + 2 + 1e-6);
    expect(raised).toHaveLength(1);
    expect(raised[0].minU).toBeCloseTo(-DIMS.innerD / 2, 6);
    expect(raised[0].maxU).toBeCloseTo(0, 6);
  });

  it("follows the cells against the wall, not a merged compartment's bounding box", () => {
    const p = params({
      compartments: grid({ cols: 2, rows: 2, cells: [0, 0, 0, 1], floorRaises: [6] }),
    });
    const back = floorObstacles(p, DIMS, 'back');
    expect(back).toHaveLength(1);
    expect(back[0].minU).toBeCloseTo(-DIMS.innerW / 2, 6);
    expect(back[0].maxU).toBeCloseTo(0, 6);
  });

  it('holds the fillet to what each compartment can fit, below a short divider', () => {
    const p = params({
      interiorFilletMm: 15,
      compartments: grid({ cols: 2, rows: 1, cells: [0, 1], dividerHeight: 5 }),
    });
    const front = floorObstacles(p, DIMS, 'front');
    expect(front.length).toBeGreaterThan(0);
    for (const o of front) expect(o.maxZ).toBeLessThanOrEqual(5 - 0.5 + 1e-6);
  });

  it('ignores floor raises the generator would not build, and clamps the rest', () => {
    expect(
      floorObstacles(params({ compartments: grid({ floorRaises: [0, 12] }) }), DIMS, 'back')
    ).toEqual([]);
    expect(
      floorObstacles(
        params({ style: 'slotted', compartments: grid({ floorRaises: [6] }) }),
        DIMS,
        'back'
      )
    ).toEqual([]);
    const [clamped] = floorObstacles(
      params({ compartments: grid({ floorRaises: [100] }) }),
      DIMS,
      'back'
    );
    expect(clamped.maxZ).toBeLessThan(DIMS.interiorHeight);
  });

  it('sizes the fillet from the cavity an overhang widens, not the nominal grid', () => {
    const fillet = { interiorFilletMm: 15, width: 0.5, depth: 2, height: 6 };
    const narrow = { innerW: 21 - 0.5 - 2.4, innerD: DIMS.innerD, interiorHeight: 35 };
    const wide = { ...narrow, innerW: narrow.innerW + 20 };
    const [nominal] = floorObstacles(params(fillet), narrow, 'front');
    const [overhung] = floorObstacles(
      params({ ...fillet, overhang: { left: 10, right: 10, front: 0, back: 0, feet: false } }),
      wide,
      'front'
    );
    expect(overhung.maxZ).toBeGreaterThan(nominal.maxZ + 5);
  });

  it('covers the whole wall at full fillet height when a divider is shifted', () => {
    const p = params({
      interiorFilletMm: 15,
      compartments: grid({
        cols: 2,
        rows: 1,
        cells: [0, 1],
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 30, offsetEnd: 30 }],
      }),
    });
    const front = floorObstacles(p, { ...DIMS, interiorHeight: 35 }, 'front');
    expect(front).toHaveLength(1);
    expect(front[0].minU).toBeCloseTo(-DIMS.innerW / 2, 6);
    expect(front[0].maxU).toBeCloseTo(DIMS.innerW / 2, 6);
    expect(front[0].maxZ).toBeGreaterThanOrEqual(resolveBinFloorMm(p) + 14.9);
  });
});
