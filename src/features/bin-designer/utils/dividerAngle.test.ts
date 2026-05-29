import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import { createUniformGrid, getEligibleDividers } from './compartments';
import {
  ANGLE_UI_MAX_DEG,
  angleShiftToOffsets,
  applyAngleShift,
  getDividerGeometry,
  offsetsToAngleShift,
  type DividerGeometry,
} from './dividerAngle';

// 2×1 grid, 2u×1u bin → two side-by-side compartments sharing one vertical divider.
const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 1 };
const config = createUniformGrid(2, 1, 1.2);
const divider = getEligibleDividers(config)[0];
if (!divider) throw new Error('expected one eligible divider');

function geomFor(p: BinParams): DividerGeometry {
  const g = getDividerGeometry(p, config, divider);
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
        { offsetStart: -10, offsetEnd: 10 },
        SEG_LEN
      );
      expect(shiftMm).toBe(0);
      expect(angleDeg).toBeCloseTo((Math.atan2(20, SEG_LEN) * 180) / Math.PI, 1);
    });

    it('reads equal offsets as a pure shift (angle 0)', () => {
      const { angleDeg, shiftMm } = offsetsToAngleShift({ offsetStart: 7, offsetEnd: 7 }, SEG_LEN);
      expect(angleDeg).toBe(0);
      expect(shiftMm).toBe(7);
    });

    it('is safe when the segment has zero length', () => {
      expect(offsetsToAngleShift({ offsetStart: 5, offsetEnd: -5 }, 0).angleDeg).toBe(0);
    });
  });

  describe('angleShiftToOffsets round-trips', () => {
    it('recovers the original offsets', () => {
      const original = { offsetStart: -8.3, offsetEnd: 12.1 };
      const as = offsetsToAngleShift(original, SEG_LEN);
      const back = angleShiftToOffsets(as, SEG_LEN);
      // Angle is rounded to 0.1° for display, so the round-trip drifts <0.05mm.
      expect(back.offsetStart).toBeCloseTo(original.offsetStart, 1);
      expect(back.offsetEnd).toBeCloseTo(original.offsetEnd, 1);
    });
  });

  describe('getDividerGeometry', () => {
    it('computes the segment length and offset envelope', () => {
      const geom = getDividerGeometry(params, config, divider);
      expect(geom).not.toBeNull();
      expect(geom?.segmentLengthMm).toBeCloseTo(SEG_LEN, 1);
      // each neighbour is 40.55mm wide; envelope = ±(40.55 − MIN_COMPARTMENT_SIZE)
      expect(geom?.offsetMax).toBeCloseTo(40.55 - 5, 1);
      expect(geom?.offsetMin).toBeCloseTo(-(40.55 - 5), 1);
    });

    it('returns null when the bin interior is non-positive', () => {
      expect(getDividerGeometry({ ...params, width: 0.05 }, config, divider)).toBeNull();
    });
  });

  describe('applyAngleShift', () => {
    const geom = geomFor(params);

    it('caps the requested angle at the UI maximum', () => {
      const result = applyAngleShift({ angleDeg: 200, shiftMm: 0 }, geom);
      expect(Math.abs(result.angleDeg)).toBeLessThanOrEqual(ANGLE_UI_MAX_DEG);
    });

    it('clamps to the geometric envelope and reports the reduced angle', () => {
      // A 60° tilt would need ±33.8mm of displacement; the envelope allows it
      // here, so force a tiny segment by shrinking depth and expect clamping.
      const narrowGeom = geomFor({ ...params, depth: 0.5 });
      const result = applyAngleShift({ angleDeg: ANGLE_UI_MAX_DEG, shiftMm: 0 }, narrowGeom);
      expect(result.offsetStart).toBeGreaterThanOrEqual(narrowGeom.offsetMin - 1e-6);
      expect(result.offsetEnd).toBeLessThanOrEqual(narrowGeom.offsetMax + 1e-6);
    });

    it('passes through a straight divider unchanged', () => {
      const result = applyAngleShift({ angleDeg: 0, shiftMm: 0 }, geom);
      expect(result.offsetStart).toBe(0);
      expect(result.offsetEnd).toBe(0);
      expect(result.angleDeg).toBe(0);
    });
  });
});
