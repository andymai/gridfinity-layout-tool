/**
 * Contour simplifier tests.
 *
 * Tests the Douglas-Peucker algorithm for reducing contour point count
 * while preserving the overall shape.
 */

import { describe, it, expect } from 'vitest';
import { simplifyContour, douglasPeucker } from './contourSimplifier';
import type { NormalizedPoint } from '../types';

describe('contourSimplifier', () => {
  describe('douglasPeucker', () => {
    it('returns original points when fewer than 3 points', () => {
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];
      const result = douglasPeucker(points, 0.01);
      expect(result).toHaveLength(2);
    });

    it('simplifies a straight line to just endpoints', () => {
      // Points on a straight line from (0,0) to (1,1)
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.5 },
        { x: 0.75, y: 0.75 },
        { x: 1, y: 1 },
      ];
      const result = douglasPeucker(points, 0.01);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[1]).toEqual({ x: 1, y: 1 });
    });

    it('preserves corner points', () => {
      // L-shaped path: corner at (1, 0)
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 }, // corner
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
      ];
      const result = douglasPeucker(points, 0.01);
      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ x: 0, y: 0 });
      expect(result).toContainEqual({ x: 1, y: 0 });
      expect(result).toContainEqual({ x: 1, y: 1 });
    });

    it('preserves points that deviate beyond epsilon', () => {
      // Triangle with apex above the line
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 }, // significantly above the x-axis line
        { x: 1, y: 0 },
      ];
      const result = douglasPeucker(points, 0.1);
      expect(result).toHaveLength(3);
    });

    it('removes points within epsilon tolerance', () => {
      // Triangle with very small deviation
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.001 }, // barely above the line
        { x: 1, y: 0 },
      ];
      const result = douglasPeucker(points, 0.01);
      expect(result).toHaveLength(2);
    });

    it('handles a square shape correctly', () => {
      const square: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
        { x: 0.5, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0.5 },
      ];
      const result = douglasPeucker(square, 0.01);
      // Should keep 4 corners
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('simplifyContour', () => {
    it('simplifies collinear points while maintaining minimum 3 for closed contour', () => {
      // Points on a straight line from (0,0) to (1,1)
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.5 },
        { x: 0.75, y: 0.75 },
        { x: 1, y: 1 },
      ];
      const result = simplifyContour(points);
      // Closed contours need at least 3 points to form a polygon
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ x: 0, y: 0 });
      expect(result[2]).toEqual({ x: 1, y: 1 });
    });

    it('respects custom epsilon while maintaining closed contour minimum', () => {
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.01 }, // small deviation
        { x: 1, y: 0 },
      ];

      // With large epsilon, should attempt to simplify but keep at least 3
      const simplified = simplifyContour(points, 0.1);
      expect(simplified).toHaveLength(3); // Minimum for closed contour

      // With small epsilon, should preserve all
      const preserved = simplifyContour(points, 0.001);
      expect(preserved).toHaveLength(3);
    });

    it('limits output to MAX_CONTOUR_POINTS', () => {
      // Create a complex shape with many points
      const points: NormalizedPoint[] = [];
      for (let i = 0; i < 1000; i++) {
        const angle = (i / 1000) * Math.PI * 2;
        // Add some noise to prevent simplification
        const noise = Math.sin(i * 10) * 0.01;
        points.push({
          x: 0.5 + Math.cos(angle) * (0.4 + noise),
          y: 0.5 + Math.sin(angle) * (0.4 + noise),
        });
      }

      const result = simplifyContour(points);
      expect(result.length).toBeLessThanOrEqual(500);
    });

    it('returns at least 3 points for a valid closed contour', () => {
      const points: NormalizedPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 0.0001 }, // tiny deviation
      ];
      const result = simplifyContour(points, 0.1);
      expect(result.length).toBeGreaterThanOrEqual(3);
    });
  });
});
