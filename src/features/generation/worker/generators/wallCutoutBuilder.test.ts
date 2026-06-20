import { describe, it, expect } from 'vitest';
import { computeInteriorDividerCutouts } from './wallCutoutBuilder';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, DividerOverride } from '@/features/bin-designer/types';

const INNER_W = 80;
const INNER_D = 40;
const WALL_HEIGHT = 21;

/** Bin with the interior-divider cutout enabled and a given compartment grid. */
function makeParams(
  compartments: Partial<BinParams['compartments']>,
  overrides?: DividerOverride[]
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    walls: {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      // Reuse the enabled left-wall cutout shape (width/depth + position) for interior.
      interior: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true },
    },
    compartments: {
      ...DEFAULT_BIN_PARAMS.compartments,
      ...compartments,
      ...(overrides ? { dividerOverrides: overrides } : {}),
    },
  };
}

describe('computeInteriorDividerCutouts', () => {
  it('returns nothing when there is only one compartment', () => {
    const params = makeParams({ cols: 1, rows: 1, cells: [0] });
    expect(computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('returns nothing when the interior cutout is disabled', () => {
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    const disabled: BinParams = {
      ...params,
      walls: { ...params.walls, interior: { ...params.walls.interior, enabled: false } },
    };
    expect(computeInteriorDividerCutouts(disabled, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('places a straight vertical divider cutout on the grid line (rotateZ 90)', () => {
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    const cuts = computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].x).toBeCloseTo(0, 6); // boundary 1 of 2 → centre
    expect(cuts[0].rotateZ).toBe(90);
  });

  it('translates the cutout when the divider is shifted (equal offsets)', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 5,
      offsetEnd: 5,
    };
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    // Pure translation: midpoint shifts by the offset, no rotation.
    expect(cut.x).toBeCloseTo(5, 6);
    expect(cut.rotateZ).toBeCloseTo(90, 6);
  });

  it('rotates the cutout to follow a tilted vertical divider', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 5,
      offsetEnd: -5,
    };
    const params = makeParams({ cols: 2, rows: 1, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    // segLen = 1 cell = INNER_D/1 = 40; dx = offsetEnd - offsetStart = -10.
    const expected = (Math.atan2(40, -10) * 180) / Math.PI;
    expect(cut.x).toBeCloseTo(0, 6); // symmetric tilt → midpoint unchanged
    expect(cut.rotateZ).toBeCloseTo(expected, 4);
    expect(cut.rotateZ).not.toBe(90); // the regression: it used to stay axis-aligned
  });

  it('rotates the cutout to follow a tilted horizontal divider', () => {
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 4,
      offsetEnd: -4,
    };
    const params = makeParams({ cols: 1, rows: 2, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    // Horizontal segLen = 1 cell = INNER_W/1 = 80; dy = -8.
    const expected = (Math.atan2(-8, 80) * 180) / Math.PI;
    expect(cut.y).toBeCloseTo(0, 6);
    expect(cut.rotateZ).toBeCloseTo(expected, 4);
    expect(cut.rotateZ).not.toBe(0); // the regression: it used to stay axis-aligned
  });
});
