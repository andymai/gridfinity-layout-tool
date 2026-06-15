import { describe, it, expect } from 'vitest';

const {
  easeOutCubic,
  calculateIdealDistance,
  calculateStackIdealDistance,
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

    it('pulls camera closer for a wide plate in a landscape viewport', () => {
      // For a width-dominant plate (outerW >> outerD), the width constraint
      // drives idealDistance. A landscape viewport (aspect > 1) can fit that
      // width with the camera sitting closer; the distance must be smaller than
      // in a square viewport where the full diagonal is the limiting factor.
      const square = calculateIdealDistance(8, 2, 42, 0, 0, 0, 0, 45, 1.0);
      const wide = calculateIdealDistance(8, 2, 42, 0, 0, 0, 0, 45, 1.5);
      expect(wide).toBeLessThan(square);
    });

    it('frames a wide plate without letterboxing in a landscape viewport', () => {
      // Regression: a 10×2 plate in a 1.5:1 viewport used to be framed by the
      // bounding-sphere diagonal, leaving the plate occupying only ~12% of
      // viewport height. With aspect-aware framing the width constraint drives
      // the distance and the plate fills FRAME_FILL of the narrower viewport axis.
      const fov = 45;
      const aspect = 1.5;
      const dist = calculateIdealDistance(10, 2, 42, 0, 0, 0, 0, fov, aspect);
      const halfFovTan = Math.tan((fov / 2) * (Math.PI / 180));
      const outerW = 10 * 42;
      const outerD = 2 * 42;
      const halfVisibleW = dist * halfFovTan * aspect;
      const halfVisibleH = dist * halfFovTan;
      // Both plate dimensions must fit inside the framed viewport.
      expect(outerW / 2).toBeLessThanOrEqual(halfVisibleW + 0.01);
      expect(outerD / 2).toBeLessThanOrEqual(halfVisibleH + 0.01);
      // Width drives the framing, so it fills exactly FRAME_FILL of the
      // visible width (within floating-point tolerance).
      expect(outerW / 2 / halfVisibleW).toBeCloseTo(FRAME_FILL, 5);
    });
  });

  describe('calculateStackIdealDistance', () => {
    it('returns a positive distance', () => {
      expect(calculateStackIdealDistance(200, 200, 50, 45)).toBeGreaterThan(0);
    });

    it('increases with taller stacks', () => {
      const short = calculateStackIdealDistance(200, 200, 20, 45);
      const tall = calculateStackIdealDistance(200, 200, 100, 45);
      expect(tall).toBeGreaterThan(short);
    });

    it('accounts for height so tall stacks fit in the view', () => {
      const heightMm = 100;
      const widthMm = 200;
      const depthMm = 200;
      const fov = 45;
      const dist = calculateStackIdealDistance(widthMm, depthMm, heightMm, fov);
      // Bounding sphere must fit inside the FOV at this distance.
      const boundingRadius = Math.sqrt(
        (widthMm / 2) ** 2 + (depthMm / 2) ** 2 + (heightMm / 2) ** 2
      );
      const halfFovRad = (fov / 2) * (Math.PI / 180);
      expect(dist * Math.sin(halfFovRad)).toBeCloseTo(boundingRadius / FRAME_FILL, 3);
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

      // Bounding sphere of the baseplate footprint (width only, height not framed).
      const halfW = (50 * 42 + 100 + 100) / 2;
      const boundingRadius = Math.sqrt(2 * halfW * halfW);

      // Camera at maxOrbitDistance from center, so the farthest corner of
      // the slab is `max + boundingRadius` from the camera.
      expect(far).toBeGreaterThan(max + boundingRadius);
    });
  });
});
