/**
 * Rail-run segmentation around label tabs (#3401) — the arithmetic on its own.
 *
 * The assembled-geometry proof lives in `lidLabelTabClearance.scenario`; this
 * covers the branches that are awkward to reach through a whole bin (a tab that
 * eats a whole wall, one that misses the rail's line entirely, gaps between
 * per-compartment tabs).
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { railSegmentsClearOfLabelTabs } from '@/shared/utils/labelTabPlan';
import type { LabelTabFootprint } from '@/shared/utils/labelTabPlan';

/** A back-wall tab spanning the given X range, `depth` mm deep from `wallY`. */
function backTab(xMin: number, xMax: number, wallY: number, depth: number): LabelTabFootprint {
  return {
    anchor: 'back',
    xMin,
    xMax,
    yMin: wallY - depth,
    yMax: wallY,
    zMin: 20,
    zMax: 36,
  };
}

describe('railSegmentsClearOfLabelTabs', () => {
  it('leaves the whole run when there are no tabs', () => {
    expect(railSegmentsClearOfLabelTabs(-50, 50, false, 37.5, [])).toEqual([{ lo: -50, hi: 50 }]);
  });

  it('eats one end for a tab on a perpendicular wall', () => {
    // Left/right rails run along Y, so the tab's Y span shortens the run.
    const segs = railSegmentsClearOfLabelTabs(-50, 50, false, 37.5, [backTab(-40, 40, 50, 12)]);
    expect(segs).toHaveLength(1);
    expect(segs[0].lo).toBe(-50);
    // Tab front edge at 38, less the 2mm margin.
    expect(segs[0].hi).toBeCloseTo(36, 5);
  });

  it('ignores a tab that does not reach the rail line', () => {
    // A narrow, centred tab leaves the rails at x = ±37.5 alone.
    expect(railSegmentsClearOfLabelTabs(-50, 50, false, 37.5, [backTab(-10, 10, 50, 12)])).toEqual([
      { lo: -50, hi: 50 },
    ]);
  });

  it('decides on the rail line within the profile half-width, not loosely', () => {
    // RAIL_HALF_WIDTH is 1.325mm. Without a case straddling it the constant
    // could be anything from just above zero to tens of mm and every other
    // case here would still pass.
    const railCross = 37.5;
    // Tab's cross span ends just INSIDE the rail's half-width: still blocks.
    const inside = railSegmentsClearOfLabelTabs(-50, 50, false, railCross, [
      backTab(-40, railCross - 1.3, 50, 12),
    ]);
    expect(inside[0].hi).toBeLessThan(50);
    // Just OUTSIDE it: the rail is untouched.
    const outside = railSegmentsClearOfLabelTabs(-50, 50, false, railCross, [
      backTab(-40, railCross - 1.4, 50, 12),
    ]);
    expect(outside).toEqual([{ lo: -50, hi: 50 }]);
  });

  it('eats both ends when tabs sit on opposite walls', () => {
    const both = [
      backTab(-40, 40, 50, 12),
      { ...backTab(-40, 40, -38, 12), anchor: 'front' as const },
    ];
    const segs = railSegmentsClearOfLabelTabs(-50, 50, false, 37.5, both);
    expect(segs).toHaveLength(1);
    expect(segs[0].lo).toBeCloseTo(-36, 5);
    expect(segs[0].hi).toBeCloseTo(36, 5);
  });

  it('leaves nothing when a tab covers the whole run', () => {
    // A full-width tab on the wall the rail runs along: that wall stays
    // friction-fit, exactly as it did before partial rails existed.
    expect(railSegmentsClearOfLabelTabs(-40, 40, true, 50, [backTab(-40, 40, 50, 12)])).toEqual([]);
  });

  it('leaves a stretch either side of a centred tab', () => {
    // The #3401 ask: a tab narrower than its wall leaves usable run at both
    // ends, which the lid previously threw away by disabling the wall outright.
    const segs = railSegmentsClearOfLabelTabs(-40, 40, true, 50, [backTab(-10, 10, 50, 12)]);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ lo: -40, hi: -12 });
    expect(segs[1]).toEqual({ lo: 12, hi: 40 });
  });

  it('leaves the gaps between per-compartment tabs', () => {
    // Three compartments, each with a tab narrower than its column.
    const tabs = [backTab(-38, -22, 50, 12), backTab(-8, 8, 50, 12), backTab(22, 38, 50, 12)];
    const segs = railSegmentsClearOfLabelTabs(-40, 40, true, 50, tabs);
    expect(segs).toEqual([
      { lo: -20, hi: -10 },
      { lo: 10, hi: 20 },
    ]);
  });

  it('measures a front/back rail against the tab X span, not its depth', () => {
    const segs = railSegmentsClearOfLabelTabs(-40, 40, true, 50, [backTab(-40, 0, 50, 12)]);
    expect(segs).toHaveLength(1);
    expect(segs[0].lo).toBeCloseTo(2, 5);
    expect(segs[0].hi).toBe(40);
  });
});
