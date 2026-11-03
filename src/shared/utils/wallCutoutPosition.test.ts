import { describe, it, expect } from 'vitest';
import {
  MAX_CUTOUT_CORNER_RADIUS,
  autoCornerRadius,
  computeCutoutCenter,
  resolveCutoutCornerRadii,
  resolveCutoutDrop,
  resolveCutoutSpan,
  cutoutSide,
  safeCutoutCornerRadii,
  shoulderBlend,
} from './wallCutoutPosition';

describe('computeCutoutCenter', () => {
  const wallSpan = 80; // mm (typical 2-unit bin inner width)
  const cutWidth = 40; // mm
  const wallThickness = 1.2; // mm

  it('returns 0 for center alignment with no offset', () => {
    expect(computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 0)).toBe(0);
  });

  it('anchors left with auto-margin from corner', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', 0);
    // Expected: -halfSpan + margin + halfCut = -40 + 1.2 + 20 = -18.8
    expect(result).toBeCloseTo(-18.8);
  });

  it('anchors right with auto-margin from corner', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', 0);
    // Expected: halfSpan - margin - halfCut = 40 - 1.2 - 20 = 18.8
    expect(result).toBeCloseTo(18.8);
  });

  it('applies offset to alignment anchor', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', 5);
    // Expected: -18.8 + 5 = -13.8
    expect(result).toBeCloseTo(-13.8);
  });

  it('applies negative offset to right alignment', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', -10);
    // Expected: 18.8 - 10 = 8.8
    expect(result).toBeCloseTo(8.8);
  });

  it('clamps so cutout respects margin from left edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', -50);
    // Min center with margin: -halfSpan + margin + halfCut = -40 + 1.2 + 20 = -18.8
    expect(result).toBeCloseTo(-18.8);
  });

  it('clamps so cutout respects margin from right edge', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'right', 50);
    // Max center with margin: halfSpan - margin - halfCut = 40 - 1.2 - 20 = 18.8
    expect(result).toBeCloseTo(18.8);
  });

  it('returns 0 when cutout is too wide for margins (degenerate case)', () => {
    // cutWidth nearly fills the span, margins can't be satisfied
    const result = computeCutoutCenter(wallSpan, wallSpan, wallThickness, 'left', 0);
    expect(result).toBe(0);
  });

  it('handles center alignment with offset', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 10);
    expect(result).toBe(10);
  });

  it('clamps center alignment offset at margin', () => {
    const result = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 100);
    // Max center with margin: 40 - 1.2 - 20 = 18.8
    expect(result).toBeCloseTo(18.8);
  });

  it('returns 0 when wallSpan is too small for margin (degenerate)', () => {
    // wallSpan=10, cutWidth=8, margin=1.2 → minCenter=0.2, maxCenter=-0.2 → degenerate → 0
    const result = computeCutoutCenter(10, 8, 1.2, 'left', 0);
    expect(result).toBe(0);
  });

  it('handles small wallSpan where margin still fits', () => {
    // wallSpan=20, cutWidth=8, margin=1.2 → left anchor = -10 + 1.2 + 4 = -4.8
    const result = computeCutoutCenter(20, 8, 1.2, 'left', 0);
    expect(result).toBeCloseTo(-4.8);
  });
});

describe('resolveCutoutSpan', () => {
  it('takes the percentage of the wall span when no override is set', () => {
    expect(resolveCutoutSpan({ width: 70, widthMm: null }, 80)).toBeCloseTo(56);
  });

  it('prefers an absolute override over the percentage', () => {
    expect(resolveCutoutSpan({ width: 70, widthMm: 30 }, 80)).toBe(30);
  });

  it('clamps an override to the wall it is cutting', () => {
    expect(resolveCutoutSpan({ width: 70, widthMm: 500 }, 80)).toBe(80);
  });
});

describe('resolveCutoutDrop', () => {
  it('takes the percentage of the wall run when no override is set', () => {
    expect(resolveCutoutDrop({ depth: 50, depthMm: null }, 40)).toBeCloseTo(20);
  });

  it('treats an absent field the same as null — pre-control designs carry neither', () => {
    expect(resolveCutoutDrop({ depth: 50 }, 40)).toBeCloseTo(20);
  });

  it('holds one cut line across bins of different heights', () => {
    const cfg = { depth: 50, depthMm: 20 };
    // The whole point of the override: 6U and 12U walls, one opening.
    expect(resolveCutoutDrop(cfg, 40)).toBe(resolveCutoutDrop(cfg, 82));
  });

  it('clamps an override to the wall it is cutting', () => {
    expect(resolveCutoutDrop({ depth: 50, depthMm: 500 }, 40)).toBe(40);
  });

  it('falls back to the percentage only for a value that is no number at all', () => {
    // A hand-authored file can carry anything, and Math.min(NaN, run) is NaN —
    // which passes every downstream `< 0.1` guard and reaches the kernel.
    expect(resolveCutoutDrop({ depth: 50, depthMm: Number.NaN }, 40)).toBeCloseTo(20);
  });

  it('keeps a zero override meaning no cut, not a fallback to the percentage', () => {
    // `widthMm: 0` is schema-valid and already means "build nothing"; reading it
    // as "unset" would open a 50% window in every design that carries one.
    expect(resolveCutoutDrop({ depth: 50, depthMm: 0 }, 40)).toBe(0);
    expect(resolveCutoutSpan({ width: 70, widthMm: 0 }, 80)).toBe(0);
    expect(resolveCutoutDrop({ depth: 50, depthMm: -5 }, 40)).toBeLessThan(0.1);
  });
});

describe('resolveCutoutCornerRadii', () => {
  const CUT = 40; // autoCornerRadius saturates at its 5mm cap here

  it('falls back to square shoulders and the automatic fillet', () => {
    // The whole back-compat story: a design saved before the control existed
    // has neither field, and must resolve to what the builder always did.
    expect(resolveCutoutCornerRadii(undefined, undefined, CUT)).toEqual({
      top: 0,
      bottom: autoCornerRadius(CUT),
    });
  });

  it('takes the wall-level default when the side says nothing', () => {
    const wall = { cornerRadiusTop: 3, cornerRadiusBottom: 2 };
    expect(resolveCutoutCornerRadii(wall, {}, CUT)).toEqual({ top: 3, bottom: 2 });
  });

  it('lets the side override the wall', () => {
    const wall = { cornerRadiusTop: 3, cornerRadiusBottom: 2 };
    const side = { cornerRadiusTop: 7 };
    expect(resolveCutoutCornerRadii(wall, side, CUT)).toEqual({ top: 7, bottom: 2 });
  });

  it('reads null as defer, not as zero', () => {
    // The distinction that matters for the bottom: null keeps the automatic
    // rule, 0 is a user asking for a square floor corner.
    const wall = { cornerRadiusBottom: 2 };
    expect(resolveCutoutCornerRadii(wall, { cornerRadiusBottom: null }, CUT).bottom).toBe(2);
    expect(resolveCutoutCornerRadii(wall, { cornerRadiusBottom: 0 }, CUT).bottom).toBe(0);
  });

  it('clamps to the control range', () => {
    expect(resolveCutoutCornerRadii({ cornerRadiusTop: 999 }, {}, CUT).top).toBe(
      MAX_CUTOUT_CORNER_RADIUS
    );
    expect(resolveCutoutCornerRadii({ cornerRadiusTop: -5 }, {}, CUT).top).toBe(0);
  });

  it('gives a scoop no bottom radius, stored or automatic', () => {
    const wall = { shape: 'scoop' as const, cornerRadiusTop: 3 };
    expect(resolveCutoutCornerRadii(wall, { cornerRadiusBottom: 4 }, CUT)).toEqual({
      top: 3,
      bottom: 0,
    });
    expect(resolveCutoutCornerRadii(wall, {}, CUT).bottom).toBe(0);
  });

  it('lets a lipless scoop round its shoulder as deep as the cut', () => {
    // Counting the automatic bottom fillet against the shoulder would cut
    // this round-over short.
    const depth = 10;
    const wall = { shape: 'scoop' as const, cornerRadiusTop: 8 };
    const radii = resolveCutoutCornerRadii(wall, {}, CUT);
    expect(safeCutoutCornerRadii(radii, CUT, depth, 0).topLeft).toBe(8);
  });
});

describe('safeCutoutCornerRadii', () => {
  const CUT = 40;
  const DEPTH = 30;
  const LIP = 4.4;
  const asked = { top: 5, bottom: 3 };

  it('leaves a radius that fits alone', () => {
    const safe = safeCutoutCornerRadii(asked, CUT, DEPTH, LIP);
    expect(safe).toEqual({ topLeft: 5, topRight: 5, bottomLeft: 3, bottomRight: 3 });
  });

  it('caps each end by the wall standing beside it', () => {
    // Alignment can leave one end flush and the other deep in material, so a
    // single worst-case cap would throw away a blend that fits.
    const safe = safeCutoutCornerRadii(asked, CUT, DEPTH, LIP, { left: 0, right: 2 });
    expect(safe.topLeft).toBe(0);
    expect(safe.bottomLeft).toBe(0);
    expect(safe.topRight).toBe(2);
    expect(safe.bottomRight).toBe(2);
  });

  it('never rounds the shoulder deeper than the cut', () => {
    const shallow = 2;
    const safe = safeCutoutCornerRadii(asked, CUT, shallow, LIP);
    expect(safe.topLeft).toBeLessThanOrEqual(shallow);
  });

  it('keeps a straight run between the two blends', () => {
    // Both meet on the same side of the cut. Without this the profile folds
    // through itself, which the pen does not report.
    const shallow = 3;
    const greedy = { top: MAX_CUTOUT_CORNER_RADIUS, bottom: MAX_CUTOUT_CORNER_RADIUS };
    const noLip = safeCutoutCornerRadii(greedy, CUT, shallow, 0);
    expect(noLip.topLeft + noLip.bottomLeft).toBeLessThan(shallow);
  });

  it('snaps a negligible radius to square', () => {
    // A radius the profile declines to draw must also be one lipGapPlan
    // declines to widen the gap by, or the two disagree about the opening.
    const safe = safeCutoutCornerRadii({ top: 0.05, bottom: 0.05 }, CUT, DEPTH, LIP);
    expect(safe).toEqual({ topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 });
  });
});

describe('shoulderBlend', () => {
  const RIM = 40;
  const SIDE_AT_RIM = 20;
  const R = 5;

  it('is a quarter arc on a straight side', () => {
    const b = shoulderBlend(SIDE_AT_RIM, RIM, 0, R);
    expect(b.rim).toEqual([SIDE_AT_RIM + R, RIM]);
    expect(b.side).toEqual([SIDE_AT_RIM, RIM - R]);
    expect(b.centre).toEqual([SIDE_AT_RIM + R, RIM - R]);
    expect(b.sweep).toBeCloseTo(Math.PI / 2, 12);
  });

  it('lands tangent to a leaning side, not vertically onto it', () => {
    const lean = 0.25;
    const b = shoulderBlend(SIDE_AT_RIM, RIM, lean, R);
    const [cx, cy] = b.centre;
    // The side, as the line through (SIDE_AT_RIM, RIM) that moves `lean`
    // outboard per mm of rise. Unit direction pointing down it:
    const len = Math.hypot(lean, 1);
    const down = [-lean / len, -1 / len];
    const sideXAt = (y: number): number => SIDE_AT_RIM - lean * (RIM - y);

    // Tangent to the rim: the centre sits a radius below it, the rim point
    // directly above the centre.
    expect(cy).toBeCloseTo(RIM - R, 12);
    expect(b.rim[0]).toBeCloseTo(cx, 12);
    // Tangent to the side: the landing is on the side, a radius from the
    // centre, and the radius there is square to the side.
    expect(b.side[0]).toBeCloseTo(sideXAt(b.side[1]), 12);
    expect(Math.hypot(b.side[0] - cx, b.side[1] - cy)).toBeCloseTo(R, 12);
    expect((b.side[0] - cx) * down[0] + (b.side[1] - cy) * down[1]).toBeCloseTo(0, 12);
    // The centre is a radius from the side's line, so the arc touches it once.
    const crossTrack = (cx - SIDE_AT_RIM) * down[1] - (cy - RIM) * down[0];
    expect(Math.abs(crossTrack)).toBeCloseTo(R, 12);

    expect(Math.hypot(b.mid[0] - cx, b.mid[1] - cy)).toBeCloseTo(R, 12);
    expect(b.sweep).toBeCloseTo(Math.PI / 2 - Math.atan(lean), 12);
  });

  it('reaches less than its radius on a leaning side', () => {
    const b = shoulderBlend(SIDE_AT_RIM, RIM, 0.25, R);
    expect(b.rim[0] - SIDE_AT_RIM).toBeLessThan(R);
    expect(b.rim[0] - SIDE_AT_RIM).toBeGreaterThan(0);
    expect(RIM - b.side[1]).toBeLessThan(R);
  });
});

describe('cutoutSide', () => {
  const CUT = 40;
  const DROP = 30;
  const CLEARANCE = 2;

  it('keeps a u-shape vertical at half the span', () => {
    expect(cutoutSide('u-shape', CUT, DROP, CLEARANCE)).toEqual({
      bottomHalfWidth: CUT / 2,
      lean: 0,
      halfWidthAtRim: CUT / 2,
    });
  });

  it("runs a funnel from the profile's top corner to 60% of the span at the floor", () => {
    const side = cutoutSide('funnel', CUT, DROP, CLEARANCE);
    const halfWidthAt = (heightAboveRim: number): number =>
      side.halfWidthAtRim + side.lean * heightAboveRim;
    expect(halfWidthAt(CLEARANCE)).toBeCloseTo(CUT / 2, 12);
    expect(halfWidthAt(-DROP)).toBeCloseTo(CUT * 0.3, 12);
    expect(side.bottomHalfWidth).toBeCloseTo(CUT * 0.3, 12);
  });
});
