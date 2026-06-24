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

  it('keeps a multi-pair boundary merged into one window when untilted (no regression)', () => {
    // 2×2 grid: the vertical boundary spans pairs 0|1 and 2|3. With no overrides
    // these stay merged into a single centered window per boundary (historical
    // behavior), not one per pair.
    const params = makeParams({ cols: 2, rows: 2, cells: [0, 1, 2, 3] });
    const cuts = computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    expect(cuts).toHaveLength(2); // one vertical + one horizontal
    const vertical = cuts.filter((c) => c.rotateZ === 90);
    const horizontal = cuts.filter((c) => c.rotateZ === 0);
    expect(vertical).toHaveLength(1);
    expect(horizontal).toHaveLength(1);
    expect(vertical[0].x).toBeCloseTo(0, 6);
    expect(vertical[0].y).toBeCloseTo(0, 6); // centered across both rows
  });

  it('splits a multi-pair boundary per pair once a tilt is present', () => {
    // Tilting only pair 0|1 forces the pair-aware path: the vertical boundary
    // now yields a tilted window for 0|1 and a straight one for 2|3.
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: 5,
      offsetEnd: -5,
    };
    const params = makeParams({ cols: 2, rows: 2, cells: [0, 1, 2, 3] }, [override]);
    const cuts = computeInteriorDividerCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    expect(cuts).toHaveLength(4); // 2 vertical (per pair) + 2 horizontal (per pair)
    const tilted = cuts.filter((c) => c.rotateZ !== 90 && c.rotateZ !== 0);
    expect(tilted).toHaveLength(1); // only the 0|1 segment is angled
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

  // ─── Alignment / offset / mm parity with outer walls (discussion #2323) ──
  // A linked outer config (e.g. left-aligned + offset) is copied onto the
  // interior cutout, so the divider window must track it instead of staying
  // centred on the divider midpoint.
  const withInterior = (
    params: BinParams,
    patch: Partial<BinParams['walls']['left']>
  ): BinParams => ({
    ...params,
    walls: { ...params.walls, interior: { ...params.walls.interior, ...patch } },
  });

  it('shifts a vertical divider cutout along Y for left vs right alignment', () => {
    const base = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    const [left] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'left', offset: 0 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    const [center] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'center', offset: 0 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    const [right] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'right', offset: 0 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    // Vertical divider runs along Y (rotateZ 90): alignment moves the window
    // along Y, never off the grid line in X.
    expect(center.y).toBeCloseTo(0, 6);
    expect(left.y).toBeLessThan(center.y);
    expect(right.y).toBeGreaterThan(center.y);
    expect(left.y).toBeCloseTo(-right.y, 6);
    expect(left.x).toBeCloseTo(0, 6);
    expect(right.x).toBeCloseTo(0, 6);
  });

  it('shifts a horizontal divider cutout along X for the offset', () => {
    const base = makeParams({ cols: 1, rows: 2, cells: [0, 1] });
    const [centered] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'center', offset: 0 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    const [offset] = computeInteriorDividerCutouts(
      withInterior(base, { alignment: 'center', offset: 3 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    // Horizontal divider runs along X (rotateZ 0): a +offset slides it +X.
    expect(centered.x).toBeCloseTo(0, 6);
    expect(offset.x).toBeCloseTo(3, 6);
    expect(offset.y).toBeCloseTo(centered.y, 6);
  });

  it('sizes a tilted divider cutout by its true diagonal length, not the projected span', () => {
    // Symmetric ±20mm tilt on a segLen=40 vertical divider → 45° wall whose
    // true length is hypot(40, 40). A 70% window must scale to that length.
    const override: DividerOverride = {
      compartmentA: 0,
      compartmentB: 1,
      offsetStart: -20,
      offsetEnd: 20,
    };
    const base = makeParams({ cols: 2, rows: 1, cells: [0, 1] }, [override]);
    const [cut] = computeInteriorDividerCutouts(
      withInterior(base, { width: 70, alignment: 'center', offset: 0 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    expect(cut.rotateZ).toBeCloseTo(45, 4);
    expect(cut.cutW).toBeCloseTo(Math.hypot(40, 40) * 0.7, 4);
  });

  it('honours an absolute mm width override instead of the percentage', () => {
    const base = makeParams({ cols: 2, rows: 1, cells: [0, 1] });
    // Percentage default (70%) would give 0.7 * segLen; the mm override wins.
    const [cut] = computeInteriorDividerCutouts(
      withInterior(base, { widthMm: 10 }),
      INNER_W,
      INNER_D,
      WALL_HEIGHT
    );
    expect(cut.cutW).toBeCloseTo(10, 6);
  });
});
