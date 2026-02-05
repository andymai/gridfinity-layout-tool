import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { getEffectiveBounds, computeBounds, clampPosition, getEffectiveDepth } from './geometry';

const createCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'test',
  shape: 'rectangle',
  x: 10,
  y: 10,
  width: 20,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('geometry', () => {
  describe('getEffectiveBounds', () => {
    it('returns correct bounds for rectangle', () => {
      const cutout = createCutout({ x: 5, y: 10, width: 20, depth: 15 });
      const bounds = getEffectiveBounds(cutout);
      expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 25 });
    });

    it('returns square bounds for circle (uses width as diameter)', () => {
      const cutout = createCutout({ shape: 'circle', x: 5, y: 10, width: 20 });
      const bounds = getEffectiveBounds(cutout);
      expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 30 });
    });
  });

  describe('computeBounds', () => {
    it('returns zero bounds for empty array', () => {
      const bounds = computeBounds([]);
      expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });

    it('computes bounds for single cutout', () => {
      const cutout = createCutout({ x: 5, y: 10, width: 20, depth: 15 });
      const bounds = computeBounds([cutout]);
      expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 25, maxY: 25 });
    });

    it('computes combined bounds for multiple cutouts', () => {
      const c1 = createCutout({ x: 0, y: 0, width: 10, depth: 10 });
      const c2 = createCutout({ x: 20, y: 20, width: 10, depth: 10 });
      const bounds = computeBounds([c1, c2]);
      expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 30 });
    });
  });

  describe('clampPosition', () => {
    it('clamps position to keep cutout within bounds', () => {
      const cutout = createCutout({ x: 50, y: 50, width: 20, depth: 15 });
      const result = clampPosition(cutout, 40, 40);
      expect(result.x).toBe(20);
      expect(result.y).toBe(25);
    });

    it('clamps negative positions to zero', () => {
      const cutout = createCutout({ x: -5, y: -10, width: 20, depth: 15 });
      const result = clampPosition(cutout, 100, 100);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('does not clamp positions already in bounds', () => {
      const cutout = createCutout({ x: 10, y: 10, width: 20, depth: 15 });
      const result = clampPosition(cutout, 100, 100);
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });
  });

  describe('getEffectiveDepth', () => {
    it('returns depth for rectangle', () => {
      const cutout = createCutout({ shape: 'rectangle', depth: 15 });
      expect(getEffectiveDepth(cutout)).toBe(15);
    });

    it('returns width (diameter) for circle', () => {
      const cutout = createCutout({ shape: 'circle', width: 20 });
      expect(getEffectiveDepth(cutout)).toBe(20);
    });
  });
});
