import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import { createUniformGrid, getEligibleDividers } from './compartments';
import {
  ANGLE_UI_MAX_DEG,
  angleShiftToOffsets,
  applyAngleShift,
  getDividerGeometry,
  getLeanLimits,
  leanToFootTravel,
  offsetsToAngleShift,
  type DividerEnvelopeParams,
  type DividerGeometry,
} from './dividerAngle';

// 2×1 grid, 2u×1u bin → two side-by-side compartments sharing one vertical divider.
const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 1 };
// Pinned rather than derived: the tests below state lean limits as exact
// angles, and a shipped default height moving would silently retune them.
const DIVIDER_H = 30;
const envelope = (
  p: BinParams,
  over: Partial<DividerEnvelopeParams> = {}
): DividerEnvelopeParams => ({
  ...p,
  dividerHeightMm: DIVIDER_H,
  ...over,
});
const config = createUniformGrid(2, 1, 1.2);
const divider = getEligibleDividers(config)[0];
if (!divider) throw new Error('expected one eligible divider');

function geomFor(p: BinParams): DividerGeometry {
  const g = getDividerGeometry(envelope(p), config, divider);
  if (!g) throw new Error('expected geometry');
  return g;
}

// innerW = 2·42 − 0.5 − 2·1.2 = 81.1; innerD = 42 − 0.5 − 2.4 = 39.1
// vertical segment length = innerD = 39.1; each cell width = 40.55
const SEG_LEN = 39.1;

describe('dividerAngle', () => {
  describe('offsetsToAngleShift', () => {
    it('reads a symmetric tilt as a centered angle (shift 0)', () => {
      const { angleDeg, shiftMm } = offsetsToAngleShift(
        { offsetStart: -10, offsetEnd: 10, rakeDeg: 0 },
        SEG_LEN
      );
      expect(shiftMm).toBe(0);
      expect(angleDeg).toBeCloseTo((Math.atan2(20, SEG_LEN) * 180) / Math.PI, 1);
    });

    it('reads equal offsets as a pure shift (angle 0)', () => {
      const { angleDeg, shiftMm } = offsetsToAngleShift(
        { offsetStart: 7, offsetEnd: 7, rakeDeg: 0 },
        SEG_LEN
      );
      expect(angleDeg).toBe(0);
      expect(shiftMm).toBe(7);
    });

    it('is safe when the segment has zero length', () => {
      expect(offsetsToAngleShift({ offsetStart: 5, offsetEnd: -5, rakeDeg: 0 }, 0).angleDeg).toBe(
        0
      );
    });
  });

  describe('angleShiftToOffsets round-trips', () => {
    it('recovers the original offsets', () => {
      const original = { offsetStart: -8.3, offsetEnd: 12.1, rakeDeg: 0 };
      const as = offsetsToAngleShift(original, SEG_LEN);
      const back = angleShiftToOffsets(as, SEG_LEN);
      // Angle is rounded to 0.1° for display, so the round-trip drifts <0.05mm.
      expect(back.offsetStart).toBeCloseTo(original.offsetStart, 1);
      expect(back.offsetEnd).toBeCloseTo(original.offsetEnd, 1);
    });
  });

  describe('getDividerGeometry', () => {
    it('computes the segment length and offset envelope', () => {
      const geom = getDividerGeometry(envelope(params), config, divider);
      expect(geom).not.toBeNull();
      expect(geom?.segmentLengthMm).toBeCloseTo(SEG_LEN, 1);
      // each neighbour is 40.55mm wide; envelope = ±(40.55 − MIN_COMPARTMENT_SIZE)
      expect(geom?.offsetMax).toBeCloseTo(40.55 - 5, 1);
      expect(geom?.offsetMin).toBeCloseTo(-(40.55 - 5), 1);
    });

    it('returns null when the bin interior is non-positive', () => {
      expect(getDividerGeometry(envelope({ ...params, width: 0.05 }), config, divider)).toBeNull();
    });

    it('derives the depth-axis segment length from gridUnitMmY (non-square grid)', () => {
      // Vertical divider spans the Y axis, so its length tracks the Y pitch.
      // innerD = 1·22 − 0.5 − 2·1.2 = 19.1 (vs 39.1 for the default 42 pitch).
      const geom = getDividerGeometry(envelope({ ...params, gridUnitMmY: 22 }), config, divider);
      expect(geom?.segmentLengthMm).toBeCloseTo(19.1, 1);
    });
  });

  describe('applyAngleShift', () => {
    const geom = geomFor(params);

    it('caps the requested angle at the UI maximum', () => {
      const result = applyAngleShift({ angleDeg: 200, shiftMm: 0, leanDeg: 0 }, geom);
      expect(Math.abs(result.angleDeg)).toBeLessThanOrEqual(ANGLE_UI_MAX_DEG);
    });

    it('clamps to the geometric envelope and reports the reduced angle', () => {
      // A 60° tilt would need ±33.8mm of displacement; the envelope allows it
      // here, so force a tiny segment by shrinking depth and expect clamping.
      const narrowGeom = geomFor({ ...params, depth: 0.5 });
      const result = applyAngleShift(
        { angleDeg: ANGLE_UI_MAX_DEG, shiftMm: 0, leanDeg: 0 },
        narrowGeom
      );
      expect(result.offsetStart).toBeGreaterThanOrEqual(narrowGeom.offsetMin - 1e-6);
      expect(result.offsetEnd).toBeLessThanOrEqual(narrowGeom.offsetMax + 1e-6);
    });

    it('leaves the lean alone when it fits the envelope', () => {
      const result = applyAngleShift({ angleDeg: 0, shiftMm: 0, leanDeg: 30 }, geom);
      expect(result.rakeDeg).toBeCloseTo(30, 1);
      expect(result.leanDeg).toBeCloseTo(30, 1);
    });

    it('clamps the lean to the angle whose FOOT still fits its neighbour', () => {
      // Envelope is 35.55mm; a 30mm-tall divider reaches that at
      // atan(35.55 / 30) = 49.8 degrees, not the 60 the track offers. Floored,
      // so the control never shows a fraction nobody asked for.
      const result = applyAngleShift({ angleDeg: 0, shiftMm: 0, leanDeg: 60 }, geom);
      expect(result.rakeDeg).toBe(
        Math.floor((Math.atan2(geom.offsetMax, DIVIDER_H) * 180) / Math.PI)
      );
      expect(Number.isInteger(result.rakeDeg)).toBe(true);
    });

    it('a shift toward the neighbour costs the lean its headroom', () => {
      const straight = applyAngleShift({ angleDeg: 0, shiftMm: 0, leanDeg: 60 }, geom);
      const shifted = applyAngleShift({ angleDeg: 0, shiftMm: 20, leanDeg: 60 }, geom);
      expect(shifted.rakeDeg).toBeLessThan(straight.rakeDeg);
    });

    it('passes through a straight divider unchanged', () => {
      const result = applyAngleShift({ angleDeg: 0, shiftMm: 0, leanDeg: 0 }, geom);
      expect(result.offsetStart).toBe(0);
      expect(result.offsetEnd).toBe(0);
      expect(result.angleDeg).toBe(0);
    });
  });
});

describe('lean envelope', () => {
  const geom = geomFor(params);

  it('converts a lean to the travel its foot actually makes', () => {
    expect(leanToFootTravel(45, DIVIDER_H)).toBeCloseTo(DIVIDER_H, 5);
    expect(leanToFootTravel(0, DIVIDER_H)).toBe(0);
  });

  it('reports no lean at all on a divider with no height', () => {
    const flat = { ...geom, dividerHeightMm: 0 };
    expect(getLeanLimits(flat, { offsetStart: 0, offsetEnd: 0 })).toEqual({ minDeg: 0, maxDeg: 0 });
  });

  it('is asymmetric once the top line is off centre', () => {
    const limits = getLeanLimits(geom, { offsetStart: 10, offsetEnd: 10 });
    expect(limits.maxDeg).toBeLessThan(Math.abs(limits.minDeg));
  });

  it('a taller divider reaches a shallower angle for the same envelope', () => {
    const short = getLeanLimits({ ...geom, dividerHeightMm: 15 }, { offsetStart: 0, offsetEnd: 0 });
    const tall = getLeanLimits({ ...geom, dividerHeightMm: 60 }, { offsetStart: 0, offsetEnd: 0 });
    expect(tall.maxDeg).toBeLessThan(short.maxDeg);
  });
});
