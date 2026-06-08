import { describe, it, expect } from 'vitest';
import {
  calcFilamentCost,
  calcSpoolPercentage,
  calcPrintTimeHours,
  estimatePrintJobs,
  formatPrintTime,
  formatCost,
  DEFAULT_METERS_PER_KG,
  DEFAULT_COST_PER_KG,
} from '@/features/print-export/utils/printEstimates';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

describe('printEstimates', () => {
  describe('estimatePrintJobs (plate count)', () => {
    it('returns 0 jobs for an empty layout (no overhead time)', () => {
      expect(estimatePrintJobs(0, 36)).toBe(0);
    });

    it('returns at least 1 job for any non-empty layout', () => {
      expect(estimatePrintJobs(1, 36)).toBe(1);
    });

    it('returns 1 job when everything fits on one plate', () => {
      // 20 grid cells of bins, a 36-cell bed → fits in one plate
      expect(estimatePrintJobs(20, 36)).toBe(1);
    });

    it('returns multiple plates when bins exceed one bed', () => {
      // 100 cells of bins on a 36-cell bed (×0.85 packing ≈ 30.6 usable) → ceil(100/30.6) = 4
      expect(estimatePrintJobs(100, 36)).toBe(4);
    });

    it('depends only on total footprint, not the number of distinct bin types', () => {
      // Regression for the old `rows.length` overhead: plate count is a pure
      // function of total footprint vs bed capacity.
      // 72 cells / (36 × 0.85 = 30.6) = ceil(2.35) = 3 plates.
      expect(estimatePrintJobs(72, 36)).toBe(3);
    });

    it('handles a zero-capacity bed without dividing by zero', () => {
      expect(estimatePrintJobs(10, 0)).toBe(1);
    });
  });
  describe('calcFilamentCost', () => {
    it('calculates cost correctly with default values', () => {
      // 330m @ $20/kg = 1kg = $20
      expect(calcFilamentCost(330)).toBe(20);
    });

    it('calculates cost with custom cost per kg', () => {
      // 330m @ $20/kg = 1kg = $20 (explicit)
      expect(calcFilamentCost(330, 20)).toBe(20);
    });

    it('calculates cost with custom meters per kg', () => {
      // 400m @ $20/kg with 400m/kg = 1kg = $20
      expect(calcFilamentCost(400, 20, 400)).toBe(20);
    });

    it('rounds to cents (2 decimal places)', () => {
      // 100m @ $20/kg with 330m/kg = 0.303kg × $20 = $6.060 → $6.06
      expect(calcFilamentCost(100)).toBe(6.06);
    });

    it('handles 0 filament', () => {
      expect(calcFilamentCost(0)).toBe(0);
    });

    it('handles very small amounts', () => {
      // 1m @ $20/kg = 0.003kg × $20 = $0.060 → $0.06
      expect(calcFilamentCost(1)).toBe(0.06);
    });

    it('handles very large amounts', () => {
      // 10000m = ~30.3kg × $20 = $606.06
      const cost = calcFilamentCost(10000);
      expect(cost).toBeCloseTo(606.06, 2);
    });

    it('preserves precision for exact values', () => {
      // 165m = 0.5kg × $20 = $10.00
      expect(calcFilamentCost(165)).toBe(10);
    });

    it('uses default constants correctly', () => {
      expect(DEFAULT_METERS_PER_KG).toBe(330);
      expect(DEFAULT_COST_PER_KG).toBe(DEFAULT_PRINT_SETTINGS.filamentCostPerKg);
    });
  });

  describe('calcSpoolPercentage', () => {
    it('calculates 100% for full spool', () => {
      expect(calcSpoolPercentage(330)).toBe(100);
    });

    it('calculates percentage for partial spool', () => {
      // 165m / 330m = 50%
      expect(calcSpoolPercentage(165)).toBe(50);
    });

    it('rounds to 1 decimal place', () => {
      // 100m / 330m = 30.303... → 30.3%
      expect(calcSpoolPercentage(100)).toBe(30.3);
    });

    it('handles 0 filament', () => {
      expect(calcSpoolPercentage(0)).toBe(0);
    });

    it('handles small amounts', () => {
      // 33m / 330m = 10%
      expect(calcSpoolPercentage(33)).toBe(10);
    });

    it('can exceed 100% for multi-spool usage', () => {
      // 660m / 330m = 200%
      expect(calcSpoolPercentage(660)).toBe(200);
    });

    it('uses custom meters per kg', () => {
      // 200m / 400m = 50%
      expect(calcSpoolPercentage(200, 400)).toBe(50);
    });
  });

  describe('calcPrintTimeHours', () => {
    it('calculates time for single job at baseline settings', () => {
      // Model: time = (1 × 16 min) + (0 × 3.6 × 1.0 × 1.0 × 1.0) = 16 min = 0.3h
      expect(calcPrintTimeHours(0, 1)).toBe(0.3);
    });

    it('calculates time based on filament at baseline', () => {
      // 2.3m: overhead=16 + extrusion=2.3×3.6×1.0×1.0×1.0 = 16 + 8.28 = 24.28 min = 0.4h
      expect(calcPrintTimeHours(2.3)).toBe(0.4);
    });

    it('calibrates correctly against real print data (1x1x3u)', () => {
      // 1×1×3u (2.3m) = 24 min according to calibration
      const hours = calcPrintTimeHours(2.3);
      expect(hours * 60).toBeCloseTo(24, 0);
    });

    it('calibrates correctly against real print data (2x2x3u)', () => {
      // 2×2×3u (5.6m) = 35 min according to calibration
      const hours = calcPrintTimeHours(5.6);
      expect(hours * 60).toBeCloseTo(36, 1); // Allow slight variance
    });

    it('calibrates correctly against real print data (3x3x3u)', () => {
      // 3×3×3u (9.9m) = ~52 min according to calibration
      const hours = calcPrintTimeHours(9.9);
      expect(hours * 60).toBeCloseTo(54, 0); // Allow for rounding
    });

    it('accounts for multiple print jobs', () => {
      // 2 jobs with 0 filament: 2 × 16 = 32 min = 0.5h
      expect(calcPrintTimeHours(0, 2)).toBe(0.5);
    });

    it('defaults to 1 print job', () => {
      // 10m at baseline: 16 + 10×3.6 = 52 min = 0.9h
      expect(calcPrintTimeHours(10)).toBe(0.9);
    });

    it('handles 0 filament and 0 jobs', () => {
      expect(calcPrintTimeHours(0, 0)).toBe(0);
    });

    it('rounds to 1 decimal hour', () => {
      const time = calcPrintTimeHours(5);
      expect(time.toString()).toMatch(/^\d+(\.\d)?$/);
    });

    it('scales time for thinner layer height', () => {
      const baseTime = calcPrintTimeHours(10, 1);
      const thinTime = calcPrintTimeHours(10, 1, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.1,
      });
      expect(thinTime).toBeGreaterThan(baseTime * 1.5);
    });

    it('scales time for higher infill', () => {
      const baseTime = calcPrintTimeHours(10, 1);
      const denseTime = calcPrintTimeHours(10, 1, {
        ...DEFAULT_PRINT_SETTINGS,
        infillPercent: 100,
      });
      expect(denseTime).toBeGreaterThan(baseTime);
    });

    it('larger nozzle reduces extrusion time', () => {
      const time04 = calcPrintTimeHours(10, 1, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.4,
      });
      const time06 = calcPrintTimeHours(10, 1, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.6,
      });
      expect(time06).toBeLessThan(time04);
    });
  });

  describe('formatPrintTime', () => {
    it('formats minutes-only for < 1 hour', () => {
      expect(formatPrintTime(0.5)).toBe('30m');
      expect(formatPrintTime(0.75)).toBe('45m');
    });

    it('formats hours-only when no minutes', () => {
      expect(formatPrintTime(1)).toBe('1h');
      expect(formatPrintTime(2)).toBe('2h');
    });

    it('formats hours and minutes', () => {
      expect(formatPrintTime(1.5)).toBe('1h 30m');
      expect(formatPrintTime(2.25)).toBe('2h 15m');
    });

    it('handles 0 hours', () => {
      expect(formatPrintTime(0)).toBe('0m');
    });

    it('handles fractional minutes by rounding', () => {
      // 0.99 hours = 59.4 minutes → rounds to 59m
      expect(formatPrintTime(0.99)).toBe('59m');
    });

    it('handles large values', () => {
      expect(formatPrintTime(24)).toBe('24h');
      expect(formatPrintTime(25.5)).toBe('25h 30m');
    });

    it('handles very small values', () => {
      expect(formatPrintTime(0.01)).toBe('1m');
      expect(formatPrintTime(0.016)).toBe('1m'); // 0.96 minutes rounds to 1
    });
  });

  describe('formatCost', () => {
    it('formats cost with dollar sign', () => {
      expect(formatCost(10)).toBe('$10.00');
    });

    it('formats cost with cents', () => {
      expect(formatCost(4.55)).toBe('$4.55');
    });

    it('formats 0 correctly', () => {
      expect(formatCost(0)).toBe('$0.00');
    });

    it('formats large amounts', () => {
      expect(formatCost(1234.56)).toBe('$1234.56');
    });

    it('pads single cent values', () => {
      expect(formatCost(1.5)).toBe('$1.50');
      expect(formatCost(0.5)).toBe('$0.50');
    });

    it('rounds to 2 decimal places', () => {
      expect(formatCost(1.999)).toBe('$2.00');
      expect(formatCost(1.234)).toBe('$1.23');
    });
  });
});
