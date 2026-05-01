import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/printSettings/gridfinityGeometry', () => ({
  GRIDFINITY_SPEC: { SOCKET_HEIGHT: 5 },
}));

const {
  easeOutCubic,
  calculateIdealDistance,
  calculateMaxOrbitDistance,
  calculateFarPlane,
  CAMERA_PRESETS,
  FRAME_FILL,
  MAX_DISTANCE_FACTOR,
  MAX_DISTANCE_FLOOR,
  FAR_PLANE_FLOOR,
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

    it('exceeds framing distance at the supported upper bound (50x50, 100mm padding/side)', () => {
      // Regression: maxDistance used to be hardcoded to 800, which clamped
      // before the framing distance for any baseplate above ~10x10 grid units.
      // GRID_MAX is 50 and PADDING_MAX is 100mm/side, so this is the true
      // worst case the panel can reach.
      const ideal = calculateIdealDistance(50, 50, 42, 100, 100, 100, 100, 45);
      const max = calculateMaxOrbitDistance(ideal);
      expect(max).toBeGreaterThan(ideal);
      expect(max).toBeGreaterThan(800);
    });
  });

  describe('calculateFarPlane', () => {
    it('respects the floor for tiny zoom-out caps', () => {
      expect(calculateFarPlane(10)).toBe(FAR_PLANE_FLOOR);
    });

    it('keeps geometry inside the frustum at the supported upper bound', () => {
      // Regression: with the camera at maxOrbitDistance, the far corner of
      // the slab still has to sit inside the frustum or it clips off-screen.
      const ideal = calculateIdealDistance(50, 50, 42, 100, 100, 100, 100, 45);
      const max = calculateMaxOrbitDistance(ideal);
      const far = calculateFarPlane(max);

      // Bounding sphere of the baseplate (slab + socket height).
      const halfW = (50 * 42 + 100 + 100) / 2;
      const boundingRadius = Math.sqrt(2 * halfW * halfW);

      // Camera at maxOrbitDistance from center, so the farthest corner of
      // the slab is `max + boundingRadius` from the camera.
      expect(far).toBeGreaterThan(max + boundingRadius);
    });
  });
});
