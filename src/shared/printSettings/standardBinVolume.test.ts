import { describe, it, expect } from 'vitest';
import {
  estimateMeshFilament,
  estimateStandardBinVolume,
  estimateStandardBinFilament,
  standardBinSolidComponents,
} from '@/shared/printSettings/standardBinVolume';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

/**
 * Ground-truth solid volumes (mm³) measured from the REAL OCCT generator via
 * `measureVolume(getLastSolid())` for standard bins (socket base + stacking
 * lip, single compartment, default 42mm grid / 7mm height units).
 *
 * The analytical model is expected to reproduce these within ±10%.
 *
 * These numbers replace an earlier set that omitted the base socket entirely —
 * it recorded a 1×1×3u bin at 6241mm³ when a solid 1u foot alone is ~7300mm³,
 * so no bin standing on one could measure that little. The gap grew with cell
 * count (1.7× on a tall 1×1, 3.0× on a 3×3), which is the signature of a
 * missing per-cell term, and it is what `BASE_VOL_PER_CELL_AREA` was fitted to.
 *
 * Reproduce: `generateBin({ ...DEFAULT_BIN_PARAMS, forExport: true, width, depth, height })`
 * and take `meshVolume` of the returned mesh (see `__kernel-tests__/meshAssertions`).
 */
const OCCT_GROUND_TRUTH: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 1, 3, 14747],
  [1, 2, 3, 27716],
  [2, 2, 3, 51500],
  [3, 3, 3, 109884],
  [1, 1, 6, 18673],
  [2, 2, 6, 59660],
  [2, 2, 9, 67819],
  [1, 1, 2, 13438],
  [3, 2, 5, 82135],
  [4, 4, 6, 206526],
];

describe('standardBinVolume', () => {
  describe('estimateStandardBinVolume — OCCT ground-truth accuracy (±10%)', () => {
    for (const [w, d, h, truth] of OCCT_GROUND_TRUTH) {
      it(`${w}×${d}×${h}u ≈ ${truth}mm³ (real generated solid)`, () => {
        const volume = estimateStandardBinVolume(w, d, h);
        expect(volume).toBeGreaterThan(truth * 0.9);
        expect(volume).toBeLessThan(truth * 1.1);
      });
    }
  });

  describe('estimateStandardBinVolume — invariants', () => {
    it('returns positive volume for fractional bins (0.5×0.5×2u)', () => {
      expect(estimateStandardBinVolume(0.5, 0.5, 2)).toBeGreaterThan(0);
    });

    it('is monotonic in footprint and height', () => {
      expect(estimateStandardBinVolume(2, 2, 3)).toBeGreaterThan(
        estimateStandardBinVolume(1, 1, 3)
      );
      expect(estimateStandardBinVolume(3, 3, 3)).toBeGreaterThan(
        estimateStandardBinVolume(2, 2, 3)
      );
      expect(estimateStandardBinVolume(2, 2, 6)).toBeGreaterThan(
        estimateStandardBinVolume(2, 2, 3)
      );
    });

    it('never returns negative volume for tiny bins', () => {
      expect(estimateStandardBinVolume(0.5, 0.5, 2)).toBeGreaterThanOrEqual(0);
    });

    it('socket/base volume scales down with a smaller grid pitch', () => {
      // Half-pitch (30mm) cells hold materially less base material than 42mm.
      expect(estimateStandardBinVolume(2, 2, 3, 30)).toBeLessThan(
        estimateStandardBinVolume(2, 2, 3, 42)
      );
    });

    it('standardBinSolidComponents: gridUnitMmY defaults to the X pitch (square)', () => {
      const square = standardBinSolidComponents(2, 2, 3, 42, 7);
      const explicit = standardBinSolidComponents(2, 2, 3, 42, 7, 42);
      expect(explicit).toEqual(square);
    });

    it('standardBinSolidComponents: a shorter Y pitch reduces base + wall material', () => {
      // A 42×22 non-square bin has less depth than a 42×42 one, so both the
      // depth-scaled base (cell area) and perimeter walls shrink.
      const square = standardBinSolidComponents(2, 2, 3, 42, 7);
      const nonSquare = standardBinSolidComponents(2, 2, 3, 42, 7, 22);
      expect(nonSquare.base).toBeLessThan(square.base);
      expect(nonSquare.walls).toBeLessThan(square.walls);
      // Non-square Y equals treating the whole bin as a smaller square only on
      // the depth axis, so it must sit between a full 42 and a full 22 bin.
      const smallSquare = standardBinSolidComponents(2, 2, 3, 22, 7);
      expect(nonSquare.base).toBeGreaterThan(smallSquare.base);
    });

    it('is independent of nozzle size (bin CAD geometry is fixed)', () => {
      // The generated bin wall is a fixed spec thickness; the user's nozzle
      // only affects slicing/print-time, never the part volume. Volume must
      // not change with nozzle.
      const v04 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.4,
      }).volumeMm3;
      const v06 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.6,
      }).volumeMm3;
      expect(v06).toBe(v04);
    });
  });

  describe('estimateMeshFilament', () => {
    it('converts a measured volume: 10cm³ of PLA ≈ 12.4g', () => {
      const est = estimateMeshFilament(10_000);
      expect(est.gramsFilament).toBeCloseTo(12.4, 0);
      expect(est.volumeMm3).toBe(10_000);
      expect(est.metersFilament).toBeGreaterThan(0);
      expect(est.printTimeMinutes).toBeGreaterThan(0);
      expect(est.costUSD).toBeGreaterThan(0);
    });

    it('matches the standard-bin math for the same volume', () => {
      // Same volume in must produce the same filament out — the mesh
      // estimator shares the conversion with the standard-bin model.
      const standard = estimateStandardBinFilament(1, 1, 3);
      const mesh = estimateMeshFilament(standard.volumeMm3);
      expect(mesh.gramsFilament).toBeCloseTo(standard.gramsFilament, 1);
      expect(mesh.printTimeMinutes).toBe(standard.printTimeMinutes);
    });

    it('is monotonic in volume', () => {
      expect(estimateMeshFilament(20_000).printTimeMinutes).toBeGreaterThan(
        estimateMeshFilament(5_000).printTimeMinutes
      );
    });
  });

  describe('estimateStandardBinFilament', () => {
    it('returns all estimate fields', () => {
      const est = estimateStandardBinFilament(2, 2, 3);
      expect(est.volumeMm3).toBeGreaterThan(0);
      expect(est.gramsFilament).toBeGreaterThan(0);
      expect(est.metersFilament).toBeGreaterThan(0);
      expect(est.printTimeMinutes).toBeGreaterThan(0);
      expect(est.costUSD).toBeGreaterThan(0);
    });

    it('filament length matches the OCCT solid volume conversion (1×1×3u ≈ 6.13m)', () => {
      const est = estimateStandardBinFilament(1, 1, 3);
      // 14747mm³ / 2.405mm² / 1000 ≈ 6.13m
      expect(est.metersFilament).toBeGreaterThan(6.13 * 0.9);
      expect(est.metersFilament).toBeLessThan(6.13 * 1.1);
    });

    it('is monotonic: larger bins cost more and take longer', () => {
      const small = estimateStandardBinFilament(1, 1, 3);
      const large = estimateStandardBinFilament(3, 3, 3);
      expect(large.metersFilament).toBeGreaterThan(small.metersFilament);
      expect(large.costUSD).toBeGreaterThan(small.costUSD);
      expect(large.printTimeMinutes).toBeGreaterThan(small.printTimeMinutes);
    });

    it('larger nozzle prints faster (lower time) for the same part', () => {
      const est04 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.4,
      });
      const est08 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.8,
      });
      expect(est08.printTimeMinutes).toBeLessThan(est04.printTimeMinutes);
    });
  });
});
