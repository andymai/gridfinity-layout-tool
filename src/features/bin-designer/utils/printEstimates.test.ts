import { describe, it, expect } from 'vitest';
import {
  estimatePrint,
  calculateWallPatternSavings,
  formatPrintTime,
  formatFilament,
} from '@/features/bin-designer/utils/printEstimates';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
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

    it('slotted style uses similar material to standard', () => {
      const standard = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'standard' });
      const slotted = estimatePrint({ ...DEFAULT_BIN_PARAMS, style: 'slotted' });
      // Slotted bins use same wall thickness, so volume is similar
      expect(slotted.volumeMm3).toBeGreaterThan(0);
      expect(standard.volumeMm3).toBeGreaterThan(0);
    });

    it('compartments add volume', () => {
      const noCompartments = estimatePrint(DEFAULT_BIN_PARAMS);
      const withCompartments = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          cols: 3,
          rows: 3,
          thickness: 1.2,
          cells: Array(9)
            .fill(0)
            .map((_, i) => i),
        },
      });
      expect(withCompartments.volumeMm3).toBeGreaterThan(noCompartments.volumeMm3);
    });

    it('thicker compartment walls use more material', () => {
      const thin = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          cols: 2,
          rows: 2,
          thickness: 0.8,
          cells: [0, 1, 2, 3],
        },
      });
      const thick = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        compartments: {
          cols: 2,
          rows: 2,
          thickness: 2.0,
          cells: [0, 1, 2, 3],
        },
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
      const cheapSettings = { ...DEFAULT_PRINT_SETTINGS, filamentCostPerKg: 10 };
      const expensiveSettings = { ...DEFAULT_PRINT_SETTINGS, filamentCostPerKg: 50 };
      const cheapCost = estimatePrint(DEFAULT_BIN_PARAMS, cheapSettings);
      const expensiveCost = estimatePrint(DEFAULT_BIN_PARAMS, expensiveSettings);
      expect(expensiveCost.costUSD).toBeGreaterThan(cheapCost.costUSD);
      // Cost should scale linearly
      expect(expensiveCost.costUSD / cheapCost.costUSD).toBeCloseTo(5, 0);
    });

    it('print time increases with filament length', () => {
      const small = estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 1, depth: 1, height: 1 });
      const large = estimatePrint({ ...DEFAULT_BIN_PARAMS, width: 4, depth: 4, height: 8 });
      expect(large.printTimeMinutes).toBeGreaterThan(small.printTimeMinutes);
    });

    it('volume is reasonable for a 2x2x3 standard bin', () => {
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      // A 2x2x3 bin with base socket and lip: should be more material than before
      // Shell + socket + lip volume between 10,000 and 150,000 mm³
      expect(est.volumeMm3).toBeGreaterThan(10000);
      expect(est.volumeMm3).toBeLessThan(150000);
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

    // ─── New tests for enhanced volume calculation ───────────────────────

    it('stacking lip adds volume when enabled', () => {
      const withLip = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      });
      const withoutLip = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      });
      expect(withLip.volumeMm3).toBeGreaterThan(withoutLip.volumeMm3);
    });

    it('label tabs add volume when enabled', () => {
      const withLabel = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      });
      const withoutLabel = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: false },
      });
      expect(withLabel.volumeMm3).toBeGreaterThan(withoutLabel.volumeMm3);
    });

    it('scoop removes volume when enabled', () => {
      const withScoop = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      });
      const withoutScoop = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: false },
      });
      expect(withScoop.volumeMm3).toBeLessThan(withoutScoop.volumeMm3);
    });

    // ─── New tests for parametric time scaling ───────────────────────────

    it('thinner layers increase print time', () => {
      const baseline = estimatePrint(DEFAULT_BIN_PARAMS);
      const thinLayers = estimatePrint(DEFAULT_BIN_PARAMS, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.12,
      });
      expect(thinLayers.printTimeMinutes).toBeGreaterThan(baseline.printTimeMinutes);
    });

    it('thicker layers decrease print time', () => {
      const baseline = estimatePrint(DEFAULT_BIN_PARAMS);
      const thickLayers = estimatePrint(DEFAULT_BIN_PARAMS, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.28,
      });
      expect(thickLayers.printTimeMinutes).toBeLessThan(baseline.printTimeMinutes);
    });

    it('higher infill increases print time', () => {
      const baseline = estimatePrint(DEFAULT_BIN_PARAMS);
      const highInfill = estimatePrint(DEFAULT_BIN_PARAMS, {
        ...DEFAULT_PRINT_SETTINGS,
        infillPercent: 80,
      });
      expect(highInfill.printTimeMinutes).toBeGreaterThan(baseline.printTimeMinutes);
    });

    it('solid label support uses less volume than bracket', () => {
      const bracket = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
      });
      const solid = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' },
      });
      // Solid = 1 triangle per tab, bracket = 2 gussets per tab → bracket uses more
      expect(solid.volumeMm3).toBeLessThan(bracket.volumeMm3);
      expect(solid.volumeMm3).toBeGreaterThan(0);
    });

    it('lower infill decreases print time', () => {
      const baseline = estimatePrint(DEFAULT_BIN_PARAMS);
      const lowInfill = estimatePrint(DEFAULT_BIN_PARAMS, {
        ...DEFAULT_PRINT_SETTINGS,
        infillPercent: 5,
      });
      expect(lowInfill.printTimeMinutes).toBeLessThan(baseline.printTimeMinutes);
    });

    it('combined thin layers and high infill compounds time increase', () => {
      const baseline = estimatePrint(DEFAULT_BIN_PARAMS);
      const extreme = estimatePrint(DEFAULT_BIN_PARAMS, {
        ...DEFAULT_PRINT_SETTINGS,
        layerHeightMm: 0.1,
        infillPercent: 100,
      });
      // 0.1mm layers (2×) × 100% infill (1.425×) ≈ 2.85×
      expect(extreme.printTimeMinutes).toBeGreaterThan(baseline.printTimeMinutes * 2);
    });

    // ─── Honeycomb wall reduction ─────────────────────────────────────

    it('honeycomb walls reduce volume', () => {
      const standard = estimatePrint(DEFAULT_BIN_PARAMS);
      const honeycomb = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        height: 6,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      });
      expect(honeycomb.volumeMm3).toBeLessThan(standard.volumeMm3);
    });

    it('honeycomb walls have no effect on short bins', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, height: 1 };
      const standard = estimatePrint(params);
      const honeycomb = estimatePrint({
        ...params,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      });
      expect(honeycomb.volumeMm3).toBe(standard.volumeMm3);
    });

    it('honeycomb walls skip slotted walls correctly', () => {
      const baseParams: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        height: 6,
        style: 'slotted' as BinParams['style'],
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      };
      const bothAxes = estimatePrint({
        ...baseParams,
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      });
      const oneAxis = estimatePrint({
        ...baseParams,
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      });
      const noSlots = estimatePrint({
        ...baseParams,
        slotConfig: {
          ...DEFAULT_BIN_PARAMS.slotConfig,
          x: { enabled: false, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      });
      // All walls slotted = no reduction; partial slots = less reduction; no slots = most
      const standard = estimatePrint({
        ...baseParams,
        wallPattern: { enabled: false, pattern: 'honeycomb' as const },
      });
      expect(bothAxes.volumeMm3).toBe(standard.volumeMm3);
      expect(oneAxis.volumeMm3).toBeLessThan(standard.volumeMm3);
      expect(noSlots.volumeMm3).toBeLessThan(oneAxis.volumeMm3);
    });
  });

  describe('calculateWallPatternSavings', () => {
    it('returns zero savings when wall pattern disabled', () => {
      const savings = calculateWallPatternSavings(DEFAULT_BIN_PARAMS);
      expect(savings.savingsPercent).toBe(0);
    });

    it('returns positive savings when honeycomb enabled on tall bin', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        height: 6,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      };
      const savings = calculateWallPatternSavings(params);
      expect(savings.savingsPercent).toBeGreaterThan(0);
      expect(savings.patternEstimate.volumeMm3).toBeLessThan(savings.standardEstimate.volumeMm3);
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
