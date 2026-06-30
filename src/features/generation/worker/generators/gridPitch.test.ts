import { describe, it, expect } from 'vitest';
import { resolvePitch, isAnisotropicPitch, pitchFromParams, pitchKeySegments } from './gridPitch';
import { SIZE } from './generatorConstants';

describe('gridPitch', () => {
  describe('resolvePitch', () => {
    it('expands a scalar into a square pitch', () => {
      expect(resolvePitch(42)).toEqual({ x: 42, y: 42 });
    });

    it('passes an explicit pitch through', () => {
      expect(resolvePitch({ x: 42, y: 22 })).toEqual({ x: 42, y: 22 });
    });

    it('falls back to SIZE for undefined (legacy designs)', () => {
      expect(resolvePitch(undefined)).toEqual({ x: SIZE, y: SIZE });
    });

    it('honors a custom fallback', () => {
      expect(resolvePitch(undefined, 50)).toEqual({ x: 50, y: 50 });
    });
  });

  describe('isAnisotropicPitch', () => {
    it('is false for a scalar (square)', () => {
      expect(isAnisotropicPitch(42)).toBe(false);
    });

    it('is false for an equal-axis pitch', () => {
      expect(isAnisotropicPitch({ x: 42, y: 42 })).toBe(false);
    });

    it('is true when axes differ', () => {
      expect(isAnisotropicPitch({ x: 42, y: 22 })).toBe(true);
    });
  });

  describe('pitchFromParams', () => {
    it('uses gridUnitMm for both axes when gridUnitMmY is absent', () => {
      expect(pitchFromParams({ gridUnitMm: 42 })).toEqual({ x: 42, y: 42 });
    });

    it('uses gridUnitMmY for the Y axis when present', () => {
      expect(pitchFromParams({ gridUnitMm: 42, gridUnitMmY: 22 })).toEqual({ x: 42, y: 22 });
    });

    it('falls back to SIZE when gridUnitMm is absent', () => {
      expect(pitchFromParams({})).toEqual({ x: SIZE, y: SIZE });
    });
  });

  describe('pitchKeySegments', () => {
    const q = (n: number): number => n;

    it('emits no segment for a square pitch (keeps cache keys byte-identical)', () => {
      expect(pitchKeySegments({ x: 42, y: 42 }, q)).toEqual([]);
    });

    it('emits a gy: segment only when anisotropic', () => {
      expect(pitchKeySegments({ x: 42, y: 22 }, q)).toEqual(['gy:22']);
    });
  });
});
