import { describe, it, expect } from 'vitest';
import {
  computeHandleSegments,
  computeHandleHoleGeometry,
  HOLE_VERTICAL_CENTER,
} from './handleCutoutClip';

describe('computeHandleSegments', () => {
  // wallSpan=80mm, handle centered at 70% width = 56mm
  // cutout centered, 50% width = 40mm
  it('suppresses both segments when cutout leaves only narrow offcuts', () => {
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 70,
      cutoutCenter: 0, // centered on wall
      cutoutWidth: 40,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle spans [-28, 28]. Cutout spans [-20, 20]. +1mm clearance -> [-21, 21].
    // Left segment: [-28, -21] = 7mm -> below 10mm min -> suppressed
    // Right segment: [21, 28] = 7mm -> below 10mm min -> suppressed
    expect(segments).toEqual([]);
  });

  it('returns full handle when no cutout overlaps', () => {
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 70,
      cutoutCenter: 0,
      cutoutWidth: 0, // no cutout
      clearance: 1,
      minSegmentWidth: 10,
    });
    // No cutout -> full handle: offset=0, width=56
    expect(segments).toEqual([{ offset: 0, width: 56 }]);
  });

  it('splits into two usable segments with wide wall', () => {
    // wallSpan=120mm, handle 80% = 96mm, cutout center=0, width=30mm
    const segments = computeHandleSegments({
      wallSpan: 120,
      handleWidthPercent: 80,
      cutoutCenter: 0,
      cutoutWidth: 30,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-48, 48]. Cutout: [-15, 15] + clearance -> [-16, 16].
    // Left: [-48, -16] = 32mm. Right: [16, 48] = 32mm.
    expect(segments).toHaveLength(2);
    expect(segments[0].width).toBeCloseTo(32);
    expect(segments[1].width).toBeCloseTo(32);
  });

  it('keeps one segment when cutout is left-aligned', () => {
    // wallSpan=80mm, handle 90% = 72mm, cutout left-aligned center=-25, width=20mm
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 90,
      cutoutCenter: -25,
      cutoutWidth: 20,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-36, 36]. Cutout: [-35, -15] + clearance -> [-36, -14].
    // Left: [-36, -36] = 0mm -> suppressed. Right: [-14, 36] = 50mm -> kept.
    expect(segments).toHaveLength(1);
    expect(segments[0].width).toBeCloseTo(50);
  });

  it('suppresses segments below minSegmentWidth', () => {
    const segments = computeHandleSegments({
      wallSpan: 80,
      handleWidthPercent: 70,
      cutoutCenter: -5,
      cutoutWidth: 50,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-28, 28]. Cutout: [-30, 20] + cl -> [-31, 21].
    // Left: [-28, -31] = negative -> suppressed. Right: [21, 28] = 7mm -> suppressed.
    expect(segments).toEqual([]);
  });

  it('returns full handle when cutout does not overlap handle at all', () => {
    // Narrow handle, cutout way off to the side
    const segments = computeHandleSegments({
      wallSpan: 120,
      handleWidthPercent: 30,
      cutoutCenter: 50,
      cutoutWidth: 20,
      clearance: 1,
      minSegmentWidth: 10,
    });
    // Handle: [-18, 18]. Cutout: [40, 60]. No overlap -> full handle.
    expect(segments).toEqual([{ offset: 0, width: 36 }]);
  });
});

describe('computeHandleHoleGeometry', () => {
  it('computes centerZ at 70% of interior height', () => {
    const { centerZ } = computeHandleHoleGeometry(100, 20);
    expect(centerZ).toBe(100 * HOLE_VERTICAL_CENTER);
  });

  it('clamps height to available space around centerZ', () => {
    // interiorHeight=100, centerZ=70, margin=10
    // maxHalfHeight = min(70, 30) - 10 = 20
    // effectiveHeight = min(requestedHeight=50, 40) = 40
    const { effectiveHeight } = computeHandleHoleGeometry(100, 50);
    expect(effectiveHeight).toBe(40);
  });

  it('returns requested height when it fits', () => {
    const { effectiveHeight } = computeHandleHoleGeometry(100, 20);
    expect(effectiveHeight).toBe(20);
  });

  it('returns effectiveHeight below 1 for very short interior', () => {
    // interiorHeight=2, centerZ=1.4, margin=0.2
    // maxHalfHeight = max(0, min(1.4, 0.6) - 0.2) = 0.4
    // effectiveHeight = min(10, 0.8) = 0.8 → below the <1 guard
    const { effectiveHeight } = computeHandleHoleGeometry(2, 10);
    expect(effectiveHeight).toBeLessThan(1);
  });
});
