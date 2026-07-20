import { describe, it, expect } from 'vitest';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_PLATE_THICKNESS_MM,
  LABEL_SOCKET_CLEARANCE_MM,
  LABEL_SOCKET_POCKET_DEPTH_MM,
  LABEL_SOCKET_RIB_HEIGHT_MM,
  LABEL_SOCKET_RIB_PROTRUSION_MM,
  LABEL_SOCKET_RIB_START_MM,
  LABEL_SOCKET_SHELF_THICKNESS_MM,
  LABEL_PLATE_WIDTHS_U,
  effectiveLabelSocketClearance,
  isLabelPlateWidthU,
  labelPlateWidthMm,
  labelSocketOuterWidthMm,
  largestFittingPlateWidthU,
} from './labelPlates';

describe('labelPlates', () => {
  // Pinned against the Cullenect v2.0.0 SCAD source — these are interchange
  // dimensions; a drift here breaks compatibility with ecosystem plates.
  it('matches the pinned v2.0.0 plate spec', () => {
    expect(labelPlateWidthMm(1)).toBe(36);
    expect(labelPlateWidthMm(2)).toBe(78);
    expect(labelPlateWidthMm(3)).toBe(120);
    expect(LABEL_PLATE_HEIGHT_MM).toBe(11);
    expect(LABEL_PLATE_THICKNESS_MM).toBe(1.2);
    expect(LABEL_SOCKET_CLEARANCE_MM).toBe(0.3);
    expect(LABEL_SOCKET_POCKET_DEPTH_MM).toBe(1.2);
    expect(LABEL_SOCKET_RIB_PROTRUSION_MM).toBe(0.2);
    expect(LABEL_SOCKET_RIB_HEIGHT_MM).toBe(0.4);
    expect(LABEL_SOCKET_RIB_START_MM).toBe(0.2);
  });

  it('shelf thickness hosts the pocket plus a solid floor', () => {
    expect(LABEL_SOCKET_SHELF_THICKNESS_MM).toBeGreaterThan(LABEL_SOCKET_POCKET_DEPTH_MM);
  });

  it('guards plate width values', () => {
    expect(LABEL_PLATE_WIDTHS_U).toEqual([1, 2, 3]);
    expect(isLabelPlateWidthU(2)).toBe(true);
    expect(isLabelPlateWidthU(4)).toBe(false);
    expect(isLabelPlateWidthU(null)).toBe(false);
    expect(isLabelPlateWidthU('1')).toBe(false);
  });

  describe('effectiveLabelSocketClearance', () => {
    it('returns the spec clearance at baseline with no offset', () => {
      expect(effectiveLabelSocketClearance(undefined, undefined)).toBe(0.3);
      expect(effectiveLabelSocketClearance(0.4, 0)).toBe(0.3);
    });

    it('applies the signed fit offset', () => {
      expect(effectiveLabelSocketClearance(undefined, 0.1)).toBeCloseTo(0.4);
      expect(effectiveLabelSocketClearance(undefined, -0.2)).toBeCloseTo(0.1);
    });

    it('grows with nozzles above the baseline', () => {
      expect(effectiveLabelSocketClearance(0.6, 0)).toBeCloseTo(0.4);
    });

    it('never goes negative and ignores non-finite offsets', () => {
      expect(effectiveLabelSocketClearance(undefined, -5)).toBe(0);
      expect(effectiveLabelSocketClearance(undefined, Number.NaN)).toBe(0.3);
    });
  });

  describe('largestFittingPlateWidthU', () => {
    it('picks the largest standard width whose socket fits', () => {
      // 1U bin interior at default walls: 39.1mm — hosts a 1U socket (38.3).
      expect(largestFittingPlateWidthU(39.1, 0.3)).toBe(1);
      expect(largestFittingPlateWidthU(labelSocketOuterWidthMm(2, 0.3), 0.3)).toBe(2);
      expect(largestFittingPlateWidthU(1000, 0.3)).toBe(3);
    });

    it('returns null when even 1U does not fit', () => {
      expect(largestFittingPlateWidthU(38, 0.3)).toBeNull();
      expect(largestFittingPlateWidthU(0, 0.3)).toBeNull();
    });
  });
});
