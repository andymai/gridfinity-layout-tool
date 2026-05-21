import { describe, it, expect } from 'vitest';
import {
  estimateStandardBinVolume,
  estimateStandardBinFilament,
} from '@/shared/printSettings/standardBinVolume';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';

describe('standardBinVolume', () => {
  describe('estimateStandardBinVolume', () => {
    it('returns positive volume for a 1×1×3u bin', () => {
      const volume = estimateStandardBinVolume(1, 1, 3);
      expect(volume).toBeGreaterThan(0);
    });

    it('returns positive volume for fractional bins (0.5×0.5×2u)', () => {
      const volume = estimateStandardBinVolume(0.5, 0.5, 2);
      expect(volume).toBeGreaterThan(0);
    });

    it('is monotonic: larger bins have more volume', () => {
      const v1x1 = estimateStandardBinVolume(1, 1, 3);
      const v2x2 = estimateStandardBinVolume(2, 2, 3);
      const v3x3 = estimateStandardBinVolume(3, 3, 3);
      expect(v2x2).toBeGreaterThan(v1x1);
      expect(v3x3).toBeGreaterThan(v2x2);
    });

    it('is monotonic: taller bins have more volume', () => {
      const v3u = estimateStandardBinVolume(2, 2, 3);
      const v6u = estimateStandardBinVolume(2, 2, 6);
      expect(v6u).toBeGreaterThan(v3u);
    });

    it('0.6mm nozzle produces more material than 0.4mm (thicker walls)', () => {
      const v04 = estimateStandardBinVolume(2, 2, 3, 0.4);
      const v06 = estimateStandardBinVolume(2, 2, 3, 0.6);
      expect(v06).toBeGreaterThan(v04);
    });

    it('never returns negative volume', () => {
      // Tiny bin where walls might exceed interior
      const volume = estimateStandardBinVolume(0.5, 0.5, 2, 1.0);
      expect(volume).toBeGreaterThanOrEqual(0);
    });

    it('socket volume scales with gridUnitMm (regression: hardcoded 42mm cellSize)', () => {
      // Same bin spec at half-pitch (30mm) vs standard (42mm). Sockets are
      // per-cell shell structures whose footprint follows gridUnitMm — a
      // 30mm cell socket holds materially less material than a 42mm one.
      const standard = estimateStandardBinVolume(2, 2, 3, 0.4, 42);
      const halfPitch = estimateStandardBinVolume(2, 2, 3, 0.4, 30);
      expect(halfPitch).toBeLessThan(standard);
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

    it('is monotonic: larger bins cost more', () => {
      const small = estimateStandardBinFilament(1, 1, 3);
      const large = estimateStandardBinFilament(3, 3, 3);
      expect(large.metersFilament).toBeGreaterThan(small.metersFilament);
      expect(large.costUSD).toBeGreaterThan(small.costUSD);
      expect(large.printTimeMinutes).toBeGreaterThan(small.printTimeMinutes);
    });

    // Calibration regression: compare analytical model against the 4 real
    // PrusaSlicer data points within ±30%. The analytical model computes
    // solid geometry, not actual slicer toolpaths, so some deviation is expected.
    describe('calibration regression (±30% of slicer data)', () => {
      it('1×1×3u: ~2.3m from slicer', () => {
        const est = estimateStandardBinFilament(1, 1, 3);
        expect(est.metersFilament).toBeGreaterThan(2.3 * 0.7);
        expect(est.metersFilament).toBeLessThan(2.3 * 1.3);
      });

      it('1×2×3u: ~3.7m from slicer', () => {
        const est = estimateStandardBinFilament(1, 2, 3);
        expect(est.metersFilament).toBeGreaterThan(3.7 * 0.7);
        expect(est.metersFilament).toBeLessThan(3.7 * 1.3);
      });

      it('2×2×3u: ~5.6m from slicer', () => {
        const est = estimateStandardBinFilament(2, 2, 3);
        expect(est.metersFilament).toBeGreaterThan(5.6 * 0.7);
        expect(est.metersFilament).toBeLessThan(5.6 * 1.3);
      });

      it('3×3×3u: ~9.9m from slicer', () => {
        const est = estimateStandardBinFilament(3, 3, 3);
        expect(est.metersFilament).toBeGreaterThan(9.9 * 0.7);
        expect(est.metersFilament).toBeLessThan(9.9 * 1.3);
      });
    });

    it('uses nozzle size from settings', () => {
      const est04 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.4,
      });
      const est06 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.6,
      });
      // 0.6mm nozzle → thicker walls → more volume → more filament
      expect(est06.volumeMm3).toBeGreaterThan(est04.volumeMm3);
    });

    it('larger nozzle has lower time-per-meter (higher extrusion rate)', () => {
      const est04 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.4,
      });
      const est08 = estimateStandardBinFilament(2, 2, 3, {
        ...DEFAULT_PRINT_SETTINGS,
        nozzleSizeMm: 0.8,
      });
      const timePerMeter04 = est04.printTimeMinutes / est04.metersFilament;
      const timePerMeter08 = est08.printTimeMinutes / est08.metersFilament;
      expect(timePerMeter08).toBeLessThan(timePerMeter04);
    });
  });
});
