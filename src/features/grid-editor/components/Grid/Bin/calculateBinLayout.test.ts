import { describe, it, expect } from 'vitest';
import type { GridUnits } from '@/core/types';
import { calculateBinLayout } from './calculateBinLayout';
import type { BinLayoutInput } from './calculateBinLayout';

function makeInput(overrides: Partial<BinLayoutInput> = {}): BinLayoutInput {
  return {
    binX: 0 as GridUnits,
    binY: 0 as GridUnits,
    binWidth: 1 as GridUnits,
    binDepth: 1 as GridUnits,
    drawerWidth: 10 as GridUnits,
    drawerDepth: 8 as GridUnits,
    cellSize: 50,
    gap: 2,
    ...overrides,
  };
}

describe('calculateBinLayout', () => {
  describe('basic positioning', () => {
    it('calculates layout for a 1x1 bin at origin', () => {
      const result = calculateBinLayout(makeInput());
      expect(result.dimensionsText).toBe('1×1');
      expect(result.gridCol).toBeGreaterThan(0);
      expect(result.gridColSpan).toBe(1);
      expect(result.gridRowSpan).toBe(1);
      expect(result.binPixelWidth).toBeGreaterThan(0);
      expect(result.binPixelHeight).toBeGreaterThan(0);
    });

    it('calculates layout for a 2x3 bin', () => {
      const result = calculateBinLayout(
        makeInput({ binWidth: 2 as GridUnits, binDepth: 3 as GridUnits })
      );
      expect(result.dimensionsText).toBe('2×3');
      expect(result.gridColSpan).toBe(2);
      expect(result.gridRowSpan).toBe(3);
    });

    it('positions bin at non-zero coordinates', () => {
      const atOrigin = calculateBinLayout(makeInput());
      const atOffset = calculateBinLayout(
        makeInput({ binX: 3 as GridUnits, binY: 2 as GridUnits })
      );
      // Different position should give different grid column
      expect(atOffset.gridCol).not.toBe(atOrigin.gridCol);
    });
  });

  describe('fractional dimensions', () => {
    it('handles fractional bin width (half-bin mode)', () => {
      const result = calculateBinLayout(
        makeInput({ binWidth: 0.5 as GridUnits, binDepth: 1 as GridUnits })
      );
      expect(result.needsCustomSizing).toBe(true);
      expect(result.binPixelWidth).toBeGreaterThan(0);
      expect(result.binPixelWidth).toBeLessThan(50); // less than one cell
    });

    it('handles fractional drawer width', () => {
      const result = calculateBinLayout(makeInput({ drawerWidth: 10.5 as GridUnits }));
      expect(result.needsCustomSizing).toBe(true);
    });

    it('handles fractional drawer depth', () => {
      const result = calculateBinLayout(makeInput({ drawerDepth: 8.5 as GridUnits }));
      expect(result.needsCustomSizing).toBe(true);
    });

    it('does not need custom sizing for integer dimensions', () => {
      const result = calculateBinLayout(makeInput());
      expect(result.needsCustomSizing).toBe(false);
    });
  });

  describe('fractional edge placement', () => {
    it('handles fractionalEdgeX=start', () => {
      const result = calculateBinLayout(
        makeInput({
          drawerWidth: 10.5 as GridUnits,
          fractionalEdgeX: 'start',
        })
      );
      expect(result.gridCol).toBeGreaterThan(0);
    });

    it('handles fractionalEdgeY=start', () => {
      const result = calculateBinLayout(
        makeInput({
          drawerDepth: 8.5 as GridUnits,
          fractionalEdgeY: 'start',
        })
      );
      expect(result.gridRowStart).toBeGreaterThan(0);
    });

    it('defaults fractional edge to end', () => {
      const explicitEnd = calculateBinLayout(
        makeInput({ drawerWidth: 10.5 as GridUnits, fractionalEdgeX: 'end' })
      );
      const defaultEnd = calculateBinLayout(makeInput({ drawerWidth: 10.5 as GridUnits }));
      expect(explicitEnd.gridCol).toBe(defaultEnd.gridCol);
    });
  });

  describe('pixel calculations', () => {
    it('binPixelMin is the smaller of width and height', () => {
      const result = calculateBinLayout(
        makeInput({ binWidth: 3 as GridUnits, binDepth: 1 as GridUnits })
      );
      expect(result.binPixelMin).toBe(Math.min(result.binPixelWidth, result.binPixelHeight));
    });

    it('offset is 0 for integer-aligned bins', () => {
      const result = calculateBinLayout(makeInput());
      expect(result.offsetX).toBe(0);
      expect(result.offsetY).toBe(0);
    });
  });

  describe('y-axis inversion (grid origin at bottom-left)', () => {
    it('bin at y=0 is at the bottom row', () => {
      const bottom = calculateBinLayout(makeInput({ binY: 0 as GridUnits }));
      const top = calculateBinLayout(makeInput({ binY: 7 as GridUnits }));
      // Row at y=0 should have higher CSS row number (bottom of grid)
      expect(bottom.gridRowStart).toBeGreaterThan(top.gridRowStart);
    });
  });
});
