import { describe, it, expect } from 'vitest';
import { calculateHexCenters, buildHexCompound } from './hexGrid';

describe('hexGrid', () => {
  describe('calculateHexCenters', () => {
    it('returns empty array for zero-size bounds', () => {
      const centers = calculateHexCenters({
        boundsW: 0,
        boundsD: 0,
        cellSize: 5,
        margin: 1,
        height: 2,
      });
      expect(centers).toHaveLength(0);
    });

    it('returns empty array when margin exceeds bounds', () => {
      const centers = calculateHexCenters({
        boundsW: 10,
        boundsD: 10,
        cellSize: 5,
        margin: 6, // margin × 2 = 12 > bounds 10
        height: 2,
      });
      expect(centers).toHaveLength(0);
    });

    it('returns empty array for zero cell size', () => {
      const centers = calculateHexCenters({
        boundsW: 50,
        boundsD: 50,
        cellSize: 0,
        margin: 1,
        height: 2,
      });
      expect(centers).toHaveLength(0);
    });

    it('returns hex centers within bounds for reasonable params', () => {
      const centers = calculateHexCenters({
        boundsW: 80,
        boundsD: 80,
        cellSize: 8,
        margin: 2.5,
        height: 1.5,
      });
      expect(centers.length).toBeGreaterThan(0);

      // All centers should be within bounds minus margin
      const circumRadius = 8 / Math.sqrt(3);
      for (const center of centers) {
        expect(center.x).toBeGreaterThanOrEqual(2.5 + circumRadius - 0.01);
        expect(center.x).toBeLessThanOrEqual(80 - 2.5 - circumRadius + 0.01);
        expect(center.y).toBeGreaterThanOrEqual(2.5 + circumRadius - 0.01);
        expect(center.y).toBeLessThanOrEqual(80 - 2.5 - circumRadius + 0.01);
      }
    });

    it('larger bounds produce more hex centers', () => {
      const small = calculateHexCenters({
        boundsW: 30,
        boundsD: 30,
        cellSize: 6,
        margin: 2,
        height: 1,
      });
      const large = calculateHexCenters({
        boundsW: 80,
        boundsD: 80,
        cellSize: 6,
        margin: 2,
        height: 1,
      });
      expect(large.length).toBeGreaterThan(small.length);
    });

    it('larger cell size produces fewer hex centers', () => {
      const smallCell = calculateHexCenters({
        boundsW: 80,
        boundsD: 80,
        cellSize: 4,
        margin: 2,
        height: 1,
      });
      const largeCell = calculateHexCenters({
        boundsW: 80,
        boundsD: 80,
        cellSize: 12,
        margin: 2,
        height: 1,
      });
      expect(smallCell.length).toBeGreaterThan(largeCell.length);
    });
  });

  // buildHexCompound requires Replicad WASM, so we only test the null case
  describe('buildHexCompound', () => {
    it('returns null when no hexes fit', () => {
      const result = buildHexCompound({
        boundsW: 5,
        boundsD: 5,
        cellSize: 10,
        margin: 3,
        height: 2,
      });
      expect(result).toBeNull();
    });
  });
});
