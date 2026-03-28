import { describe, it, expect } from 'vitest';
import type { GridUnits, Rect, Coord } from '@/core/types';
import { calculateResizeRect } from './resize';

const makeRect = (x: number, y: number, w: number, d: number): Rect => ({
  x: x as GridUnits,
  y: y as GridUnits,
  width: w as GridUnits,
  depth: d as GridUnits,
});

const makeCursor = (x: number, y: number): Coord => ({
  x: x as GridUnits,
  y: y as GridUnits,
});

const drawer = { width: 10, depth: 8 };

describe('calculateResizeRect', () => {
  describe('east handle', () => {
    it('expands width to the right', () => {
      const result = calculateResizeRect(makeRect(0, 0, 2, 2), 'e', makeCursor(4, 0), drawer);
      expect(result.width).toBe(5); // cursor.x - x + minSize = 4 - 0 + 1 = 5
      expect(result.x).toBe(0); // x unchanged
    });

    it('enforces minimum width', () => {
      const result = calculateResizeRect(makeRect(2, 0, 3, 2), 'e', makeCursor(1, 0), drawer);
      expect(result.width).toBeGreaterThanOrEqual(1);
    });
  });

  describe('west handle', () => {
    it('expands width to the left', () => {
      const result = calculateResizeRect(makeRect(3, 0, 2, 2), 'w', makeCursor(1, 0), drawer);
      expect(result.x).toBe(1);
      expect(result.width).toBe(4); // original x + width - newX = 3 + 2 - 1 = 4
    });

    it('does not move past right edge', () => {
      const result = calculateResizeRect(makeRect(3, 0, 2, 2), 'w', makeCursor(6, 0), drawer);
      // cursor past right edge, x should be at most x + width - minSize
      expect(result.x).toBeLessThanOrEqual(4);
    });
  });

  describe('north handle', () => {
    it('expands depth upward', () => {
      const result = calculateResizeRect(makeRect(0, 0, 2, 2), 'n', makeCursor(0, 4), drawer);
      expect(result.depth).toBe(5); // cursor.y - y + minSize = 4 - 0 + 1 = 5
      expect(result.y).toBe(0); // y unchanged
    });
  });

  describe('south handle', () => {
    it('expands depth downward', () => {
      const result = calculateResizeRect(makeRect(0, 3, 2, 2), 's', makeCursor(0, 1), drawer);
      expect(result.y).toBe(1);
      expect(result.depth).toBe(4); // y + depth - newY = 3 + 2 - 1 = 4
    });
  });

  describe('compound handles', () => {
    it('handles ne (north-east)', () => {
      const result = calculateResizeRect(makeRect(0, 0, 2, 2), 'ne', makeCursor(4, 3), drawer);
      expect(result.width).toBe(5);
      expect(result.depth).toBe(4);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('handles sw (south-west)', () => {
      const result = calculateResizeRect(makeRect(3, 3, 2, 2), 'sw', makeCursor(1, 1), drawer);
      expect(result.x).toBe(1);
      expect(result.y).toBe(1);
    });
  });

  describe('bounds clamping', () => {
    it('clamps to drawer width', () => {
      const result = calculateResizeRect(makeRect(8, 0, 2, 2), 'e', makeCursor(15, 0), drawer);
      expect(result.x + result.width).toBeLessThanOrEqual(drawer.width);
    });

    it('clamps to drawer depth', () => {
      const result = calculateResizeRect(makeRect(0, 6, 2, 2), 'n', makeCursor(0, 15), drawer);
      expect(result.y + result.depth).toBeLessThanOrEqual(drawer.depth);
    });

    it('clamps x to 0 minimum', () => {
      const result = calculateResizeRect(makeRect(1, 0, 2, 2), 'w', makeCursor(-5, 0), drawer);
      expect(result.x).toBeGreaterThanOrEqual(0);
    });

    it('clamps y to 0 minimum', () => {
      const result = calculateResizeRect(makeRect(0, 1, 2, 2), 's', makeCursor(0, -5), drawer);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('half-bin mode (minSize = 0.5)', () => {
    it('allows 0.5 width', () => {
      const result = calculateResizeRect(makeRect(0, 0, 1, 1), 'e', makeCursor(0, 0), drawer, 0.5);
      expect(result.width).toBeGreaterThanOrEqual(0.5);
    });
  });
});
