import { describe, it, expect } from 'vitest';
import {
  MAX_CUTOUT_CORNER_RADIUS,
  autoCornerRadius,
  computeCutoutCenter,
  resolveCutoutCornerRadii,
  safeCutoutCornerRadii,
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
