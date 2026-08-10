/**
 * Rail-span clipping around label tabs (#3401) — the arithmetic on its own.
 *
 * The assembled-geometry proof lives in `lidLabelTabClearance.scenario`; this
 * covers the branches that are awkward to reach through a whole bin (a tab
 * that eats a whole wall, one that misses the rail's line entirely).
 */
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { clipSpanToLabelTabs } from './lidClickRail';
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
    onOuterWall: true,
  };
}

describe('clipSpanToLabelTabs', () => {
  it('leaves a span alone when there are no tabs', () => {
    expect(clipSpanToLabelTabs(-50, 50, false, 37.5, [])).toEqual({ lo: -50, hi: 50 });
  });

  it('pulls the high end back past a tab, with clearance', () => {
    // Left/right rails run along Y, so `alongX` is false and the tab's Y span
    // is what eats the run.
    const { lo, hi } = clipSpanToLabelTabs(-50, 50, false, 37.5, [backTab(-40, 40, 50, 12)]);
    expect(lo).toBe(-50);
    // Tab front edge at 38, less the 2mm margin.
    expect(hi).toBeCloseTo(36, 5);
  });

  it('ignores a tab that does not reach the rail line', () => {
    // A narrow, centred tab leaves the rails at x = ±37.5 untouched.
    expect(clipSpanToLabelTabs(-50, 50, false, 37.5, [backTab(-10, 10, 50, 12)])).toEqual({
      lo: -50,
      hi: 50,
    });
  });

  it('clips from both ends when tabs sit on both walls', () => {
    const both = [
      backTab(-40, 40, 50, 12),
      { ...backTab(-40, 40, -38, 12), anchor: 'front' as const },
    ];
    const { lo, hi } = clipSpanToLabelTabs(-50, 50, false, 37.5, both);
    expect(hi).toBeCloseTo(36, 5);
    // The front tab's box runs [-50, -38]; its far edge is -38, plus margin.
    expect(lo).toBeCloseTo(-36, 5);
  });

  it('can collapse the span entirely, leaving the caller to drop the rail', () => {
    // A tab as deep as the whole wall leaves nothing worth printing; the
    // MIN_RAIL_LENGTH check downstream is what turns this into "no rail".
    const { lo, hi } = clipSpanToLabelTabs(-50, 50, false, 37.5, [backTab(-40, 40, 50, 100)]);
    expect(hi - lo).toBeLessThan(0);
  });

  it('measures a front/back rail against the tab X span, not its depth', () => {
    // Front and back rails run along X (`alongX` true), so a tab on the BACK
    // wall blocks them by its X extent. This rail sits on the back wall line.
    const { lo, hi } = clipSpanToLabelTabs(-40, 40, true, 50, [backTab(-40, 0, 50, 12)]);
    expect(lo).toBeCloseTo(2, 5);
    expect(hi).toBe(40);
  });
});
