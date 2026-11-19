// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import { resolveBinFloorMm } from '@/shared/utils/slotMath';
import { deriveDimensions } from './pipeline/context';
import { pathWallClearance } from './wallCutoutPathClearance';
import { cutoutFrame, type CutoutFrame } from './wallCutoutPaths';

const FRAME: CutoutFrame = {
  innerW: 123.1,
  innerD: 207.1,
  wallHeight: 37.25,
  collarHeight: 0,
  hasLip: true,
  dividerTopZ: 37.25,
  dividersBaked: false,
  depthPadding: 0,
};

const bin = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 5,
  ...over,
});

describe('pathWallClearance', () => {
  it('stays a hair off the walls without a lip', () => {
    const sections = pathWallClearance(bin(), { ...FRAME, hasLip: false });
    expect(sections.every((s) => s.front === sections[0].front && s.front < 0.05)).toBe(true);
  });

  it('starts on the floor and only climbs, under a lip whose foot is below the floor', () => {
    // 2u at 4 mm per unit: the lip's support reaches down past the floor slab.
    const params = bin({ depth: 3, height: 2, heightUnitMm: 4 });
    const dim = deriveDimensions(params, false);
    expect(dim.lipHasSupport).toBe(true);
    const sections = pathWallClearance(params, cutoutFrame(params, dim));
    expect(sections[0].z).toBeCloseTo(resolveBinFloorMm(params), 1);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].z).toBeGreaterThan(sections[i - 1].z);
    }
    // The support is at its full jut by the floor, so the clearance is too.
    const top = sections[sections.length - 1];
    expect(sections[0].back).toBeCloseTo(top.back, 6);
    expect(top.back).toBeGreaterThan(lipInnerReachMm(params) - params.wallThickness);
  });

  it('steps clear of the lip where it stands', () => {
    const params = bin();
    const sections = pathWallClearance(params, FRAME);
    const top = sections[sections.length - 1];
    expect(top.back).toBeGreaterThan(lipInnerReachMm(params) - params.wallThickness);
    expect(sections[0].back).toBeLessThan(0.05);
    // The step starts no higher than the lip's foot.
    const stepped = sections.find((s) => s.back > 0.05);
    expect(stepped?.z ?? Infinity).toBeLessThanOrEqual(FRAME.wallHeight);
  });
});
