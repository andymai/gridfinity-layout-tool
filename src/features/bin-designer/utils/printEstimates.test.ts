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

    // The estimate follows the PLAN, not the request: a half-lattice 1-wide
    // bin places no detachable feet, so the pipeline keeps the integral socket
    // and the readout must keep its volume (it under-reported by ~60%).
    it('prices an unplaceable detachable request as the integral bin it builds', () => {
      const base: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 1,
        depth: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, footLatticeX: 'half' },
      };
      const integral = estimatePrint(base);
      const requested = estimatePrint({
        ...base,
        base: { ...base.base, feet: 'detachable' },
      });
      expect(requested.volumeMm3).toBe(integral.volumeMm3);
    });

    // A slab-only base (underside relief, detachable feet) loses only
    // wallThickness of material under each hole; booking the full-socket
    // share roughly halved a 3x3 estimate for a few cm³ of real removal.
    it('prices a floor pattern on a slab-only base as the slab prism it cuts', () => {
      const relief: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true, lightweightMode: 'underside' },
      };
      const plain = estimatePrint(relief).volumeMm3;
      const patterned = estimatePrint({
        ...relief,
        floorPattern: { enabled: true, pattern: 'honeycomb' },
      }).volumeMm3;
      const removed = plain - patterned;
      expect(removed).toBeGreaterThan(0);
      // The whole slab inside the walls is planArea-ish x 1.2mm ≈ 19cm³; the
      // pattern's open share of it can only be a fraction of that. The old
      // full-socket share booked ~25cm³ — more than the slab itself.
      expect(removed).toBeLessThan(10_000);
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
      // Ground truth from the real generator: 2×2×3u solid = 51500 mm³.
      const est = estimatePrint(DEFAULT_BIN_PARAMS);
      expect(est.volumeMm3).toBeGreaterThan(51500 * 0.85);
      expect(est.volumeMm3).toBeLessThan(51500 * 1.15);
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

    it('scoop adds volume when enabled (#4085)', () => {
      // A ramp is fused into the wall-floor corner; it is material, not a cut.
      const withScoop = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      });
      const withoutScoop = estimatePrint({
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: false },
      });
      expect(withScoop.volumeMm3).toBeGreaterThan(withoutScoop.volumeMm3);
    });

    it('a straight scoop adds more material than a curved one of the same size', () => {
      // Under a straight bevel the whole triangle (½·run·height) is filled;
      // under a curved arc only the wedge outside the quarter-ellipse
      // ((1 − π/4)·run·height ≈ 0.215).
      const base = {
        ...DEFAULT_BIN_PARAMS,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 12, run: 12 },
      } as const;
      const curved = estimatePrint({
        ...base,
        scoop: { ...base.scoop, style: 'curved' as const },
      });
      const straight = estimatePrint({
        ...base,
        scoop: { ...base.scoop, style: 'straight' as const },
      });
      expect(straight.volumeMm3).toBeGreaterThan(curved.volumeMm3);
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

    it('scales the saving with the number of patterned walls (#2966)', () => {
      const base: BinParams = { ...DEFAULT_BIN_PARAMS, height: 6 };
      const solid = estimatePrint(base).volumeMm3;
      const allWalls = estimatePrint({
        ...base,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      }).volumeMm3;
      const frontOnly = estimatePrint({
        ...base,
        wallPattern: {
          enabled: true,
          pattern: 'honeycomb' as const,
          sides: { left: false, right: false, front: true, back: false },
        },
      }).volumeMm3;
      expect(frontOnly).toBeLessThan(solid);
      expect(frontOnly).toBeGreaterThan(allWalls);
      // A square bin: one of four equal walls should save about a quarter.
      // Within a whole mm³, because `volumeMm3` is rounded to an integer before
      // it is returned — a quarter of a four-way split lands on a .25 whenever
      // the total is not a multiple of four.
      expect(solid - frontOnly).toBeCloseTo((solid - allWalls) / 4, 0);
    });

    it('still counts the divider saving when every outer wall is deselected', () => {
      const base: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        height: 6,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      };
      const dividersOnly = estimatePrint({
        ...base,
        wallPattern: {
          enabled: true,
          pattern: 'honeycomb' as const,
          dividers: true,
          sides: { left: false, right: false, front: false, back: false },
        },
      });
      expect(dividersOnly.volumeMm3).toBeLessThan(estimatePrint(base).volumeMm3);
    });

    it('shortening the dividers reduces the estimate', () => {
      const base: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        height: 6,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      };
      const full = estimatePrint(base);
      const short = estimatePrint({
        ...base,
        compartments: { ...base.compartments, dividerHeight: 10 },
      });
      expect(short.volumeMm3).toBeLessThan(full.volumeMm3);
    });

    it('patterning the dividers removes more material still', () => {
      const base: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        height: 6,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      };
      const wallsOnly = estimatePrint({
        ...base,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: false },
      });
      const withDividers = estimatePrint({
        ...base,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: true },
      });
      expect(withDividers.volumeMm3).toBeLessThan(wallsOnly.volumeMm3);
      // The dividers are a small share of the bin, so the extra saving must be
      // meaningful but nowhere near the outer walls' contribution.
      const solid = estimatePrint(base);
      expect(wallsOnly.volumeMm3 - withDividers.volumeMm3).toBeLessThan(
        solid.volumeMm3 - wallsOnly.volumeMm3
      );
    });

    it('does not subtract divider pattern volume where the worker never patterns', () => {
      const base: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 3,
        depth: 3,
        height: 6,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      };
      // A polygon footprint drops dividers from the feature pipeline entirely,
      // so the estimate must not claim the saving.
      const mask = {
        cols: 6,
        rows: 6,
        cells: Array.from({ length: 36 }, (_, i): 0 | 1 => (i < 30 ? 1 : 0)),
      };
      const off = estimatePrint({
        ...base,
        cellMask: mask,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: false },
      });
      const on = estimatePrint({
        ...base,
        cellMask: mask,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: true },
      });
      expect(on.volumeMm3).toBe(off.volumeMm3);
    });

    it('patterning the dividers is inert without dividers to pattern', () => {
      const base: BinParams = { ...DEFAULT_BIN_PARAMS, height: 6 };
      const off = estimatePrint({
        ...base,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: false },
      });
      const on = estimatePrint({
        ...base,
        wallPattern: { enabled: true, pattern: 'honeycomb' as const, dividers: true },
      });
      expect(on.volumeMm3).toBe(off.volumeMm3);
    });

    it('drainage holes remove material from the floor and the feet', () => {
      const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 4 };
      const off = estimatePrint(base);
      const on = estimatePrint({
        ...base,
        floorPattern: { enabled: true, pattern: 'round' as const, scale: 0.5 },
      });
      expect(on.volumeMm3).toBeLessThan(off.volumeMm3);
      // The holes only reach the base, so the saving can never exceed the base
      // component — a raw prism-volume term blew past that by ~4x.
      expect(off.volumeMm3 - on.volumeMm3).toBeLessThan(off.volumeMm3 * 0.4);
    });

    it('drainage holes save less on a flat base (no feet to perforate)', () => {
      const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 4 };
      const floorPattern = { enabled: true, pattern: 'round' as const, scale: 0.5 };
      const socketSaving =
        estimatePrint(base).volumeMm3 - estimatePrint({ ...base, floorPattern }).volumeMm3;
      const flat = { ...base, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const } };
      const flatSaving =
        estimatePrint(flat).volumeMm3 - estimatePrint({ ...flat, floorPattern }).volumeMm3;
      expect(flatSaving).toBeGreaterThan(0);
      expect(flatSaving).toBeLessThan(socketSaving);
    });

    it('half sockets quarter each foot, so the holes remove less', () => {
      const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 4 };
      const floorPattern = { enabled: true, pattern: 'round' as const, scale: 0.5 };
      const fullFoot =
        estimatePrint(base).volumeMm3 - estimatePrint({ ...base, floorPattern }).volumeMm3;
      const halved = { ...base, base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } };
      const quarterFeet =
        estimatePrint(halved).volumeMm3 - estimatePrint({ ...halved, floorPattern }).volumeMm3;
      expect(quarterFeet).toBeGreaterThan(0);
      expect(quarterFeet).toBeLessThan(fullFoot);
    });

    it('a custom footprint only counts the feet it actually grows', () => {
      const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 4 };
      const floorPattern = { enabled: true, pattern: 'round' as const, scale: 0.5 };
      const full =
        estimatePrint(base).volumeMm3 - estimatePrint({ ...base, floorPattern }).volumeMm3;
      // An L: three of the four cells filled, so three feet carry windows.
      const maskedCells: (0 | 1)[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0];
      const masked = {
        ...base,
        cellMask: {
          cols: 4,
          rows: 4,
          cells: maskedCells,
        },
      };
      const partial =
        estimatePrint(masked).volumeMm3 - estimatePrint({ ...masked, floorPattern }).volumeMm3;
      expect(partial).toBeGreaterThan(0);
      // As a ratio, not an absolute: both sides are differences of rounded
      // volumes, so an absolute tolerance of 0.5 sits inside the rounding noise.
      expect(partial / full).toBeCloseTo(0.75, 2);
    });

    it('drainage holes are inert on the bases the worker never patterns', () => {
      const floorPattern = { enabled: true, pattern: 'round' as const, scale: 0.5 };
      for (const overrides of [
        { base: { ...DEFAULT_BIN_PARAMS.base, solid: true } },
        { base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true } },
        // Solid STYLE without `base.solid` — a runtime constraint rule ties the
        // two, but migration doesn't, so a crafted design can carry just one.
        { style: 'solid' as const },
      ]) {
        const base: BinParams = { ...DEFAULT_BIN_PARAMS, height: 4, ...overrides };
        expect(estimatePrint({ ...base, floorPattern }).volumeMm3).toBe(
          estimatePrint(base).volumeMm3
        );
      }
    });

    // The underside relief keeps the slab, so unlike the interior mode above it
    // is NOT in the inert list — it patterns the floor like a standard bin.
    it('drainage holes still count on an underside-relieved base', () => {
      const base: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        height: 4,
        base: {
          ...DEFAULT_BIN_PARAMS.base,
          lightweight: true,
          lightweightMode: 'underside' as const,
        },
      };
      const floorPattern = { enabled: true, pattern: 'round' as const, scale: 0.5 };
      expect(estimatePrint({ ...base, floorPattern }).volumeMm3).toBeLessThan(
        estimatePrint(base).volumeMm3
      );
    });

    // Measured per-cell savings, not a re-derivation: generating each variant
    // and differencing against a solid base gives 6398 / 5174 / 4332 / 2458 mm³
    // per 42mm cell, constant to the millimetre from 1x1 to 3x3.
    it('books the measured per-cell saving for each lightweight variant', () => {
      const at = (over: Partial<BinParams['base']>): number =>
        estimatePrint({
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, ...over },
        }).volumeMm3;
      const solid = at({});
      const cells = DEFAULT_BIN_PARAMS.width * DEFAULT_BIN_PARAMS.depth;
      const perCell = (over: Partial<BinParams['base']>): number => (solid - at(over)) / cells;

      expect(perCell({ lightweight: true })).toBeCloseTo(6398, -1);
      expect(perCell({ lightweight: true, lightweightMode: 'underside' })).toBeCloseTo(5174, -1);
    });

    // A half-socket base subdivides every foot, so the shell has four times the
    // wall to leave standing and saves markedly less. Same direction, own number.
    it('saves less on half sockets than on full ones', () => {
      const at = (over: Partial<BinParams['base']>): number =>
        estimatePrint({
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, ...over },
        }).volumeMm3;
      const full = at({ halfSockets: false }) - at({ halfSockets: false, lightweight: true });
      const half = at({ halfSockets: true }) - at({ halfSockets: true, lightweight: true });
      expect(half).toBeGreaterThan(0);
      expect(half).toBeLessThan(full);
    });

    // The flag is inert without a socket to shell, so a crafted payload must not
    // buy the saving on a flat or lid base.
    it('books no saving on a socketless base', () => {
      for (const style of ['flat', 'lid'] as const) {
        const base: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          base: { ...DEFAULT_BIN_PARAMS.base, style },
        };
        expect(
          estimatePrint({ ...base, base: { ...base.base, lightweight: true } }).volumeMm3
        ).toBe(estimatePrint(base).volumeMm3);
      }
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

    // ─── Label tab counting ────────────────────────────────

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
    // A base-only bin is feet + floor slab + an optional lip. Every other term
    // in the estimate is fabricated for it: the wall term prices a `height`-tall
    // wall that is never built, out of a `height` that is inert on a tray.
    describe('base-only bin', () => {
      const tray = (overrides: Partial<BinParams['base']> = {}): BinParams => ({
        ...DEFAULT_BIN_PARAMS,
        height: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, tile: true, ...overrides },
      });

      // Asserted as "the wall it does not build" rather than as a fraction of
      // the whole bin. A base-only bin is feet + slab, and the feet dominate: at
      // the corrected base calibration a 2x2 plate is ~82% of a 2x2x3 bin, not
      // the ~60% an earlier fixed ratio assumed when the base term was 4.3x too
      // small. The invariant that survives is the one the code implements.
      it('drops exactly the wall term against an ordinary bin at the same footprint', () => {
        const tileVolume = estimatePrint(tray()).volumeMm3;
        const plain3 = estimatePrint({ ...DEFAULT_BIN_PARAMS, height: 3 }).volumeMm3;
        const plain6 = estimatePrint({ ...DEFAULT_BIN_PARAMS, height: 6 }).volumeMm3;
        expect(tileVolume).toBeLessThan(plain3);
        // The gap IS the wall, so a taller bin widens it by its extra wall.
        expect(plain6 - tileVolume).toBeGreaterThan(plain3 - tileVolume);
      });

      it('ignores the inert stored height', () => {
        const short = estimatePrint(tray()).volumeMm3;
        const tall = estimatePrint({ ...tray(), height: 8 }).volumeMm3;
        expect(tall).toBeCloseTo(short, 6);
      });

      it('drops the lip term when the tray has no lip', () => {
        const lipped = estimatePrint(tray()).volumeMm3;
        const bare = estimatePrint(tray({ stackingLip: false })).volumeMm3;
        expect(bare).toBeLessThan(lipped);
      });

      // The flag is inert on a socketless base (no feet to stand on), so a
      // crafted payload must not buy the cheaper estimate.
      it('leaves a socketless base on the ordinary derivation', () => {
        const flat: BinParams = {
          ...DEFAULT_BIN_PARAMS,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', tile: true },
        };
        const withoutFlag: BinParams = {
          ...flat,
          base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
        };
        expect(estimatePrint(flat).volumeMm3).toBeCloseTo(estimatePrint(withoutFlag).volumeMm3, 6);
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

  /**
   * Ground truth measured from the real generator: the BODY plus the FEET,
   * because that is what the user prints. Recorded rather than derived — the
   * per-foot constants this exercises were themselves measured, so checking
   * them against arithmetic would only prove the arithmetic.
   */
  describe('detachable feet — measured ground truth (±5%)', () => {
    const ASSEMBLY_MM3: ReadonlyArray<readonly [number, number, number]> = [
      [1, 1, 9459],
      [3, 2, 39024],
      [2, 4, 50233],
      [6, 3, 91974],
      [1, 4, 27872],
    ];

    for (const [w, d, truth] of ASSEMBLY_MM3) {
      it(`${w}x${d}x3u assembly ≈ ${truth}mm³`, () => {
        const volume = estimatePrint({
          ...DEFAULT_BIN_PARAMS,
          width: w,
          depth: d,
          height: 3,
          base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable' },
        }).volumeMm3;
        expect(volume).toBeGreaterThan(truth * 0.95);
        expect(volume).toBeLessThan(truth * 1.05);
      });
    }

    it('always costs less than the same bin with integral feet', () => {
      for (const [w, d] of ASSEMBLY_MM3) {
        const base = { ...DEFAULT_BIN_PARAMS, width: w, depth: d, height: 3 };
        const integral = estimatePrint(base).volumeMm3;
        const detachable = estimatePrint({
          ...base,
          base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable' },
        }).volumeMm3;
        expect(detachable).toBeLessThan(integral);
      }
    });

    it('is inert on a base with no feet to detach', () => {
      const flat = {
        ...DEFAULT_BIN_PARAMS,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const },
      };
      expect(estimatePrint({ ...flat, base: { ...flat.base, feet: 'detachable' } }).volumeMm3).toBe(
        estimatePrint(flat).volumeMm3
      );
    });
  });

  it('does not stack the lightweight saving on top of the feet saving', () => {
    // Both flags can be stored at once: the panel LOCKS lightweight rather than
    // clearing it, and the generator makes it inert. Subtracting both drove the
    // base term negative and reported a saving of 91% on a bin that saves 46%.
    const base = { ...DEFAULT_BIN_PARAMS, width: 3, depth: 2, height: 6 };
    const feetOnly = estimatePrint({
      ...base,
      base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable' },
    }).volumeMm3;
    const both = estimatePrint({
      ...base,
      base: { ...DEFAULT_BIN_PARAMS.base, feet: 'detachable', lightweight: true },
    }).volumeMm3;
    expect(both).toBe(feetOnly);
    expect(both).toBeGreaterThan(0);
  });
});
