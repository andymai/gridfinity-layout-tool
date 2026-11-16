import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { ScoopPlacement } from '@/shared/utils/scoopCalculations';
import { deriveDimensions } from './pipeline/context';
import { planScoopRamps, rampMeetsCutout } from './scoopRampPlan';
import type { ScoopRampPlan } from './scoopRampPlan';
import type { WallCutoutReach } from './wallCutoutBuilder';

const TWO_ROWS = { cols: 1, rows: 2, cells: [0, 1], thickness: 1.2 };

function params(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 6, ...overrides };
}

function planFor(p: BinParams, floorRaiseFor: (id: number) => number = () => 0): ScoopRampPlan[] {
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

describe('rampMeetsCutout', () => {
  const PEN = 0.5;
  const MARGIN = 1;
  const FRONT: ScoopPlacement = {
    span: 40,
    depth: 40,
    isOuter: true,
    alongCenter: 0,
    edge: -20,
    rotationDeg: 0,
    runsAlongY: true,
    runSign: 1,
  };
  /** Stands 10 high at the front wall (y = -20) and lands 10 in, on a floor at z = 2. */
  const ramp = (overrides: Partial<ScoopRampPlan> = {}): ScoopRampPlan => ({
    compId: 0,
    side: 'front',
    placement: FRONT,
    floorZ: 2,
    wallHeight: 20,
    lipOffset: 0,
    height: 10,
    style: 'curved',
    arcTop: 0,
    floorStart: 0,
    run: 10,
    wallAt: () => 0,
    ...overrides,
  });
  const reach = (
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    zMin: number
  ): WallCutoutReach => ({ xMin, xMax, yMin, yMax, zMin });

  it('misses a side cutter whose run starts past the ramp foot', () => {
    expect(rampMeetsCutout(ramp(), reach(-25, -15, -5, 5, 0), PEN, MARGIN)).toBe(false);
  });

  it('weighs a side cutter against the arc where its run starts', () => {
    // 5 in, halfway down the run, the quarter ellipse stands 10(1 - sin 60°) = 1.34.
    expect(rampMeetsCutout(ramp(), reach(-25, -15, -14, 5, 4.2), PEN, MARGIN)).toBe(true);
    expect(rampMeetsCutout(ramp(), reach(-25, -15, -14, 5, 4.5), PEN, MARGIN)).toBe(false);
  });

  it('weighs a straight bevel along its line', () => {
    const straight = ramp({ style: 'straight' });
    expect(rampMeetsCutout(straight, reach(-25, -15, -14, 5, 7.9), PEN, MARGIN)).toBe(true);
    expect(rampMeetsCutout(straight, reach(-25, -15, -14, 5, 8.1), PEN, MARGIN)).toBe(false);
  });

  it('weighs a cutter in the scooped wall against the full rise', () => {
    expect(rampMeetsCutout(ramp(), reach(-5, 5, -25, -15, 12.5), PEN, MARGIN)).toBe(true);
    expect(rampMeetsCutout(ramp(), reach(-5, 5, -25, -15, 13.5), PEN, MARGIN)).toBe(false);
  });

  it('weighs a lipped wall against the filler up to the wall top', () => {
    const lipped = ramp({ lipOffset: 3, arcTop: 3, floorStart: 3 });
    const unlipped = ramp({ arcTop: 3, floorStart: 3 });
    expect(rampMeetsCutout(lipped, reach(-25, -15, -18.5, 0, 22.5), PEN, MARGIN)).toBe(true);
    expect(rampMeetsCutout(unlipped, reach(-25, -15, -18.5, 0, 22.5), PEN, MARGIN)).toBe(false);
  });

  it('misses a cutter past either end of the span', () => {
    expect(rampMeetsCutout(ramp(), reach(22, 30, -25, 25, 0), PEN, MARGIN)).toBe(false);
    expect(rampMeetsCutout(ramp(), reach(-30, -22, -25, 25, 0), PEN, MARGIN)).toBe(false);
    expect(rampMeetsCutout(ramp(), reach(21, 30, -25, 25, 0), PEN, MARGIN)).toBe(true);
  });

  it('misses a cutter wholly behind the wall the ramp stands on', () => {
    expect(rampMeetsCutout(ramp(), reach(-5, 5, -30, -22, 0), PEN, MARGIN)).toBe(false);
    expect(rampMeetsCutout(ramp(), reach(-5, 5, -30, -21.4, 0), PEN, MARGIN)).toBe(true);
  });

  it('measures a ramp running toward -X from its own wall', () => {
    const right = ramp({
      side: 'right',
      placement: { ...FRONT, edge: 20, rotationDeg: 90, runsAlongY: false, runSign: -1 },
    });
    expect(rampMeetsCutout(right, reach(10, 14, 15, 25, 4.2), PEN, MARGIN)).toBe(true);
    expect(rampMeetsCutout(right, reach(10, 14, 15, 25, 4.5), PEN, MARGIN)).toBe(false);
    expect(rampMeetsCutout(right, reach(1, 9, 15, 25, 0), PEN, MARGIN)).toBe(false);
  });
});
