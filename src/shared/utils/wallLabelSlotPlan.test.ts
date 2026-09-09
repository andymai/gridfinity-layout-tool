import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { LABEL_SOCKET_CLEARANCE_MM, labelPlateWidthMm } from '@/shared/constants/labelPlates';
import type { BinParams } from '@/shared/types/bin';
import {
  DEFAULT_WALL_LABEL_SLOTS,
  WALL_LABEL_SLOT_BACK_MM,
  WALL_LABEL_SLOT_FRAME_MAX_MM,
  WALL_LABEL_SLOT_TOP_GAP_MM,
  planWallLabelSlotCorners,
  planWallLabelSlots,
} from './wallLabelSlotPlan';

const DIMS = { wallHeightMm: 37, gridUnitMmX: 42, gridUnitMmY: 42 };

function params(
  over: Partial<BinParams> = {},
  sides = { front: true, back: false, left: false, right: false },
  everyCells = 1
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    wallLabelSlots: { enabled: true, sides, everyCells },
    ...over,
  };
}

describe('planWallLabelSlots', () => {
  it('plans nothing while the feature is off', () => {
    const plan = planWallLabelSlots({ ...DEFAULT_BIN_PARAMS, width: 3, depth: 2 }, DIMS, 0.3);
    expect(plan.slots).toEqual([]);
    expect(plan.refusal).toBeNull();
  });

  it('centres one slot on every cell of a chosen wall', () => {
    const plan = planWallLabelSlots(params(), DIMS, 0.3);
    expect(plan.slots.map((s) => s.side)).toEqual(['front', 'front', 'front']);
    expect(plan.slots.map((s) => s.offset)).toEqual([-42, 0, 42]);
  });

  it('runs the depth cells on a side wall', () => {
    const plan = planWallLabelSlots(
      params({}, { front: false, back: false, left: true, right: false }),
      DIMS,
      0.3
    );
    expect(plan.slots.map((s) => s.offset)).toEqual([-21, 21]);
  });

  it('skips cells at the chosen pitch, starting from the first', () => {
    const plan = planWallLabelSlots(params({ width: 4 }, undefined, 2), DIMS, 0.3);
    expect(plan.slots.map((s) => s.offset)).toEqual([-63, 21]);
  });

  it('sizes the joint from the plate standard and the nozzle clearance', () => {
    const plan = planWallLabelSlots(params(), DIMS, LABEL_SOCKET_CLEARANCE_MM);
    expect(plan.socketWidthMm).toBeCloseTo(labelPlateWidthMm(1) + LABEL_SOCKET_CLEARANCE_MM, 9);
    expect(plan.windowWidthMm).toBeLessThan(labelPlateWidthMm(1));
    expect(plan.slotThicknessMm).toBeCloseTo(1.4, 9);
    // A 1.2 wall is the whole frame; the boss supplies the slot and its back.
    expect(plan.frameMm).toBe(
      Math.min(DEFAULT_BIN_PARAMS.wallThickness, WALL_LABEL_SLOT_FRAME_MAX_MM)
    );
    expect(plan.bossDepthMm).toBeCloseTo(
      plan.frameMm +
        plan.slotThicknessMm +
        WALL_LABEL_SLOT_BACK_MM -
        DEFAULT_BIN_PARAMS.wallThickness,
      9
    );
    expect(plan.plateTopZ).toBeCloseTo(DIMS.wallHeightMm - WALL_LABEL_SLOT_TOP_GAP_MM, 9);
    expect(plan.floorZ).toBeLessThan(plan.plateTopZ);
    expect(plan.bossBottomZ).toBeLessThan(plan.floorZ);
  });

  it('widens the slot for a coarse nozzle', () => {
    const fine = planWallLabelSlots(params(), DIMS, 0.3);
    const coarse = planWallLabelSlots(params(), DIMS, 0.5);
    expect(coarse.slotThicknessMm).toBeCloseTo(fine.slotThicknessMm + 0.2, 9);
    expect(coarse.socketWidthMm).toBeCloseTo(fine.socketWidthMm + 0.2, 9);
  });

  it('refuses a wall too short for the plate', () => {
    const plan = planWallLabelSlots(params(), { ...DIMS, wallHeightMm: 9 }, 0.3);
    expect(plan.refusal).toBe('tooShort');
    expect(plan.slots).toEqual([]);
  });

  it('refuses a custom outline and an overhang', () => {
    const mask = { cols: 3, rows: 2, cells: [1, 1, 1, 1, 1, 0] as const };
    expect(planWallLabelSlots(params({ cellMask: mask as never }), DIMS, 0.3).refusal).toBe(
      'polygon'
    );
    expect(
      planWallLabelSlots(
        params({ overhang: { enabled: true, left: 3, right: 0, front: 0, back: 0 } }),
        DIMS,
        0.3
      ).refusal
    ).toBe('overhang');
  });

  it('drops a wall whose cells cannot hold a plate, and refuses when none can', () => {
    const narrow = { ...DIMS, gridUnitMmX: 30, gridUnitMmY: 42 };
    const both = planWallLabelSlots(
      params({}, { front: true, back: false, left: true, right: false }),
      narrow,
      0.3
    );
    expect(both.slots.every((s) => s.side === 'left')).toBe(true);
    expect(both.refusal).toBeNull();
    expect(planWallLabelSlots(params(), narrow, 0.3).refusal).toBe('cellTooNarrow');
  });

  // A half cell is 21 mm wide: nothing to slot into, and a slot centred on it
  // would open into the corner.
  it('skips the fractional cell and keeps the whole ones on their centres', () => {
    const end = planWallLabelSlots(params({ width: 2.5, fractionalEdgeX: 'end' }), DIMS, 0.3);
    expect(end.slots.map((s) => s.offset)).toEqual([-31.5, 10.5]);
    const start = planWallLabelSlots(params({ width: 2.5, fractionalEdgeX: 'start' }), DIMS, 0.3);
    expect(start.slots.map((s) => s.offset)).toEqual([-10.5, 31.5]);
  });

  it('flags a wall thinner than the frame minimum', () => {
    expect(planWallLabelSlots(params({ wallThickness: 0.6 }), DIMS, 0.3).thinWall).toBe(true);
    expect(planWallLabelSlots(params(), DIMS, 0.3).thinWall).toBe(false);
  });

  it('exposes the default config for designs that carry none', () => {
    expect(DEFAULT_WALL_LABEL_SLOTS.enabled).toBe(false);
  });
});

describe('planWallLabelSlotCorners', () => {
  const ALL = { front: true, back: true, left: true, right: true };
  // A 2x2 bin on the 42 mm grid: inner 81.1 with a 1.2 wall.
  const inner = { innerW: 81.1, innerD: 81.1 };
  const two = (sides = ALL, everyCells = 1): BinParams =>
    params({ width: 2, depth: 2 }, sides, everyCells);

  it('joins the cavities at every corner where two walls meet on the grid pitch', () => {
    const p = two();
    const plan = planWallLabelSlots(p, DIMS, 0.3);
    const corners = planWallLabelSlotCorners(plan, p, DIMS, inner);
    expect(corners).toHaveLength(4);
    // The cavity end (21 + 18.15) and the neighbour's back plane (41.75 - 2.6)
    // coincide at 39.15, so the channel is centred there.
    const c = corners.find((k) => k.x[0] > 0 && k.y[0] < 0);
    expect(c?.x[0]).toBeCloseTo(38.65);
    expect(c?.x[1]).toBeCloseTo(39.65);
    expect(c?.y[0]).toBeCloseTo(-39.65);
    expect(c?.y[1]).toBeCloseTo(-38.65);
  });

  it('needs a slot in the corner cell of both walls', () => {
    const front = two({ front: true, back: false, left: false, right: false });
    expect(
      planWallLabelSlotCorners(planWallLabelSlots(front, DIMS, 0.3), front, DIMS, inner)
    ).toEqual([]);
    // Every other cell: the 2-wide front wall keeps only its first cell and
    // the 4-deep side walls their first and third, so only the front-left
    // corner has a slot on both walls.
    const p = params(
      { width: 2, depth: 4 },
      { front: true, back: false, left: true, right: true },
      2
    );
    const corners = planWallLabelSlotCorners(planWallLabelSlots(p, DIMS, 0.3), p, DIMS, {
      innerW: 81.1,
      innerD: 165.1,
    });
    expect(corners).toHaveLength(1);
    expect(corners[0].x[1]).toBeLessThan(0);
    expect(corners[0].y[1]).toBeLessThan(0);
  });

  it('skips a corner where the fractional cell sits against the wall', () => {
    const p = params({ width: 2.5, depth: 2, fractionalEdgeX: 'end' }, ALL);
    const plan = planWallLabelSlots(p, DIMS, 0.3);
    // 2.5 x 2 on the 42 mm grid: inner 102.1 x 81.1.
    const corners = planWallLabelSlotCorners(plan, p, DIMS, { innerW: 102.1, innerD: 81.1 });
    expect(corners).toHaveLength(2);
    expect(corners.every((c) => c.x[1] < 0)).toBe(true);
  });

  it('leaves a printable block alone', () => {
    const p = two();
    const plan = planWallLabelSlots(p, { ...DIMS, gridUnitMmX: 46, gridUnitMmY: 46 }, 0.3);
    expect(
      planWallLabelSlotCorners(
        plan,
        p,
        { gridUnitMmX: 46, gridUnitMmY: 46 },
        {
          innerW: 89.1,
          innerD: 89.1,
        }
      )
    ).toEqual([]);
  });
});
