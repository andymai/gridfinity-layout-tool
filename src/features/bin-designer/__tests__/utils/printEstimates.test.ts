import { describe, it, expect } from 'vitest';
import { estimatePrint, formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';

describe('printEstimates', () => {
  describe('estimatePrint', () => {
    it('returns positive values for default params', () => {
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      expect(est.volumeMm3).toBeGreaterThan(0);
      expect(est.gramsFilament).toBeGreaterThan(0);
      expect(est.metersFilament).toBeGreaterThan(0);
      expect(est.printTimeMinutes).toBeGreaterThan(0);
      expect(est.costUSD).toBeGreaterThan(0);
    });

    it('larger bins have more volume', () => {
      const small = estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 1, depth: 1 });
      const large = estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 4, depth: 4 });
      expect(large.volumeMm3).toBeGreaterThan(small.volumeMm3);
    });

    it('taller bins have more material', () => {
      const short = estimatePrint({ ...DEFAULT_BIN_PARAMS, height: 2 });
      const tall = estimatePrint({ ...DEFAULT_BIN_PARAMS, height: 8 });
      expect(tall.gramsFilament).toBeGreaterThan(short.gramsFilament);
    });

    it('vase mode uses less material than standard', () => {
      const standard = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'standard' });
      const vase = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'vase' });
      expect(vase.volumeMm3).toBeLessThan(standard.volumeMm3);
    });

    it('solid style uses more material (thicker walls)', () => {
      const standard = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'standard' });
      const solid = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'solid' });
      expect(solid.volumeMm3).toBeGreaterThan(standard.volumeMm3);
    });

    it('rugged style uses more material (thick walls + gussets)', () => {
      const standard = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'standard' });
      const rugged = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'rugged' });
      expect(rugged.volumeMm3).toBeGreaterThan(standard.volumeMm3);
    });

    it('dividers add volume', () => {
      const noDividers = estimatePrint(DEFAULT_BIN_PARAMS);
      const withDividers = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 2, y: 2, thickness: 1.2 },
      });
      expect(withDividers.volumeMm3).toBeGreaterThan(noDividers.volumeMm3);
    });

    it('thicker dividers use more material', () => {
      const thin = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 1, y: 1, thickness: 0.8 },
      });
      const thick = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 1, y: 1, thickness: 2.0 },
      });
      expect(thick.volumeMm3).toBeGreaterThan(thin.volumeMm3);
    });

    it('filament grams is derived from volume', () => {
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      // PLA density: 1.24 g/cm³, volume in mm³ → cm³ / 1000
      const expectedGrams = (est.volumeMm3 / 1000) * 1.24;
      expect(est.gramsFilament).toBeCloseTo(expectedGrams, 0);
    });

    it('cost scales with filament usage', () => {
      const cheapCost = estimatePrint(DEFAULT_BIN_PARAMS, 10);
      const expensiveCost = estimatePrint(DEFAULT_BIN_PARAMS, 50);
      expect(expensiveCost.costUSD).toBeGreaterThan(cheapCost.costUSD);
      // Cost should scale linearly
      expect(expensiveCost.costUSD / cheapCost.costUSD).toBeCloseTo(5, 0);
    });

    it('print time increases with filament length', () => {
      const small = estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 1 });
      const large = estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 4, depth: 4, height: 8 });
      expect(large.printTimeMinutes).toBeGreaterThan(small.printTimeMinutes);
    });

    it('vase mode ignores dividers', () => {
      const vaseNoDividers = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        style: 'vase',
        dividers: { x: 0, y: 0, thickness: 1.2 },
      });
      const vaseWithDividers = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        style: 'vase',
        dividers: { x: 3, y: 3, thickness: 1.2 },
      });
      // Vase ignores dividers, so volumes should be equal
      expect(vaseWithDividers.volumeMm3).toBe(vaseNoDividers.volumeMm3);
    });

    it('volume is reasonable for a 2x2x3 standard bin', () => {
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      // A 2x2x3 bin is about 83.5 × 83.5 × 26 mm
      // Shell volume should be between 10,000 and 100,000 mm³
      expect(est.volumeMm3).toBeGreaterThan(10000);
      expect(est.volumeMm3).toBeLessThan(100000);
    });

    it('returns rounded values', () => {
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      // Volume should be integer
      expect(est.volumeMm3).toBe(Math.round(est.volumeMm3));
      // Time should be integer
      expect(est.printTimeMinutes).toBe(Math.round(est.printTimeMinutes));
      // Cost should have at most 2 decimals
      expect(est.costUSD * 100).toBeCloseTo(Math.round(est.costUSD * 100), 5);
    });

    it('handles half-unit dimensions', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 0.5, depth: 0.5 };
      const est = estimatePrint(params);
      expect(est.volumeMm3).toBeGreaterThan(0);
      expect(est.gramsFilament).toBeGreaterThan(0);
    });
  });

  describe('formatPrintTime', () => {
    it('formats minutes under 60 as Xm', () => {
      expect(formatPrintTime(30)).toBe('30m');
      expect(formatPrintTime(59)).toBe('59m');
    });

    it('formats exactly 60 minutes as 1h', () => {
      expect(formatPrintTime(60)).toBe('1h');
    });

    it('formats hours + minutes as XhYm', () => {
      expect(formatPrintTime(90)).toBe('1h 30m');
      expect(formatPrintTime(135)).toBe('2h 15m');
    });

    it('formats exact hours without minutes', () => {
      expect(formatPrintTime(120)).toBe('2h');
      expect(formatPrintTime(180)).toBe('3h');
    });
  });

  describe('formatFilament', () => {
    it('formats sub-meter values as cm', () => {
      expect(formatFilament(0.5)).toBe('50cm');
      expect(formatFilament(0.12)).toBe('12cm');
    });

    it('formats values >= 1m with one decimal', () => {
      expect(formatFilament(1.5)).toBe('1.5m');
      expect(formatFilament(3.25)).toBe('3.3m'); // Rounded to 1 decimal
    });

    it('formats exactly 1m', () => {
      expect(formatFilament(1.0)).toBe('1.0m');
    });
  });
});
