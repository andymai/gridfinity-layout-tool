import { describe, it, expect } from 'vitest';
import {
  scalePrintTime,
  DEFAULT_PRINT_SETTINGS,
  BASELINE_LAYER_HEIGHT,
  BASELINE_INFILL,
  PLA_DENSITY,
  FILAMENT_AREA_MM2,
  METERS_PER_KG,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  PRINT_SETTINGS_CONSTRAINTS,
} from '@/shared/printSettings';

describe('shared printSettings', () => {
  describe('constants', () => {
    it('has expected PLA density', () => {
      expect(PLA_DENSITY).toBe(1.24);
    });

    it('has expected filament area for 1.75mm', () => {
      expect(FILAMENT_AREA_MM2).toBeCloseTo(Math.PI * (1.75 / 2) ** 2, 10);
    });

    it('has expected meters per kg', () => {
      expect(METERS_PER_KG).toBe(330);
    });

    it('has expected baseline calibration values', () => {
      expect(BASELINE_LAYER_HEIGHT).toBe(0.2);
      expect(BASELINE_INFILL).toBe(15);
      expect(OVERHEAD_MINUTES).toBe(16);
      expect(MINUTES_PER_METER).toBe(3.6);
    });
  });

  describe('DEFAULT_PRINT_SETTINGS', () => {
    it('has reasonable defaults', () => {
      expect(DEFAULT_PRINT_SETTINGS.filamentCostPerKg).toBe(20);
      expect(DEFAULT_PRINT_SETTINGS.layerHeightMm).toBe(0.2);
      expect(DEFAULT_PRINT_SETTINGS.infillPercent).toBe(15);
    });
  });

  describe('PRINT_SETTINGS_CONSTRAINTS', () => {
    it('has valid ranges', () => {
      expect(PRINT_SETTINGS_CONSTRAINTS.COST_MIN).toBeLessThan(PRINT_SETTINGS_CONSTRAINTS.COST_MAX);
      expect(PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MIN).toBeLessThan(
        PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX
      );
      expect(PRINT_SETTINGS_CONSTRAINTS.INFILL_MIN).toBeLessThan(
        PRINT_SETTINGS_CONSTRAINTS.INFILL_MAX
      );
    });

    it('defaults fall within constraints', () => {
      expect(DEFAULT_PRINT_SETTINGS.filamentCostPerKg).toBeGreaterThanOrEqual(
        PRINT_SETTINGS_CONSTRAINTS.COST_MIN
      );
      expect(DEFAULT_PRINT_SETTINGS.filamentCostPerKg).toBeLessThanOrEqual(
        PRINT_SETTINGS_CONSTRAINTS.COST_MAX
      );
      expect(DEFAULT_PRINT_SETTINGS.layerHeightMm).toBeGreaterThanOrEqual(
        PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MIN
      );
      expect(DEFAULT_PRINT_SETTINGS.layerHeightMm).toBeLessThanOrEqual(
        PRINT_SETTINGS_CONSTRAINTS.LAYER_HEIGHT_MAX
      );
      expect(DEFAULT_PRINT_SETTINGS.infillPercent).toBeGreaterThanOrEqual(
        PRINT_SETTINGS_CONSTRAINTS.INFILL_MIN
      );
      expect(DEFAULT_PRINT_SETTINGS.infillPercent).toBeLessThanOrEqual(
        PRINT_SETTINGS_CONSTRAINTS.INFILL_MAX
      );
    });
  });

  describe('scalePrintTime', () => {
    it('returns unchanged time at baseline settings', () => {
      const result = scalePrintTime(100, DEFAULT_PRINT_SETTINGS);
      expect(result).toBe(100);
    });

    it('increases time for thinner layers', () => {
      // 0.1mm = half of 0.2mm baseline → ~2× time
      const result = scalePrintTime(100, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.1,
      });
      expect(result).toBeCloseTo(200, 0);
    });

    it('decreases time for thicker layers', () => {
      // 0.28mm vs 0.2mm baseline → ~0.71× time
      const result = scalePrintTime(100, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.28,
      });
      expect(result).toBeLessThan(100);
      expect(result).toBeCloseTo(71.4, 0);
    });

    it('increases time for higher infill', () => {
      // 100% infill: scale = 1 + 0.005 * (100 - 15) = 1.425
      const result = scalePrintTime(100, {
        ...DEFAULT_PRINT_SETTINGS,
        infillPercent: 100,
      });
      expect(result).toBeCloseTo(142.5, 0);
    });

    it('decreases time for lower infill', () => {
      // 5% infill: scale = 1 + 0.005 * (5 - 15) = 0.95
      const result = scalePrintTime(100, {
        ...DEFAULT_PRINT_SETTINGS,
        infillPercent: 5,
      });
      expect(result).toBeCloseTo(95, 0);
    });

    it('combines layer height and infill scaling', () => {
      // 0.1mm layers (2×) + 100% infill (1.425×) = 2.85×
      const result = scalePrintTime(100, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.1,
        infillPercent: 100,
      });
      expect(result).toBeCloseTo(285, 0);
    });

    it('handles 0 input gracefully', () => {
      expect(scalePrintTime(0, DEFAULT_PRINT_SETTINGS)).toBe(0);
    });
  });
});
