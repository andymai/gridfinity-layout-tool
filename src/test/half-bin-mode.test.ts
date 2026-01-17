import { describe, it, expect, beforeEach } from 'vitest';
import { snapToHalf, snapToGrid, isFractional, hasFractionalDimensions, HALF_BIN_SCALE } from '../core/constants';
import { useUIStore } from '../core/store';

/**
 * Helper to calculate pixel dimensions for grid elements.
 * This replicates the logic used in Bin.tsx and Overlay.tsx.
 * Uses Math.max(0, units - 1) to handle fractional dimensions correctly
 * (avoids negative gap contribution when units < 1).
 */
function toPixels(units: number, cellSize: number, gap: number): number {
  return units * cellSize + Math.max(0, units - 1) * gap;
}

/**
 * Calculate CSS Grid positioning for a bin.
 * Replicates the logic from Bin.tsx.
 */
function calculateGridPosition(
  bin: { x: number; y: number; width: number; depth: number },
  drawerDepth: number
) {
  const gridCol = Math.floor(bin.x) + 1;
  const gridColSpan = Math.ceil(bin.x + bin.width) - Math.floor(bin.x);
  const gridRowStart = drawerDepth - Math.ceil(bin.y + bin.depth) + 1;
  const gridRowSpan = Math.ceil(bin.y + bin.depth) - Math.floor(bin.y);
  return { gridCol, gridColSpan, gridRowStart, gridRowSpan };
}

/**
 * Calculate pixel offset for fractional bin positions.
 * Replicates the offset logic from Bin.tsx.
 */
function calculatePixelOffset(
  bin: { x: number; y: number; width: number; depth: number },
  cellSize: number,
  gap: number
) {
  const fractionalX = bin.x - Math.floor(bin.x);
  const fractionalYFromTop = Math.ceil(bin.y + bin.depth) - (bin.y + bin.depth);
  const offsetX = fractionalX * (cellSize + gap);
  const offsetY = fractionalYFromTop * (cellSize + gap);
  return { offsetX, offsetY };
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

  describe('CSS Grid positioning for bins', () => {
    const drawerDepth = 8;

    describe('whole-unit bins (standard mode)', () => {
      it('positions bin at origin (0,0) correctly', () => {
        const bin = { x: 0, y: 0, width: 1, depth: 1 };
        const pos = calculateGridPosition(bin, drawerDepth);

        expect(pos.gridCol).toBe(1); // Column 1 (1-indexed)
        expect(pos.gridColSpan).toBe(1);
        expect(pos.gridRowStart).toBe(8); // Bottom row (Y=0 maps to row 8)
        expect(pos.gridRowSpan).toBe(1);
      });

      it('positions bin at top-left corner correctly', () => {
        const bin = { x: 0, y: 7, width: 1, depth: 1 };
        const pos = calculateGridPosition(bin, drawerDepth);

        expect(pos.gridCol).toBe(1);
        expect(pos.gridRowStart).toBe(1); // Top row
        expect(pos.gridRowSpan).toBe(1);
      });

      it('positions 2x2 bin correctly', () => {
        const bin = { x: 3, y: 4, width: 2, depth: 2 };
        const pos = calculateGridPosition(bin, drawerDepth);

        expect(pos.gridCol).toBe(4); // x=3 -> col 4
        expect(pos.gridColSpan).toBe(2);
        expect(pos.gridRowStart).toBe(3); // 8 - ceil(4+2) + 1 = 3
        expect(pos.gridRowSpan).toBe(2);
      });

      it('positions bin at right edge correctly', () => {
        const bin = { x: 7, y: 0, width: 1, depth: 1 };
        const pos = calculateGridPosition(bin, drawerDepth);

        expect(pos.gridCol).toBe(8); // Rightmost column
        expect(pos.gridColSpan).toBe(1);
      });
    });

    describe('half-unit bins (half-bin mode)', () => {
      it('positions 0.5x0.5 bin at (0.5, 0.5) correctly', () => {
        const bin = { x: 0.5, y: 0.5, width: 0.5, depth: 0.5 };
        const pos = calculateGridPosition(bin, drawerDepth);

        // Bin occupies from 0.5 to 1.0 in both dimensions
        // Should be in cell (1,8) with offset
        expect(pos.gridCol).toBe(1); // floor(0.5) + 1 = 1
        expect(pos.gridColSpan).toBe(1); // ceil(1) - floor(0.5) = 1
        expect(pos.gridRowStart).toBe(8); // 8 - ceil(1) + 1 = 8
        expect(pos.gridRowSpan).toBe(1); // ceil(1) - floor(0.5) = 1
      });

      it('positions 0.5x0.5 bin at (0, 0) correctly', () => {
        const bin = { x: 0, y: 0, width: 0.5, depth: 0.5 };
        const pos = calculateGridPosition(bin, drawerDepth);

        expect(pos.gridCol).toBe(1);
        expect(pos.gridColSpan).toBe(1);
        expect(pos.gridRowStart).toBe(8);
        expect(pos.gridRowSpan).toBe(1);
      });

      it('positions 1.5x1.5 bin correctly', () => {
        const bin = { x: 0.5, y: 0.5, width: 1.5, depth: 1.5 };
        const pos = calculateGridPosition(bin, drawerDepth);

        // Bin spans from 0.5 to 2.0 in both dimensions
        expect(pos.gridCol).toBe(1); // floor(0.5) + 1 = 1
        expect(pos.gridColSpan).toBe(2); // ceil(2) - floor(0.5) = 2
        expect(pos.gridRowStart).toBe(7); // 8 - ceil(2) + 1 = 7
        expect(pos.gridRowSpan).toBe(2); // ceil(2) - floor(0.5) = 2
      });

      it('positions bin at half-unit edge positions', () => {
        // Bin at x=7.5 (right edge for 8-wide drawer)
        const bin = { x: 7.5, y: 0, width: 0.5, depth: 1 };
        const pos = calculateGridPosition(bin, drawerDepth);

        expect(pos.gridCol).toBe(8); // floor(7.5) + 1 = 8
        expect(pos.gridColSpan).toBe(1); // ceil(8) - floor(7.5) = 1
      });
    });

    describe('bins spanning cell boundaries', () => {
      it('positions bin spanning from 0.5 to 1.5 correctly', () => {
        const bin = { x: 0.5, y: 0, width: 1, depth: 1 };
        const pos = calculateGridPosition(bin, drawerDepth);

        // Bin spans cells 0 and 1 (columns 1 and 2)
        expect(pos.gridCol).toBe(1);
        expect(pos.gridColSpan).toBe(2); // ceil(1.5) - floor(0.5) = 2
      });

      it('positions bin spanning multiple cells correctly', () => {
        const bin = { x: 1.5, y: 2.5, width: 2.5, depth: 2.5 };
        const pos = calculateGridPosition(bin, drawerDepth);

        // X: 1.5 to 4.0 -> cells 1,2,3,4 -> span 4
        expect(pos.gridCol).toBe(2); // floor(1.5) + 1 = 2
        expect(pos.gridColSpan).toBe(3); // ceil(4) - floor(1.5) = 3

        // Y: 2.5 to 5.0 -> rows for y=2,3,4,5
        expect(pos.gridRowSpan).toBe(3); // ceil(5) - floor(2.5) = 3
      });
    });
  });

  describe('pixel offset for fractional positions', () => {
    const cellSize = 32;
    const gap = 1;

    describe('X offset calculations', () => {
      it('returns 0 offset for whole-unit X position', () => {
        const bin = { x: 0, y: 0, width: 1, depth: 1 };
        const { offsetX } = calculatePixelOffset(bin, cellSize, gap);
        expect(offsetX).toBe(0);
      });

      it('returns half-cell offset for X=0.5', () => {
        const bin = { x: 0.5, y: 0, width: 0.5, depth: 1 };
        const { offsetX } = calculatePixelOffset(bin, cellSize, gap);
        expect(offsetX).toBe(0.5 * (cellSize + gap)); // 16.5px
      });

      it('returns correct offset for X=1.5', () => {
        const bin = { x: 1.5, y: 0, width: 0.5, depth: 1 };
        const { offsetX } = calculatePixelOffset(bin, cellSize, gap);
        expect(offsetX).toBe(0.5 * (cellSize + gap)); // Same as 0.5
      });

      it('returns 0 offset for X=2.0', () => {
        const bin = { x: 2, y: 0, width: 1, depth: 1 };
        const { offsetX } = calculatePixelOffset(bin, cellSize, gap);
        expect(offsetX).toBe(0);
      });
    });

    describe('Y offset calculations', () => {
      it('returns 0 offset for bin at cell top', () => {
        // Bin from y=0 to y=1 (fills bottom cell completely)
        const bin = { x: 0, y: 0, width: 1, depth: 1 };
        const { offsetY } = calculatePixelOffset(bin, cellSize, gap);
        expect(offsetY).toBe(0);
      });

      it('returns half-cell offset for bin in bottom half of cell', () => {
        // Bin from y=0 to y=0.5 (bottom half of bottom cell)
        const bin = { x: 0, y: 0, width: 1, depth: 0.5 };
        const { offsetY } = calculatePixelOffset(bin, cellSize, gap);
        // fractionalYFromTop = ceil(0.5) - 0.5 = 1 - 0.5 = 0.5
        expect(offsetY).toBe(0.5 * (cellSize + gap)); // 16.5px from top
      });

      it('returns 0 offset for bin in top half of cell', () => {
        // Bin from y=0.5 to y=1.0 (top half of bottom cell)
        const bin = { x: 0, y: 0.5, width: 1, depth: 0.5 };
        const { offsetY } = calculatePixelOffset(bin, cellSize, gap);
        // fractionalYFromTop = ceil(1) - 1 = 0
        expect(offsetY).toBe(0);
      });

      it('handles bins spanning multiple cells', () => {
        // Bin from y=0.5 to y=2.0 (spans 1.5 units)
        const bin = { x: 0, y: 0.5, width: 1, depth: 1.5 };
        const { offsetY } = calculatePixelOffset(bin, cellSize, gap);
        // fractionalYFromTop = ceil(2) - 2 = 0
        expect(offsetY).toBe(0);
      });
    });

    describe('combined X and Y offsets', () => {
      it('calculates correct offsets for corner position', () => {
        // Bin at (0.5, 0.5) with size (0.5, 0.5)
        const bin = { x: 0.5, y: 0.5, width: 0.5, depth: 0.5 };
        const { offsetX, offsetY } = calculatePixelOffset(bin, cellSize, gap);

        expect(offsetX).toBe(0.5 * (cellSize + gap)); // 16.5px
        // fractionalYFromTop = ceil(1) - 1 = 0
        expect(offsetY).toBe(0);
      });

      it('calculates correct offsets for bottom-right quadrant', () => {
        // Bin at (0.5, 0) with size (0.5, 0.5)
        const bin = { x: 0.5, y: 0, width: 0.5, depth: 0.5 };
        const { offsetX, offsetY } = calculatePixelOffset(bin, cellSize, gap);

        expect(offsetX).toBe(0.5 * (cellSize + gap)); // 16.5px
        // fractionalYFromTop = ceil(0.5) - 0.5 = 0.5
        expect(offsetY).toBe(0.5 * (cellSize + gap)); // 16.5px
      });
    });
  });

  describe('draw preview size calculations', () => {
    it('calculates correct size for standard mode draw', () => {
      // Drawing from (0,0) to (1,1) in standard mode
      const start = { x: 0, y: 0 };
      const current = { x: 1, y: 1 };
      const halfBinMode = false;
      const minUnit = halfBinMode ? 0.5 : 1;

      const x1 = Math.min(start.x, current.x);
      const y1 = Math.min(start.y, current.y);
      const x2 = Math.max(start.x, current.x);
      const y2 = Math.max(start.y, current.y);
      const width = x2 - x1 + minUnit;
      const depth = y2 - y1 + minUnit;

      expect(width).toBe(2); // 1 - 0 + 1 = 2
      expect(depth).toBe(2); // 1 - 0 + 1 = 2
    });

    it('calculates correct size for half-bin mode draw', () => {
      // Drawing from (0.5,0.5) to (1,1) in half-bin mode
      const start = { x: 0.5, y: 0.5 };
      const current = { x: 1, y: 1 };
      const halfBinMode = true;
      const minUnit = halfBinMode ? 0.5 : 1;

      const x1 = Math.min(start.x, current.x);
      const y1 = Math.min(start.y, current.y);
      const x2 = Math.max(start.x, current.x);
      const y2 = Math.max(start.y, current.y);
      const width = x2 - x1 + minUnit;
      const depth = y2 - y1 + minUnit;

      expect(width).toBe(1); // 1 - 0.5 + 0.5 = 1
      expect(depth).toBe(1); // 1 - 0.5 + 0.5 = 1
    });

    it('calculates minimum 0.5 size in half-bin mode', () => {
      // Single click (same start and current) in half-bin mode
      const start = { x: 1.5, y: 2 };
      const current = { x: 1.5, y: 2 };
      const halfBinMode = true;
      const minUnit = halfBinMode ? 0.5 : 1;

      const width = Math.max(start.x, current.x) - Math.min(start.x, current.x) + minUnit;
      const depth = Math.max(start.y, current.y) - Math.min(start.y, current.y) + minUnit;

      expect(width).toBe(0.5); // 0 + 0.5 = 0.5
      expect(depth).toBe(0.5); // 0 + 0.5 = 0.5
    });

    it('calculates minimum 1 size in standard mode', () => {
      // Single click (same start and current) in standard mode
      const start = { x: 3, y: 4 };
      const current = { x: 3, y: 4 };
      const halfBinMode = false;
      const minUnit = halfBinMode ? 0.5 : 1;

      const width = Math.max(start.x, current.x) - Math.min(start.x, current.x) + minUnit;
      const depth = Math.max(start.y, current.y) - Math.min(start.y, current.y) + minUnit;

      expect(width).toBe(1); // 0 + 1 = 1
      expect(depth).toBe(1); // 0 + 1 = 1
    });
  });

  describe('coordinate to pixel position (Overlay)', () => {
    const cellSize = 32;
    const gap = 1;
    const drawerDepth = 8;

    /**
     * Calculate pixel position for draw preview (replicates Overlay.tsx logic)
     */
    function calculateOverlayPosition(x: number, y: number, width: number, depth: number) {
      const left = gap + x * (cellSize + gap);
      const top = gap + (drawerDepth - y - depth) * (cellSize + gap);
      const rectWidth = toPixels(width, cellSize, gap);
      const rectHeight = toPixels(depth, cellSize, gap);
      return { left, top, rectWidth, rectHeight };
    }

    it('calculates correct position for bin at origin', () => {
      const { left, top, rectWidth, rectHeight } = calculateOverlayPosition(0, 0, 1, 1);

      expect(left).toBe(1); // gap = 1
      expect(top).toBe(1 + 7 * 33); // gap + (8-0-1) * 33 = 232
      expect(rectWidth).toBe(32);
      expect(rectHeight).toBe(32);
    });

    it('calculates correct position for bin at top-left', () => {
      const { left, top } = calculateOverlayPosition(0, 7, 1, 1);

      expect(left).toBe(1);
      expect(top).toBe(1); // gap + (8-7-1) * 33 = 1
    });

    it('calculates correct position for half-unit bin', () => {
      const { left, top, rectWidth, rectHeight } = calculateOverlayPosition(0.5, 0.5, 0.5, 0.5);

      expect(left).toBe(1 + 0.5 * 33); // 17.5
      expect(top).toBe(1 + 7 * 33); // 232
      expect(rectWidth).toBe(16); // 0.5 * 32
      expect(rectHeight).toBe(16);
    });

    it('calculates correct position for 2x2 bin', () => {
      const { left, top, rectWidth, rectHeight } = calculateOverlayPosition(2, 3, 2, 2);

      expect(left).toBe(1 + 2 * 33); // 67
      expect(top).toBe(1 + 3 * 33); // 100 (8-3-2=3)
      expect(rectWidth).toBe(65); // 2*32 + 1*1
      expect(rectHeight).toBe(65);
    });
  });

  describe('keyboard interaction increments', () => {
    it('uses 0.5 increment in half-bin mode', () => {
      const halfBinMode = true;
      const increment = halfBinMode ? 0.5 : 1;
      expect(increment).toBe(0.5);
    });

    it('uses 1.0 increment in normal mode', () => {
      const halfBinMode = false;
      const increment = halfBinMode ? 0.5 : 1;
      expect(increment).toBe(1);
    });

    it('calculates correct drag delta in half-bin mode', () => {
      const halfBinMode = true;
      const increment = halfBinMode ? 0.5 : 1;

      // Simulating 2 arrow key presses
      let dx = 0;
      dx += increment; // Right
      dx += increment; // Right

      expect(dx).toBe(1); // 0.5 + 0.5 = 1
    });

    it('calculates correct resize delta in half-bin mode', () => {
      const halfBinMode = true;
      const minSize = halfBinMode ? 0.5 : 1;

      const originalWidth = 1;
      // Shrink by one increment
      const newWidth = Math.max(minSize, originalWidth - (halfBinMode ? 0.5 : 1));

      expect(newWidth).toBe(0.5); // 1 - 0.5 = 0.5 (above minSize)
    });

    it('enforces 0.5 minimum size in half-bin mode', () => {
      const halfBinMode = true;
      const minSize = halfBinMode ? 0.5 : 1;

      const originalWidth = 0.5;
      // Try to shrink below minimum
      const newWidth = Math.max(minSize, originalWidth - 0.5);

      expect(newWidth).toBe(0.5); // Clamped to minSize
    });

    it('enforces 1.0 minimum size in normal mode', () => {
      const halfBinMode = false;
      const minSize = halfBinMode ? 0.5 : 1;

      const originalWidth = 1;
      // Try to shrink below minimum
      const newWidth = Math.max(minSize, originalWidth - 1);

      expect(newWidth).toBe(1); // Clamped to minSize
    });
  });

  describe('fill operations step size', () => {
    it('uses 0.5 step for cell iteration in half-bin mode', () => {
      const halfBinMode = true;
      const step = halfBinMode ? 0.5 : 1;

      // Simulate iterating over a 2x2 area
      const cells: string[] = [];
      for (let x = 0; x < 2; x += step) {
        for (let y = 0; y < 2; y += step) {
          cells.push(`${x},${y}`);
        }
      }

      // With step=0.5, should have 4x4=16 positions
      expect(cells.length).toBe(16);
      expect(cells).toContain('0,0');
      expect(cells).toContain('0.5,0.5');
      expect(cells).toContain('1.5,1.5');
    });

    it('uses 1.0 step for cell iteration in normal mode', () => {
      const halfBinMode = false;
      const step = halfBinMode ? 0.5 : 1;

      // Simulate iterating over a 2x2 area
      const cells: string[] = [];
      for (let x = 0; x < 2; x += step) {
        for (let y = 0; y < 2; y += step) {
          cells.push(`${x},${y}`);
        }
      }

      // With step=1, should have 2x2=4 positions
      expect(cells.length).toBe(4);
      expect(cells).toContain('0,0');
      expect(cells).toContain('1,1');
    });

    it('generates 0.5-increment sizes for gap fill in half-bin mode', () => {
      const halfBinMode = true;
      const step = halfBinMode ? 0.5 : 1;
      const minSize = halfBinMode ? 0.5 : 1;
      const maxSize = 2;

      const sizes: Array<{ w: number; d: number }> = [];
      for (let w = maxSize; w >= minSize; w -= step) {
        for (let d = maxSize; d >= minSize; d -= step) {
          sizes.push({ w, d });
        }
      }

      // With step=0.5, sizes from 2 down to 0.5: 2, 1.5, 1, 0.5 = 4 values each dimension
      // Total: 4 * 4 = 16 sizes
      expect(sizes.length).toBe(16);
      expect(sizes.some(s => s.w === 0.5 && s.d === 0.5)).toBe(true);
      expect(sizes.some(s => s.w === 1.5 && s.d === 1)).toBe(true);
    });

    it('generates whole-unit sizes for gap fill in normal mode', () => {
      const halfBinMode = false;
      const step = halfBinMode ? 0.5 : 1;
      const minSize = halfBinMode ? 0.5 : 1;
      const maxSize = 2;

      const sizes: Array<{ w: number; d: number }> = [];
      for (let w = maxSize; w >= minSize; w -= step) {
        for (let d = maxSize; d >= minSize; d -= step) {
          sizes.push({ w, d });
        }
      }

      // With step=1, sizes 2 and 1 = 2 values each dimension
      // Total: 2 * 2 = 4 sizes
      expect(sizes.length).toBe(4);
      expect(sizes.some(s => s.w === 2 && s.d === 2)).toBe(true);
      expect(sizes.some(s => s.w === 1 && s.d === 1)).toBe(true);
    });

    it('correctly detects occupied fractional cells', () => {
      const step = 0.5;
      const occupied = new Set<string>();

      // Mark a 1x1 bin at position (0.5, 0.5)
      const bin = { x: 0.5, y: 0.5, width: 1, depth: 1 };
      for (let bx = bin.x; bx < bin.x + bin.width; bx += step) {
        for (let by = bin.y; by < bin.y + bin.depth; by += step) {
          occupied.add(`${bx},${by}`);
        }
      }

      // Should mark: (0.5,0.5), (0.5,1), (1,0.5), (1,1)
      expect(occupied.size).toBe(4);
      expect(occupied.has('0.5,0.5')).toBe(true);
      expect(occupied.has('1,1')).toBe(true);
      expect(occupied.has('0,0')).toBe(false); // Not occupied
    });
  });
});
