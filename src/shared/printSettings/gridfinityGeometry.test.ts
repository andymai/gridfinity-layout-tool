import { describe, it, expect } from 'vitest';
import {
  GRIDFINITY_SPEC,
  NOZZLE_WALL_COUNTS,
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

    it('has correct socket height', () => {
      expect(GRIDFINITY_SPEC.SOCKET_HEIGHT).toBe(5);
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
});
