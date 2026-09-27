import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { deriveDimensions } from './pipeline/context';
import { planScoopRamps } from './scoopRampPlan';

const TWO_ROWS = { cols: 1, rows: 2, cells: [0, 1], thickness: 1.2 };

function params(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 6, ...overrides };
}

function planFor(p: BinParams, floorRaiseFor: (id: number) => number = () => 0) {
  const dim = deriveDimensions(p, false);
  return planScoopRamps(
    p,
    dim.innerW,
    dim.innerD,
    dim.wallHeight,
    p.wallThickness,
    dim.floorThickness,
    floorRaiseFor,
    dim.overhang.taper
  );
}

describe('planScoopRamps', () => {
  it('stops a ramp that starts on a divider face short of the opposite wall', () => {
    const plans = planFor(
      params({
        compartments: TWO_ROWS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 20, run: 60, sides: ['back'] },
      })
    );
    expect(plans).toHaveLength(2);
    for (const plan of plans) {
      expect(plan.floorStart + plan.run).toBeLessThanOrEqual(plan.placement.depth - 0.5 + 1e-9);
    }
    const onDivider = plans.find((p) => !p.placement.isOuter);
    expect(onDivider?.floorStart).toBeGreaterThan(0);
    expect((onDivider?.floorStart ?? 0) + (onDivider?.run ?? 0)).toBeCloseTo(
      (onDivider?.placement.depth ?? 0) - 0.5,
      9
    );
  });

  it('stands a raised compartment ramp on its raised floor', () => {
    const p = params({
      compartments: TWO_ROWS,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, sides: ['back'] },
    });
    const floorZ = deriveDimensions(p, false).floorThickness;
    const plans = planFor(p, (id) => (id === 0 ? 10 : 0));
    const raised = plans.find((r) => r.compId === 0);
    const level = plans.find((r) => r.compId === 1);
    expect(raised?.floorZ).toBeCloseTo(floorZ + 10, 9);
    expect(level?.floorZ).toBeCloseTo(floorZ, 9);
    expect((level?.wallHeight ?? 0) - (raised?.wallHeight ?? 0)).toBeCloseTo(10, 9);
  });
});
