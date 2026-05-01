import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const {
  easeOutCubic,
  calculateIdealDistance,
  calculateMaxOrbitDistance,
  CAMERA_PRESETS,
  FRAME_FILL,
  MAX_DISTANCE_FACTOR,
  MAX_DISTANCE_FLOOR,
} = await import('./cameraUtils');

describe('cameraUtils', () => {
  describe('easeOutCubic', () => {
    it('returns 0 at t=0', () => {
      expect(easeOutCubic(0)).toBe(0);
    });

    it('returns 1 at t=1', () => {
      expect(easeOutCubic(1)).toBe(1);
    });

    it('returns value between 0 and 1 for mid values', () => {
      const mid = easeOutCubic(0.5);
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(1);
    });
  });

  describe('calculateIdealDistance', () => {
    it('returns a positive distance', () => {
      const distance = calculateIdealDistance(4, 4, 42, 0, 0, 0, 0, 45);
      expect(distance).toBeGreaterThan(0);
    });

    it('increases with larger dimensions', () => {
      const small = calculateIdealDistance(2, 2, 42, 0, 0, 0, 0, 45);
      const large = calculateIdealDistance(8, 8, 42, 0, 0, 0, 0, 45);
      expect(large).toBeGreaterThan(small);
    });

    it('increases with padding', () => {
      const noPad = calculateIdealDistance(4, 4, 42, 0, 0, 0, 0, 45);
      const withPad = calculateIdealDistance(4, 4, 42, 10, 10, 10, 10, 45);
      expect(withPad).toBeGreaterThan(noPad);
    });
  });

  describe('CAMERA_PRESETS', () => {
    it('has all four presets', () => {
      expect(Object.keys(CAMERA_PRESETS)).toEqual(['front', 'side', 'top', 'isometric']);
    });
  });

  describe('FRAME_FILL', () => {
    it('is between 0 and 1', () => {
      expect(FRAME_FILL).toBeGreaterThan(0);
      expect(FRAME_FILL).toBeLessThan(1);
    });
  });

  describe('calculateMaxOrbitDistance', () => {
    it('respects the floor for tiny ideal distances', () => {
      expect(calculateMaxOrbitDistance(10)).toBe(MAX_DISTANCE_FLOOR);
    });

    it('scales with ideal distance once past the floor', () => {
      const ideal = MAX_DISTANCE_FLOOR; // exactly at the floor
      expect(calculateMaxOrbitDistance(ideal)).toBe(ideal * MAX_DISTANCE_FACTOR);
    });

    it('exceeds framing distance for the largest baseplate (16x16, 50mm padding/side)', () => {
      // Regression: maxDistance used to be hardcoded to 800, which clamped
      // before the framing distance for any baseplate above ~10x10 grid units.
      const ideal = calculateIdealDistance(16, 16, 42, 50, 50, 50, 50, 45);
      const max = calculateMaxOrbitDistance(ideal);
      expect(max).toBeGreaterThan(ideal);
      expect(max).toBeGreaterThan(800);
    });
  });
});
