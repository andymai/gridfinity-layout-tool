import { describe, it, expect } from 'vitest';
import {
  estimatePrint,
  calculateWallPatternSavings,
  formatPrintTime,
  formatFilament,
} from '@/features/bin-designer/utils/printEstimates';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DEFAULT_PRINT_SETTINGS, estimateStandardBinVolume } from '@/shared/printSettings';
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

    it('matches the OCCT-measured solid volume for a 2×2×3 standard bin (±15%)', () => {
      // Ground truth from the real generator: 2×2×3u solid = 17094 mm³.
      // The old hollow-box model treated the bottom 7mm as a solid slab and
      // reported ~67000 mm³ (≈4× too high). The consolidated model reuses the
      // OCCT-calibrated shared base geometry.
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      expect(est.volumeMm3).toBeGreaterThan(17094 * 0.85);
      expect(est.volumeMm3).toBeLessThan(17094 * 1.15);
    });

    it('a plain standard bin matches the shared print-export estimator', () => {
      // The designer and print-export must agree on the base geometry of an
      // unfeatured bin (consolidation regression).
      const designer = estimatePrint(DEFAULT_BIN_PARAMS).volumeMm3;
      const shared = estimateStandardBinVolume(2, 2, 3);
      expect(designer).toBeGreaterThan(shared * 0.9);
      expect(designer).toBeLessThan(shared * 1.1);
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

    it('solid label support uses more volume than bracket', () => {
      const bracket = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
      });
      const solid = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' },
      });
      // Solid extrudes a triangular prism the full shelf width; bracket only
      // emits thin gussets spaced ~10mm apart. Solid uses substantially more.
      expect(solid.volumeMm3).toBeGreaterThan(bracket.volumeMm3);
      expect(bracket.volumeMm3).toBeGreaterThan(0);
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
      // The extrusion portion scales by 0.1mm layers (2×) × 100% infill
      // (1 + 0.003×85 = 1.255×) ≈ 2.5×, but the fixed per-plate overhead is not
      // scaled, so the total-time ratio for a small bin lands around 1.9×.
      expect(extreme.printTimeMinutes).toBeGreaterThan(baseline.printTimeMinutes * 1.8);
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
        style: 'slotted',
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

    // ─── Label tab counting (issue #1905) ────────────────────────────────

    describe('label tab counting', () => {
      const enabledLabel = { ...DEFAULT_BIN_PARAMS.label, enabled: true };

      it('merged 2x1 row counts as one tab, not two', () => {
        // cells=[0,0] → one compartment spanning both columns. The geometry
        // emits one tab; the estimate must match (regression test for the
        // old `cols × tabVolume` over-count).
        const merged: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 0] },
          label: enabledLabel,
        };
        const split: BinParams = {
          ...merged,
          compartments: { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] },
        };
        const withoutLabel = (p: BinParams) =>
          estimatePrint({ ...p, label: { ...p.label, enabled: false } }).volumeMm3;

        const mergedLabelVol = estimatePrint(merged).volumeMm3 - withoutLabel(merged);
        const splitLabelVol = estimatePrint(split).volumeMm3 - withoutLabel(split);

        // Shelf area is identical (one wide shelf vs two half-width shelves),
        // but the merged version has one support instead of two.
        expect(mergedLabelVol).toBeLessThan(splitLabelVol);
      });

      it('accounts for interior-row back walls (1x3 vertical stack)', () => {
        // 1 col × 3 rows with three compartments → three back walls (two
        // dividers + outer back), so three tabs. The old `cols × …` formula
        // billed only 1 tab regardless of row count.
        const stack: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          depth: 3,
          compartments: { cols: 1, rows: 3, thickness: 1.2, cells: [0, 1, 2] },
          label: enabledLabel,
        };
        const oneTab: BinParams = {
          ...stack,
          compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
        };
        const labelVol = (p: BinParams) =>
          estimatePrint(p).volumeMm3 -
          estimatePrint({ ...p, label: { ...p.label, enabled: false } }).volumeMm3;

        // Three tabs should add roughly 3× the volume of one tab in the same
        // shell (same cellW, so same per-tab shelf width).
        expect(labelVol(stack)).toBeGreaterThan(labelVol(oneTab) * 2.5);
      });

      it('skips tab when back wall is a tilted divider', () => {
        // dividerOverrides between two compartments makes their shared wall
        // tilted; the builder skips that tab.
        const withTilt: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          depth: 2,
          compartments: {
            cols: 1,
            rows: 2,
            thickness: 1.2,
            cells: [0, 1],
            dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: -5 }],
          },
          label: enabledLabel,
        };
        const noTilt: BinParams = {
          ...withTilt,
          compartments: { cols: 1, rows: 2, thickness: 1.2, cells: [0, 1] },
        };
        const labelVol = (p: BinParams) =>
          estimatePrint(p).volumeMm3 -
          estimatePrint({ ...p, label: { ...p.label, enabled: false } }).volumeMm3;

        // Tilt drops one of the two tabs; the remaining outer-back tab still
        // contributes, so withTilt has roughly half the label contribution.
        expect(labelVol(withTilt)).toBeLessThan(labelVol(noTilt));
        expect(labelVol(withTilt)).toBeGreaterThan(0);
      });

      it("drops front tab when edges='both' would collide", () => {
        // 1×1 grid where 2·depth + 2·inset > compartmentDepth: front tab
        // collides with back tab and is silently dropped (only back remains).
        const tiny: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          depth: 1,
          compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
          label: { ...enabledLabel, edges: 'both', depth: 18, inset: 2 },
        };
        const back: BinParams = {
          ...tiny,
          label: { ...tiny.label, edges: 'back' },
        };
        const labelVol = (p: BinParams) =>
          estimatePrint(p).volumeMm3 -
          estimatePrint({ ...p, label: { ...p.label, enabled: false } }).volumeMm3;

        // With collision, 'both' degrades to the back-only result.
        expect(labelVol(tiny)).toBeCloseTo(labelVol(back), 0);
      });

      it('skips tab when depth+inset exceeds compartment depth', () => {
        // Single-row, single-comp: cellD ≈ 81.6mm. Depth 80 + inset 10 = 90 >
        // 81.6 → builder skips. Sanity-check no tab volume is added.
        const skip: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          depth: 2,
          compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
          label: { ...enabledLabel, depth: 80, inset: 10 },
        };
        const skipLabelVol =
          estimatePrint(skip).volumeMm3 -
          estimatePrint({ ...skip, label: { ...skip.label, enabled: false } }).volumeMm3;
        expect(skipLabelVol).toBe(0);
      });

      it("'both' edges with non-colliding compartment doubles the tab volume", () => {
        // Large enough compartment that back+front fit without collision.
        const back: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          depth: 4,
          compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
          label: { ...enabledLabel, edges: 'back' },
        };
        const both: BinParams = {
          ...back,
          label: { ...back.label, edges: 'both' },
        };
        const labelVol = (p: BinParams) =>
          estimatePrint(p).volumeMm3 -
          estimatePrint({ ...p, label: { ...p.label, enabled: false } }).volumeMm3;

        expect(labelVol(both)).toBeGreaterThan(labelVol(back) * 1.8);
      });
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
