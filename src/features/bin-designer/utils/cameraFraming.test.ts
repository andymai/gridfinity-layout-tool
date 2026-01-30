import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  ISOMETRIC_DIRECTION,
  FRAME_FILL,
  calculateIdealDistance,
} from '@/features/bin-designer/utils/cameraFraming';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

describe('cameraFraming', () => {
  describe('ISOMETRIC_DIRECTION', () => {
    it('is a normalized Vector3 with length approximately 1', () => {
      expect(ISOMETRIC_DIRECTION).toBeInstanceOf(Vector3);
      const length = ISOMETRIC_DIRECTION.length();
      expect(length).toBeCloseTo(1, 10);
    });

    it('has the expected x, y, z components after normalization', () => {
      // Original: (0.6, -0.6, 0.5)
      // Length = sqrt(0.36 + 0.36 + 0.25) = sqrt(0.97) ≈ 0.9849
      // Normalized: each component / 0.9849
      const expectedX = 0.6 / Math.sqrt(0.97);
      const expectedY = -0.6 / Math.sqrt(0.97);
      const expectedZ = 0.5 / Math.sqrt(0.97);

      expect(ISOMETRIC_DIRECTION.x).toBeCloseTo(expectedX, 5);
      expect(ISOMETRIC_DIRECTION.y).toBeCloseTo(expectedY, 5);
      expect(ISOMETRIC_DIRECTION.z).toBeCloseTo(expectedZ, 5);
    });
  });

  describe('FRAME_FILL', () => {
    it('equals 0.65', () => {
      expect(FRAME_FILL).toBe(0.65);
    });
  });

  describe('calculateIdealDistance', () => {
    it('returns positive distance for a standard 1x1x3 bin', () => {
      const distance = calculateIdealDistance(1, 1, 3, 50);
      expect(distance).toBeGreaterThan(0);
    });

    it('returns positive distance for a wide 4x2x3 bin', () => {
      const distance = calculateIdealDistance(4, 2, 3, 50);
      expect(distance).toBeGreaterThan(0);
    });

    it('returns positive distance for a tall 1x1x10 bin', () => {
      const distance = calculateIdealDistance(1, 1, 10, 50);
      expect(distance).toBeGreaterThan(0);
    });

    it('produces larger distance for wider bins', () => {
      const narrow = calculateIdealDistance(1, 1, 3, 50);
      const wide = calculateIdealDistance(4, 1, 3, 50);
      expect(wide).toBeGreaterThan(narrow);
    });

    it('produces larger distance for deeper bins', () => {
      const shallow = calculateIdealDistance(1, 1, 3, 50);
      const deep = calculateIdealDistance(1, 4, 3, 50);
      expect(deep).toBeGreaterThan(shallow);
    });

    it('produces larger distance for taller bins', () => {
      const short = calculateIdealDistance(1, 1, 3, 50);
      const tall = calculateIdealDistance(1, 1, 10, 50);
      expect(tall).toBeGreaterThan(short);
    });

    it('produces larger distance for smaller FOV (zoom effect)', () => {
      const wideFov = calculateIdealDistance(1, 1, 3, 75);
      const narrowFov = calculateIdealDistance(1, 1, 3, 30);
      expect(narrowFov).toBeGreaterThan(wideFov);
    });

    it('calculates expected distance for 1x1x3 bin at 50° FOV', () => {
      const distance = calculateIdealDistance(1, 1, 3, 50);

      // Calculate expected values using the source constants
      const halfW = (1 * GRIDFINITY.GRID_SIZE) / 2;
      const halfD = (1 * GRIDFINITY.GRID_SIZE) / 2;
      const halfH = (3 * GRIDFINITY.HEIGHT_UNIT) / 2;
      const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);
      const halfFovRad = (50 / 2) * (Math.PI / 180);
      const expected = (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);

      expect(distance).toBeCloseTo(expected, 2);
      // Also verify the approximate value from manual calculation
      expect(distance).toBeCloseTo(114.72, 0);
    });

    it('calculates expected distance for 2x2x5 bin at 60° FOV', () => {
      const distance = calculateIdealDistance(2, 2, 5, 60);

      const halfW = (2 * GRIDFINITY.GRID_SIZE) / 2;
      const halfD = (2 * GRIDFINITY.GRID_SIZE) / 2;
      const halfH = (5 * GRIDFINITY.HEIGHT_UNIT) / 2;
      const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);
      const halfFovRad = (60 / 2) * (Math.PI / 180);
      const expected = (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);

      expect(distance).toBeCloseTo(expected, 2);
      expect(distance).toBeCloseTo(190.47, 0);
    });

    it('handles half-unit dimensions', () => {
      const distance = calculateIdealDistance(0.5, 0.5, 2, 50);
      expect(distance).toBeGreaterThan(0);
      // Should be smaller than a 1x1x2 bin
      const fullUnit = calculateIdealDistance(1, 1, 2, 50);
      expect(distance).toBeLessThan(fullUnit);
    });

    it('scales proportionally with bin size', () => {
      // Doubling all dimensions should roughly double the bounding radius
      const small = calculateIdealDistance(1, 1, 2, 50);
      const large = calculateIdealDistance(2, 2, 4, 50);

      // Bounding radius scales with dimensions
      // For (1,1,2): radius = sqrt((21)² + (21)² + (7)²) = sqrt(931) ≈ 30.51
      // For (2,2,4): radius = sqrt((42)² + (42)² + (14)²) = sqrt(3724) ≈ 61.02
      // Ratio should be approximately 2
      expect(large / small).toBeCloseTo(2, 1);
    });

    it('distance increases inversely with FOV', () => {
      // Smaller FOV (more zoomed in) requires larger distance
      const fov90 = calculateIdealDistance(2, 2, 3, 90);
      const fov45 = calculateIdealDistance(2, 2, 3, 45);

      // sin(45°) / sin(22.5°) ≈ 0.707 / 0.383 ≈ 1.85
      const ratio = fov45 / fov90;
      expect(ratio).toBeGreaterThan(1.8);
      expect(ratio).toBeLessThan(2.0);
    });

    it('maintains consistent results for same inputs', () => {
      const first = calculateIdealDistance(3, 2, 5, 55);
      const second = calculateIdealDistance(3, 2, 5, 55);
      expect(first).toBe(second);
    });

    it('handles large bins correctly', () => {
      const distance = calculateIdealDistance(8, 8, 20, 50);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeGreaterThan(800); // Should be a large distance for large bin
    });

    it('handles minimum bin size', () => {
      const distance = calculateIdealDistance(0.5, 0.5, 2, 50);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // Should be relatively small
    });
  });
});
