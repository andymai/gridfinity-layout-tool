import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { calculateIdealDistance, calculateBinCenter } from './previewCanvasCamera';

const GRID = 42;
const HEIGHT = 7;
const FOV = 45;
// Mirrors the module-private FRAME_FILL — the live preview frames the bin's
// bounding sphere to fill this fraction of the viewport.
const FRAME_FILL = 0.65;

function expectedDistance(
  w: number,
  d: number,
  h: number,
  fov = FOV,
  grid = GRID,
  height = HEIGHT
): number {
  const halfW = (w * grid) / 2;
  const halfD = (d * grid) / 2;
  const halfH = (h * height) / 2;
  const boundingRadius = Math.sqrt(halfW * halfW + halfD * halfD + halfH * halfH);
  const halfFovRad = (fov / 2) * (Math.PI / 180);
  return (boundingRadius / Math.sin(halfFovRad)) * (1 / FRAME_FILL);
}

describe('previewCanvasCamera framing math', () => {
  describe('calculateIdealDistance', () => {
    it('returns a positive, finite distance across bin sizes', () => {
      for (const [w, d, h] of [
        [0.5, 0.5, 1],
        [1, 1, 3],
        [4, 2, 6],
        [12, 12, 20],
      ] as const) {
        const dist = calculateIdealDistance(w, d, h, FOV, GRID, HEIGHT);
        expect(dist).toBeGreaterThan(0);
        expect(Number.isFinite(dist)).toBe(true);
      }
    });

    it('applies the FRAME_FILL factor (matches the bounding-sphere formula)', () => {
      expect(calculateIdealDistance(2, 2, 3, FOV, GRID, HEIGHT)).toBeCloseTo(
        expectedDistance(2, 2, 3),
        6
      );
      expect(calculateIdealDistance(5, 3, 8, 60, GRID, HEIGHT)).toBeCloseTo(
        expectedDistance(5, 3, 8, 60),
        6
      );
    });

    it('increases monotonically with each dimension', () => {
      const base = calculateIdealDistance(2, 2, 3, FOV, GRID, HEIGHT);
      expect(calculateIdealDistance(4, 2, 3, FOV, GRID, HEIGHT)).toBeGreaterThan(base);
      expect(calculateIdealDistance(2, 4, 3, FOV, GRID, HEIGHT)).toBeGreaterThan(base);
      expect(calculateIdealDistance(2, 2, 6, FOV, GRID, HEIGHT)).toBeGreaterThan(base);
    });

    it('zooms out (greater distance) for a narrower FOV', () => {
      const wideFov = calculateIdealDistance(2, 2, 3, 75, GRID, HEIGHT);
      const narrowFov = calculateIdealDistance(2, 2, 3, 30, GRID, HEIGHT);
      expect(narrowFov).toBeGreaterThan(wideFov);
    });

    it('reflects custom grid and height units', () => {
      const base = calculateIdealDistance(2, 2, 3, FOV, GRID, HEIGHT);
      expect(calculateIdealDistance(2, 2, 3, FOV, 50, HEIGHT)).toBeGreaterThan(base);
      expect(calculateIdealDistance(2, 2, 3, FOV, GRID, 14)).toBeGreaterThan(base);
    });
  });

  describe('calculateBinCenter', () => {
    it('centers on XY origin with z at half the bin height', () => {
      const center = calculateBinCenter(3, 2, 4, HEIGHT);
      expect(center).toBeInstanceOf(Vector3);
      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
      expect(center.z).toBeCloseTo((4 * HEIGHT) / 2, 10);
    });

    it('depends only on height, not on width or depth', () => {
      const a = calculateBinCenter(1, 1, 5, HEIGHT);
      const b = calculateBinCenter(9, 7, 5, HEIGHT);
      expect(b.z).toBe(a.z);
    });

    it('scales z with a custom height unit', () => {
      expect(calculateBinCenter(2, 2, 3, 14).z).toBeCloseTo((3 * 14) / 2, 10);
    });
  });
});
