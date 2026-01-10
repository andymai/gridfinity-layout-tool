import { describe, it, expect, beforeEach } from 'vitest';
import { snapToHalf, snapToGrid, isFractional, hasFractionalDimensions, HALF_BIN_SCALE } from '../constants';
import { useUIStore } from '../store';

/**
 * Helper to calculate pixel dimensions for grid elements.
 * This replicates the logic used in Bin.tsx and Overlay.tsx.
 * Uses Math.max(0, units - 1) to handle fractional dimensions correctly
 * (avoids negative gap contribution when units < 1).
 */
function toPixels(units: number, cellSize: number, gap: number): number {
  return units * cellSize + Math.max(0, units - 1) * gap;
}

describe('Half-bin mode', () => {
  describe('snapToHalf', () => {
    it('snaps values to nearest 0.5', () => {
      expect(snapToHalf(0)).toBe(0);
      expect(snapToHalf(0.1)).toBe(0);
      expect(snapToHalf(0.25)).toBe(0.5);
      expect(snapToHalf(0.5)).toBe(0.5);
      expect(snapToHalf(0.7)).toBe(0.5);
      expect(snapToHalf(0.75)).toBe(1);
      expect(snapToHalf(1)).toBe(1);
      expect(snapToHalf(1.3)).toBe(1.5);
      expect(snapToHalf(2.25)).toBe(2.5);
    });

    it('handles negative values', () => {
      // Note: -0.25 rounds to -0 in JavaScript, which equals 0 mathematically
      const result = snapToHalf(-0.25);
      expect(result === 0 || Object.is(result, -0)).toBe(true);
      expect(snapToHalf(-0.5)).toBe(-0.5);
    });
  });

  describe('snapToGrid', () => {
    it('snaps to 0.5 increments when halfBinMode is true', () => {
      expect(snapToGrid(0.3, true)).toBe(0.5);
      expect(snapToGrid(1.7, true)).toBe(1.5);
      expect(snapToGrid(2.8, true)).toBe(3);
    });

    it('snaps to whole numbers when halfBinMode is false', () => {
      expect(snapToGrid(0.3, false)).toBe(0);
      expect(snapToGrid(1.7, false)).toBe(1);
      expect(snapToGrid(2.8, false)).toBe(2);
    });
  });

  describe('isFractional', () => {
    it('returns true for values with decimal part', () => {
      expect(isFractional(0.5)).toBe(true);
      expect(isFractional(1.5)).toBe(true);
      expect(isFractional(2.5)).toBe(true);
    });

    it('returns false for whole numbers', () => {
      expect(isFractional(0)).toBe(false);
      expect(isFractional(1)).toBe(false);
      expect(isFractional(10)).toBe(false);
    });
  });

  describe('hasFractionalDimensions', () => {
    it('returns true if x is fractional', () => {
      expect(hasFractionalDimensions({ x: 0.5, y: 0, width: 1, depth: 1 })).toBe(true);
    });

    it('returns true if y is fractional', () => {
      expect(hasFractionalDimensions({ x: 0, y: 1.5, width: 1, depth: 1 })).toBe(true);
    });

    it('returns true if width is fractional', () => {
      expect(hasFractionalDimensions({ x: 0, y: 0, width: 0.5, depth: 1 })).toBe(true);
    });

    it('returns true if depth is fractional', () => {
      expect(hasFractionalDimensions({ x: 0, y: 0, width: 1, depth: 1.5 })).toBe(true);
    });

    it('returns false if all dimensions are whole numbers', () => {
      expect(hasFractionalDimensions({ x: 0, y: 0, width: 1, depth: 1 })).toBe(false);
      expect(hasFractionalDimensions({ x: 5, y: 3, width: 2, depth: 4 })).toBe(false);
    });
  });

  describe('HALF_BIN_SCALE constant', () => {
    it('equals 2 (doubling resolution)', () => {
      expect(HALF_BIN_SCALE).toBe(2);
    });
  });

  describe('UI store halfBinMode', () => {
    beforeEach(() => {
      // Reset store state
      useUIStore.setState({ halfBinMode: false });
    });

    it('defaults to false', () => {
      expect(useUIStore.getState().halfBinMode).toBe(false);
    });

    it('toggleHalfBinMode toggles the value', () => {
      const { toggleHalfBinMode } = useUIStore.getState();

      toggleHalfBinMode();
      expect(useUIStore.getState().halfBinMode).toBe(true);

      toggleHalfBinMode();
      expect(useUIStore.getState().halfBinMode).toBe(false);
    });

    it('setHalfBinMode sets specific value', () => {
      const { setHalfBinMode } = useUIStore.getState();

      setHalfBinMode(true);
      expect(useUIStore.getState().halfBinMode).toBe(true);

      setHalfBinMode(false);
      expect(useUIStore.getState().halfBinMode).toBe(false);
    });
  });

  describe('toPixels calculation for fractional dimensions', () => {
    const cellSize = 32;
    const gap = 1;

    it('calculates correct pixels for whole unit dimensions', () => {
      // 1 unit = 1 cell, no gaps between
      expect(toPixels(1, cellSize, gap)).toBe(32);
      // 2 units = 2 cells + 1 gap
      expect(toPixels(2, cellSize, gap)).toBe(65); // 2*32 + 1*1
      // 3 units = 3 cells + 2 gaps
      expect(toPixels(3, cellSize, gap)).toBe(98); // 3*32 + 2*1
    });

    it('calculates correct pixels for fractional dimensions < 1', () => {
      // 0.5 units = half a cell, no gap contribution (Math.max(0, 0.5-1) = 0)
      expect(toPixels(0.5, cellSize, gap)).toBe(16); // 0.5*32 + 0
      // 0.25 units
      expect(toPixels(0.25, cellSize, gap)).toBe(8); // 0.25*32 + 0
    });

    it('calculates correct pixels for fractional dimensions >= 1', () => {
      // 1.5 units = 1.5 cells + 0.5 gaps
      expect(toPixels(1.5, cellSize, gap)).toBe(48.5); // 1.5*32 + 0.5*1
      // 2.5 units = 2.5 cells + 1.5 gaps
      expect(toPixels(2.5, cellSize, gap)).toBe(81.5); // 2.5*32 + 1.5*1
    });

    it('never returns negative gap contribution', () => {
      // Even for very small values, gap should be 0 (not negative)
      expect(toPixels(0.1, cellSize, gap)).toBe(3.2); // 0.1*32 + 0
      expect(toPixels(0.01, cellSize, gap)).toBe(0.32); // 0.01*32 + 0
    });

    it('handles edge case of 0 units', () => {
      expect(toPixels(0, cellSize, gap)).toBe(0);
    });
  });

  describe('fractional bin rendering when halfBinMode is off', () => {
    const cellSize = 32;
    const gap = 1;

    it('should use true pixel size for 0.5x0.5 bin', () => {
      // When halfBinMode is OFF with a 0.5x0.5 bin:
      // Without the fix: gridColSpan = Math.round(0.5) = 0 or 1, causing wrong size
      // With the fix: explicit width = toPixels(0.5) = 16px
      const binWidth = 0.5;
      const binDepth = 0.5;

      // CSS Grid span approach (would round incorrectly)
      const gridColSpan = Math.round(binWidth);
      const gridRowSpan = Math.round(binDepth);
      expect(gridColSpan).toBe(1); // Math.round(0.5) = 1 in JS (incorrect)
      expect(gridRowSpan).toBe(1);

      // Correct approach using toPixels
      const correctWidth = toPixels(binWidth, cellSize, gap);
      const correctHeight = toPixels(binDepth, cellSize, gap);
      expect(correctWidth).toBe(16); // Correct: half a cell
      expect(correctHeight).toBe(16);
    });

    it('should use true pixel size for 1.5x1 bin', () => {
      const binWidth = 1.5;

      // CSS Grid span approach
      const gridColSpan = Math.round(binWidth);
      expect(gridColSpan).toBe(2); // Math.round(1.5) = 2 (incorrect, should be 1.5 cells)

      // Correct approach using toPixels
      const correctWidth = toPixels(binWidth, cellSize, gap);
      expect(correctWidth).toBe(48.5); // 1.5 * 32 + 0.5 * 1
    });

    it('should identify fractional dimensions correctly', () => {
      // Check if bin has fractional dimensions
      const hasFractionalWidth = (width: number) => width % 1 !== 0;
      const hasFractionalDepth = (depth: number) => depth % 1 !== 0;

      expect(hasFractionalWidth(0.5)).toBe(true);
      expect(hasFractionalWidth(1)).toBe(false);
      expect(hasFractionalWidth(1.5)).toBe(true);
      expect(hasFractionalWidth(2)).toBe(false);

      expect(hasFractionalDepth(0.5)).toBe(true);
      expect(hasFractionalDepth(1)).toBe(false);
    });
  });
});
