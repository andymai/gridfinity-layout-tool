import { describe, it, expect } from 'vitest';
import { createCorrugatedSpec, CORRUGATED_MIN_WALL_THICKNESS } from './patterns/corrugatedPattern';

describe('corrugatedWallBuilder', () => {
  describe('spec generation', () => {
    it('creates valid spec for standard bin parameters', () => {
      // 2×2 bin at 4u height, 1.6mm walls
      const spec = createCorrugatedSpec(1.6, 28, 80.8, 4);
      expect(spec).not.toBeNull();
      expect(spec!.amplitude).toBeCloseTo(0.64);
      expect(spec!.waveCount).toBeGreaterThanOrEqual(1);
      expect(spec!.patternH).toBeGreaterThan(0);
    });

    it('rejects thin walls', () => {
      const spec = createCorrugatedSpec(0.8, 28, 80.8, 4);
      expect(spec).toBeNull();
    });

    it('rejects very short walls', () => {
      // Wall height of 5mm with 1.6mm bottom keepout and 1.5mm top = 1.9mm patternH
      // Wavelength for height=4 is ~12mm, half = 6mm > 1.9mm → null
      const spec = createCorrugatedSpec(1.6, 5, 80.8, 4);
      expect(spec).toBeNull();
    });

    it('adapts wavelength to bin height', () => {
      const shortSpec = createCorrugatedSpec(1.6, 21, 40, 3);
      const tallSpec = createCorrugatedSpec(1.6, 56, 40, 8);
      expect(shortSpec).not.toBeNull();
      expect(tallSpec).not.toBeNull();
      // Tall bins use longer wavelength
      expect(tallSpec!.wavelength).toBeGreaterThan(shortSpec!.wavelength);
    });

    it('exports minimum wall thickness constant', () => {
      expect(CORRUGATED_MIN_WALL_THICKNESS).toBe(1.6);
    });
  });
});
