import { describe, it, expect, beforeEach } from 'vitest';
import { snapToHalf, snapToGrid, isFractional, hasFractionalDimensions, HALF_BIN_SCALE } from '../constants';
import { useUIStore } from '../store';

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
});
