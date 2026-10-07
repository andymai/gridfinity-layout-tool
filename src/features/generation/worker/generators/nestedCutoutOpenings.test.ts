import { describe, it, expect } from 'vitest';
import type { Cutout, CutoutArrayConfig } from '@/shared/types/bin';
import { planNestedOpenings } from './nestedCutoutOpenings';
import type { NestedOpeningPlan } from './nestedCutoutOpenings';

const SURFACE = 30;

function cutout(overrides: Partial<Cutout>): Cutout {
  return {
    id: 'c',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 6,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    scoopRadiusW: 0,
    scoopRadiusD: 0,
    ...overrides,
  };
}

const TRAY = cutout({ id: 'tray', x: 10, y: 10, width: 60, depth: 40, cutDepth: 6 });
const SLOT = cutout({
  id: 'slot',
  shape: 'slot',
  x: 25,
  y: 25,
  width: 30,
  depth: 10,
  cutDepth: 16,
  chamferWidth: 0.8,
});

const ROWS: CutoutArrayConfig = {
  mode: 'grid',
  cols: 1,
  rows: 3,
  pitchX: 1,
  pitchY: 12,
  count: 1,
  radius: 1,
  startAngle: 0,
  rotateToCenter: false,
};

function isEmpty(plan: NestedOpeningPlan): boolean {
  return plan.sunk.size === 0 && plan.flares.length === 0;
}

describe('planNestedOpenings', () => {
  it('sinks the chamfer of a pocket wholly inside a shallower one to its floor', () => {
    const plan = planNestedOpenings([TRAY, SLOT], SURFACE);
    expect([...plan.sunk]).toEqual([['slot', { depth: 6, flare: 0.8 }]]);
    expect(plan.flares).toEqual([]);
  });

  it('gives a pocket crossing the floor outline a flare trimmed to it', () => {
    const plan = planNestedOpenings([TRAY, { ...SLOT, x: 55 }], SURFACE);
    expect(plan.sunk.size).toBe(0);
    expect(plan.flares).toHaveLength(1);
    expect(plan.flares[0]).toMatchObject({
      ownerId: 'slot',
      floorDepth: 6,
      flare: 0.8,
      rise: 0,
      trimTo: { key: 'tray' },
    });
  });

  it('trims rather than sinks a pocket close enough to the wall for its flare to reach it', () => {
    const plan = planNestedOpenings([TRAY, { ...SLOT, y: 11 }], SURFACE);
    expect(plan.sunk.size).toBe(0);
    expect(plan.flares[0].trimTo?.key).toBe('tray');
  });

  it('opens nothing for a pocket no deeper than the floor', () => {
    expect(isEmpty(planNestedOpenings([TRAY, { ...SLOT, cutDepth: 4 }], SURFACE))).toBe(true);
    expect(isEmpty(planNestedOpenings([TRAY, { ...SLOT, cutDepth: 6 }], SURFACE))).toBe(true);
  });

  it('opens nothing where the rim never enters the floor', () => {
    const apart = { ...SLOT, x: 0, y: 55, width: 20, depth: 8 };
    expect(isEmpty(planNestedOpenings([TRAY, apart], SURFACE))).toBe(true);
    const around = { ...SLOT, x: 0, y: 0, width: 80, depth: 60 };
    expect(isEmpty(planNestedOpenings([TRAY, around], SURFACE))).toBe(true);
  });

  it('opens nothing without a chamfer, or for a shape that takes none', () => {
    expect(isEmpty(planNestedOpenings([TRAY, { ...SLOT, chamferWidth: 0 }], SURFACE))).toBe(true);
    expect(isEmpty(planNestedOpenings([TRAY, { ...SLOT, shape: 'text' }], SURFACE))).toBe(true);
  });

  it('narrows the flare to the wall left under the floor, keeping the straight run', () => {
    const plan = planNestedOpenings([TRAY, { ...SLOT, cutDepth: 6.6 }], SURFACE);
    expect(plan.sunk.get('slot')?.flare).toBeCloseTo(0.4, 9);
    expect(isEmpty(planNestedOpenings([TRAY, { ...SLOT, cutDepth: 6.24 }], SURFACE))).toBe(true);
  });

  it('keeps the flare clear of the pocket scoop', () => {
    const scooped = { ...SLOT, cutDepth: 9, scoopRadiusW: 2, scoopRadiusD: 2 };
    expect(planNestedOpenings([TRAY, scooped], SURFACE).sunk.get('slot')?.flare).toBeCloseTo(
      0.8,
      9
    );
    const deepScoop = { ...scooped, scoopRadiusW: 2.9, scoopRadiusD: 2.9 };
    expect(planNestedOpenings([TRAY, deepScoop], SURFACE).sunk.get('slot')?.flare).toBeCloseTo(
      0.1,
      9
    );
  });

  it('carries a trimmed flare up past a scooped floor fillet, no higher than the surface', () => {
    const across = { ...SLOT, x: 55 };
    const scoopedTray = { ...TRAY, scoopRadiusW: 2, scoopRadiusD: 2 };
    expect(planNestedOpenings([scoopedTray, across], SURFACE).flares[0].rise).toBeCloseTo(2.5, 9);
    const shallow = { ...scoopedTray, cutDepth: 0.3 };
    expect(planNestedOpenings([shallow, across], SURFACE).flares[0].rise).toBeCloseTo(0.3, 9);
  });

  it('clamps both depths to the fill surface', () => {
    expect(planNestedOpenings([TRAY, { ...SLOT, cutDepth: 50 }], 10).sunk.get('slot')).toEqual({
      depth: 6,
      flare: 0.8,
    });
    expect(isEmpty(planNestedOpenings([{ ...TRAY, cutDepth: 50 }, SLOT], 10))).toBe(true);
    expect(isEmpty(planNestedOpenings([TRAY, SLOT], 0))).toBe(true);
  });

  it('sinks to the deepest floor wholly around the pocket and drops the shallower', () => {
    const inner = cutout({ id: 'inner', x: 20, y: 20, width: 40, depth: 20, cutDepth: 10 });
    const plan = planNestedOpenings([TRAY, inner, SLOT], SURFACE);
    expect([...plan.sunk]).toEqual([['slot', { depth: 10, flare: 0.8 }]]);
    expect(plan.flares).toEqual([]);
  });

  it('still trims a flare at a deeper floor the sunk pocket crosses', () => {
    const inner = cutout({ id: 'inner', x: 40, y: 20, width: 25, depth: 20, cutDepth: 10 });
    const plan = planNestedOpenings([TRAY, inner, SLOT], SURFACE);
    expect([...plan.sunk]).toEqual([['slot', { depth: 6, flare: 0.8 }]]);
    expect(plan.flares.map((f) => [f.floorDepth, f.trimTo?.key])).toEqual([[10, 'inner']]);
  });

  it('sinks every instance of a repeat on its own key', () => {
    const repeated = { ...SLOT, y: 14, depth: 8, array: ROWS };
    const plan = planNestedOpenings([TRAY, repeated], SURFACE);
    expect([...plan.sunk.keys()]).toEqual(['slot::a0', 'slot::a1', 'slot::a2']);
    expect(plan.flares).toEqual([]);
  });

  it('sinks only the instances of a repeat that sit inside the floor', () => {
    const repeated = { ...SLOT, y: 14, depth: 8, array: { ...ROWS, pitchY: 20 } };
    const plan = planNestedOpenings([TRAY, repeated], SURFACE);
    expect([...plan.sunk.keys()]).toEqual(['slot::a0', 'slot::a1']);
  });

  it('sinks a union member onto its sibling floor when every copy agrees', () => {
    const members = [
      { ...TRAY, groupId: 'g', width: 30 },
      { ...SLOT, groupId: 'g', width: 10, array: { ...ROWS, rows: 1, cols: 2, pitchX: 40 } },
    ];
    const plan = planNestedOpenings(members, SURFACE);
    expect([...plan.sunk]).toEqual([['slot', { depth: 6, flare: 0.8 }]]);
    expect(plan.flares).toEqual([]);
  });

  it('gives each copy its own flare when the copies of a group disagree', () => {
    const members = [
      { ...SLOT, groupId: 'g', array: { ...ROWS, rows: 1, cols: 2, pitchX: 70 } },
      cutout({ id: 'shelf', groupId: 'g', x: 25, y: 60, width: 30, depth: 10, cutDepth: 2 }),
    ];
    const plan = planNestedOpenings([TRAY, ...members], SURFACE);
    expect(plan.sunk.size).toBe(0);
    expect(plan.flares.map((f) => [f.pocket.x, f.ownerId, f.colorOwner.id, f.trimTo])).toEqual([
      [25, 'slot', 'slot', null],
    ]);
  });

  it('leaves subtract, intersect and exclude groups out either way round', () => {
    for (const groupOp of ['subtract', 'intersect', 'exclude'] as const) {
      const members = [
        { ...TRAY, groupId: 'g', groupOp },
        { ...SLOT, groupId: 'g', groupOp },
      ];
      expect(isEmpty(planNestedOpenings(members, SURFACE))).toBe(true);
      expect(isEmpty(planNestedOpenings([members[0], { ...SLOT, id: 'loose' }], SURFACE))).toBe(
        true
      );
    }
  });

  it('never opens onto a leaned floor, and trims rather than sinks a leaned pocket', () => {
    expect(isEmpty(planNestedOpenings([{ ...TRAY, leanDeg: 10 }, SLOT], SURFACE))).toBe(true);
    const plan = planNestedOpenings([TRAY, { ...SLOT, leanDeg: 20 }], SURFACE);
    expect(plan.sunk.size).toBe(0);
    expect(plan.flares[0].trimTo?.key).toBe('tray');
  });

  it('follows a leaned pocket down its axis to where it crosses the floor', () => {
    // 6mm down, a 45° lean has carried the slot 6mm toward local +Y: from just
    // inside the tray's +Y edge to past it, so it leaves through the wall.
    const leaning = { ...SLOT, y: 45, depth: 4, cutDepth: 20, leanDeg: 45 };
    expect(isEmpty(planNestedOpenings([TRAY, leaning], SURFACE))).toBe(true);
    expect(planNestedOpenings([TRAY, { ...leaning, leanDeg: -45 }], SURFACE).flares).toHaveLength(
      1
    );
  });

  it('leaves mesh imprints out either way round', () => {
    const imprint = { ...TRAY, shape: 'mesh' as const, meshId: 'm' };
    expect(isEmpty(planNestedOpenings([imprint, SLOT], SURFACE))).toBe(true);
    expect(isEmpty(planNestedOpenings([TRAY, { ...SLOT, shape: 'mesh' as const }], SURFACE))).toBe(
      true
    );
  });

  it('follows rotation when deciding whether a pocket stays inside', () => {
    const long = { ...SLOT, x: 15, width: 50, y: 26, depth: 8 };
    expect(planNestedOpenings([TRAY, long], SURFACE).sunk.has('slot')).toBe(true);
    const turned = planNestedOpenings([TRAY, { ...long, rotation: 45 }], SURFACE);
    expect(turned.sunk.size).toBe(0);
    expect(turned.flares[0].trimTo?.key).toBe('tray');
  });
});
