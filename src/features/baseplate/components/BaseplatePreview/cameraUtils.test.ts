import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const { easeOutCubic, calculateIdealDistance, CAMERA_PRESETS, FRAME_FILL } =
  await import('./cameraUtils');

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
});
