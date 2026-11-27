import { describe, it, expect } from 'vitest';
import {
  FOOT_HOLE_MIN_WALL_MM,
  FOOT_UNDERSIDE_INSET_MM,
  GRIDFINITY_SPEC,
  NOZZLE_WALL_COUNTS,
  footHoleOffsetMm,
  magnetPadMarginForNozzle,
  wallThicknessForNozzle,
} from '@/shared/printSettings/gridfinityGeometry';

describe('gridfinityGeometry', () => {
  describe('GRIDFINITY_SPEC', () => {
    it('has correct grid size per Gridfinity standard', () => {
      expect(GRIDFINITY_SPEC.GRID_SIZE).toBe(42);
    });

    it('has correct height unit per Gridfinity standard', () => {
      expect(GRIDFINITY_SPEC.HEIGHT_UNIT).toBe(7);
    });

    it('has correct base height', () => {
      expect(GRIDFINITY_SPEC.BASE_HEIGHT).toBe(7);
    });

    it('has correct lip height (0.7 + 1.8 + 1.9 = 4.4)', () => {
      expect(GRIDFINITY_SPEC.LIP_HEIGHT).toBeCloseTo(
        GRIDFINITY_SPEC.LIP_SMALL_TAPER +
          GRIDFINITY_SPEC.LIP_VERTICAL_PART +
          GRIDFINITY_SPEC.LIP_BIG_TAPER,
        10
      );
    });

    it('has correct socket profile (0.8 + 1.8 + 2.15 = 4.75, the Gridfinity base profile)', () => {
      expect(GRIDFINITY_SPEC.SOCKET_HEIGHT).toBeCloseTo(4.75, 10);
      expect(GRIDFINITY_SPEC.SOCKET_SMALL_TAPER).toBe(0.8);
      expect(GRIDFINITY_SPEC.SOCKET_BIG_TAPER).toBe(2.15);
      // Vertical section = height minus the two 45° chamfers; must stay 1.8.
      expect(
        GRIDFINITY_SPEC.SOCKET_HEIGHT -
          GRIDFINITY_SPEC.SOCKET_SMALL_TAPER -
          GRIDFINITY_SPEC.SOCKET_BIG_TAPER
      ).toBeCloseTo(1.8, 10);
    });

    it('has correct wall thickness', () => {
      expect(GRIDFINITY_SPEC.WALL_THICKNESS).toBe(0.95);
    });

    it('has correct tolerance', () => {
      expect(GRIDFINITY_SPEC.TOLERANCE).toBe(0.5);
    });
  });

  describe('wallThicknessForNozzle', () => {
    it('returns 0.8mm for 0.4mm nozzle (2 perimeters)', () => {
      expect(wallThicknessForNozzle(0.4)).toBe(0.8);
    });

    it('returns 0.8mm for 0.2mm nozzle (4 perimeters)', () => {
      expect(wallThicknessForNozzle(0.2)).toBe(0.8);
    });

    it('returns 1.2mm for 0.6mm nozzle (2 perimeters)', () => {
      expect(wallThicknessForNozzle(0.6)).toBe(1.2);
    });

    it('returns 1.6mm for 0.8mm nozzle (2 perimeters)', () => {
      expect(wallThicknessForNozzle(0.8)).toBe(1.6);
    });

    it('returns 1.0mm for 1.0mm nozzle (1 perimeter)', () => {
      expect(wallThicknessForNozzle(1.0)).toBe(1.0);
    });

    it('falls back to GRIDFINITY_SPEC.WALL_THICKNESS for unknown nozzle size', () => {
      expect(wallThicknessForNozzle(0.35)).toBe(GRIDFINITY_SPEC.WALL_THICKNESS);
      expect(wallThicknessForNozzle(0.5)).toBe(GRIDFINITY_SPEC.WALL_THICKNESS);
    });
  });

  describe('NOZZLE_WALL_COUNTS', () => {
    it('has entries for all standard nozzle sizes', () => {
      expect(NOZZLE_WALL_COUNTS[0.2]).toBeDefined();
      expect(NOZZLE_WALL_COUNTS[0.4]).toBeDefined();
      expect(NOZZLE_WALL_COUNTS[0.6]).toBeDefined();
      expect(NOZZLE_WALL_COUNTS[0.8]).toBeDefined();
      expect(NOZZLE_WALL_COUNTS[1.0]).toBeDefined();
    });
  });

  describe('magnetPadMarginForNozzle', () => {
    it.each([
      [0.4, 1],
      [0.6, 1.9],
      [0.8, 2.5],
      [1.0, 2.0],
    ])('for a %smm nozzle, returns %smm margin', (nozzle, margin) => {
      expect(magnetPadMarginForNozzle(nozzle)).toBe(margin);
    });

    it('keeps omitted nozzle settings on the legacy margin', () => {
      expect(magnetPadMarginForNozzle()).toBe(1);
    });
  });

  describe('footHoleOffsetMm', () => {
    // A full 42mm foot's flat underside ends 17.8mm from its centre, and the
    // spec hole sits 13mm out, so a mouth up to 4.4mm wide keeps the wall.
    it('places the flat underside half the clearance plus both tapers inside the cell', () => {
      expect(FOOT_UNDERSIDE_INSET_MM).toBeCloseTo(3.2, 9);
    });

    it.each([
      ['the default 6.5mm magnet', 3.25],
      ['a chamfered default magnet', 4.05],
      ['an 8mm magnet', 4],
    ])('leaves %s where it is', (_, mouth) => {
      expect(footHoleOffsetMm(13, 42, mouth)).toBe(13);
      expect(footHoleOffsetMm(-13, 42, mouth)).toBe(-13);
    });

    it('pulls a 10mm magnet in just far enough to keep the wall', () => {
      const pulled = footHoleOffsetMm(13, 42, 5);
      expect(pulled).toBeCloseTo(12.4, 9);
      expect(21 - FOOT_UNDERSIDE_INSET_MM - pulled - 5).toBeCloseTo(FOOT_HOLE_MIN_WALL_MM, 9);
      expect(footHoleOffsetMm(-13, 42, 5)).toBeCloseTo(-12.4, 9);
    });

    it('pulls a chamfered mouth in by its full width', () => {
      expect(footHoleOffsetMm(13, 42, 5.8)).toBeCloseTo(11.6, 9);
    });

    it('measures each foot by its own span', () => {
      expect(footHoleOffsetMm(0, 21, 5)).toBe(0);
      expect(footHoleOffsetMm(7, 30, 5)).toBeCloseTo(6.4, 9);
    });

    it('never pulls a hole into its mirror across the foot', () => {
      // A 25mm cell leaves room for the wall only 3.9mm out, where two 10mm
      // holes would merge, so the hole keeps the place it had.
      expect(footHoleOffsetMm(13, 25, 5)).toBe(13);
      expect(footHoleOffsetMm(-13, 25, 5)).toBe(-13);
    });
  });
});
