import { describe, it, expect } from 'vitest';
import { planInteriorFillets } from './interiorFilletPlan';
import type { InteriorFilletInput } from './interiorFilletPlan';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

const INNER = 81.1;

function input(
  overrides: Partial<BinParams>,
  extra: Partial<InteriorFilletInput> = {}
): InteriorFilletInput {
  return {
    params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, ...overrides },
    innerW: INNER,
    innerD: INNER,
    floorZ: 2.25,
    interiorHeight: 20,
    dividerHeight: 20,
    bakedCavities: false,
    floorRaise: () => 0,
    radius: 2,
    ...extra,
  };
}

const quartered = { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 };

describe('planInteriorFillets', () => {
  it('outlines a single cavity on the inner wall faces, every corner convex and shell-rounded', () => {
    const [plan] = planInteriorFillets(input({}));
    expect(plan.floor).toHaveLength(4);
    for (const v of plan.floor) {
      expect(Math.abs(v.x)).toBeCloseTo(INNER / 2, 6);
      expect(Math.abs(v.y)).toBeCloseTo(INNER / 2, 6);
      expect(v.convex).toBe(true);
      expect(v.bodyRadius).toBeCloseTo(3.75 - 1.2, 6);
    }
  });

  it('keeps the corner radius above the floor radius so corners close as tori', () => {
    const [plan] = planInteriorFillets(input({}, { radius: 2.55 }));
    expect(plan.cornerRadius).toBeCloseTo(2.55, 6);
    expect(plan.radius).toBeCloseTo(2.45, 6);
  });

  it('insets each compartment half a divider from the grid line, junction corners sharp in the body', () => {
    const plans = planInteriorFillets(input({ compartments: quartered }));
    expect(plans).toHaveLength(4);
    const first = plans.find((p) => p.id === 0);
    const xs = first?.floor.map((v) => v.x) ?? [];
    expect(Math.max(...xs)).toBeCloseTo(-0.6, 6);
    const junction = first?.floor.find((v) => v.x > -1 && v.y > -1);
    expect(junction?.convex).toBe(true);
    expect(junction?.bodyRadius).toBe(0);
  });

  it('traces a merged L with one reflex corner the fillet leaves alone', () => {
    const plans = planInteriorFillets(
      input({ compartments: { cols: 2, rows: 2, cells: [0, 0, 0, 1], thickness: 1.2 } })
    );
    const l = plans.find((p) => p.id === 0);
    expect(l?.floor).toHaveLength(6);
    expect(l?.floor.filter((v) => !v.convex)).toHaveLength(1);
  });

  it('follows a tilted divider along its angle', () => {
    const plans = planInteriorFillets(
      input({
        compartments: {
          cols: 2,
          rows: 1,
          cells: [0, 1],
          thickness: 1.2,
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -6, offsetEnd: 6 }],
        },
      })
    );
    const left = plans.find((p) => p.id === 0);
    const onDivider = (left?.floor ?? []).filter((v) => v.x > -INNER / 2 + 1);
    const [front, back] = [...onDivider].sort((a, b) => a.y - b.y);
    expect(back.x - front.x).toBeCloseTo(12, 1);
  });

  it('moves a leaning divider between the floor and the top', () => {
    const plans = planInteriorFillets(
      input({
        compartments: {
          cols: 2,
          rows: 1,
          cells: [0, 1],
          thickness: 1.2,
          dividerOverrides: [
            { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg: 10 },
          ],
        },
      })
    );
    const left = plans.find((p) => p.id === 0);
    const shift = (left?.floor ?? []).map((v, i) => (left?.top[i].x ?? 0) - v.x);
    expect(Math.max(...shift.map(Math.abs))).toBeGreaterThan(1);
  });

  it('clamps a bowl radius to half the narrowest compartment', () => {
    const plans = planInteriorFillets(
      input({ compartments: quartered }, { radius: 40, innerW: 40, innerD: 40 })
    );
    for (const plan of plans) {
      expect(plan.radius).toBeLessThan(10);
      expect(plan.cornerRadius).toBeGreaterThan(plan.radius);
    }
  });

  it('stands a raised compartment fillet on its own floor', () => {
    const plans = planInteriorFillets(
      input({ compartments: quartered }, { floorRaise: (id) => (id === 3 ? 6 : 0) })
    );
    expect(plans.find((p) => p.id === 3)?.zFloor).toBeCloseTo(8.25, 6);
    expect(plans.find((p) => p.id === 0)?.zFloor).toBeCloseTo(2.25, 6);
  });

  it('caps the reach at a short divider top', () => {
    const plans = planInteriorFillets(input({ compartments: quartered }, { dividerHeight: 12 }));
    for (const plan of plans) expect(plan.zTop).toBe(12);
  });

  it('builds nothing where no fillet fits', () => {
    const plans = planInteriorFillets(input({}, { interiorHeight: 2.5 }));
    expect(plans).toHaveLength(0);
  });
});
