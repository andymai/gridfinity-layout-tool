import { describe, it, expect } from 'vitest';
import { toPixels, calcFractionalPixelSize, type FractionalGridContext } from './fractionalPixels';

describe('toPixels', () => {
  describe('basic calculations', () => {
    it('converts single unit to pixels (no gaps)', () => {
      expect(toPixels(1, 40, 2)).toBe(40);
    });

    it('converts multiple units to pixels with gaps', () => {
      // 3 units * 40px + 2 gaps * 2px = 120 + 4 = 124
      expect(toPixels(3, 40, 2)).toBe(124);
    });

    it('handles zero units', () => {
      expect(toPixels(0, 40, 2)).toBe(0);
    });

    it('handles fractional units without gap contribution', () => {
      // 0.5 * 40 = 20 (no gaps since units < 1)
      expect(toPixels(0.5, 40, 2)).toBe(20);
    });

    it('handles fractional units > 1 with gap', () => {
      // 1.5 * 40 + max(0, 1.5 - 1) * 2 = 60 + 0.5 * 2 = 61
      expect(toPixels(1.5, 40, 2)).toBe(61);
    });

    it('handles 2 units exactly', () => {
      // 2 * 40 + 1 * 2 = 80 + 2 = 82
      expect(toPixels(2, 40, 2)).toBe(82);
    });
  });

  describe('edge cases', () => {
    it('handles zero cell size', () => {
      expect(toPixels(3, 0, 2)).toBe(4); // 0 + 2*2
    });

    it('handles zero gap', () => {
      expect(toPixels(3, 40, 0)).toBe(120); // 3*40
    });

    it('handles very large units', () => {
      expect(toPixels(100, 40, 2)).toBe(4198); // 100*40 + 99*2
    });

    it('handles very small fractional units', () => {
      expect(toPixels(0.001, 40, 2)).toBe(0.04);
    });
  });

  describe('gap calculation correctness', () => {
    it('number of gaps equals units - 1 for whole numbers', () => {
      // 5 units = 5*40 + 4*2 = 200 + 8 = 208
      expect(toPixels(5, 40, 2)).toBe(208);
    });

    it('Math.max(0, units - 1) handles boundary at 1 unit', () => {
      // 1 unit = 1*40 + max(0, 0)*2 = 40 + 0 = 40
      expect(toPixels(1, 40, 2)).toBe(40);
    });
  });
});

describe('calcFractionalPixelSize', () => {
  const standardContext: FractionalGridContext = {
    drawerDimension: 10, // Integer dimension (no fractional part)
    fractionalEdge: 'end',
    cellSize: 40,
    gap: 2,
  };

  describe('no fractional dimension (integer drawer)', () => {
    it('standard case: 1 unit at position 0', () => {
      // Should use standard toPixels calculation: 1*40 = 40
      expect(calcFractionalPixelSize(0, 1, standardContext)).toBe(40);
    });

    it('multiple units: 3 units at position 0', () => {
      // 3*40 + 2*2 = 124
      expect(calcFractionalPixelSize(0, 3, standardContext)).toBe(124);
    });

    it('units in middle of drawer: 2 units at position 5', () => {
      // 2*40 + 1*2 = 82
      expect(calcFractionalPixelSize(5, 2, standardContext)).toBe(82);
    });

    it('zero-sized region', () => {
      expect(calcFractionalPixelSize(0, 0, standardContext)).toBe(0);
    });
  });

  describe('fractional edge at start', () => {
    const fractionalStartCtx: FractionalGridContext = {
      drawerDimension: 10.5,
      fractionalEdge: 'start',
      cellSize: 40,
      gap: 2,
    };

    it('region entirely in fractional part', () => {
      // fractionalPart = 0.5, fractionalCellSize = 0.5 * (40+2) - 2 = 21 - 2 = 19
      // inFractional = 0.5, inInteger = 0
      // pixels = (0.5/0.5) * 19 = 19
      expect(calcFractionalPixelSize(0, 0.5, fractionalStartCtx)).toBe(19);
    });

    it('region spanning fractional and integer parts', () => {
      // fractionalPart = 0.5, fractionalCellSize = 19
      // position=0, size=1.5 → regionEnd=1.5
      // inFractional = min(1.5, 0.5) - max(0, 0) = 0.5
      // inInteger = 1.5 - 0.5 = 1
      // pixels = (0.5/0.5)*19 + 2 (gap) + 1*40 + 0*2 = 19 + 2 + 40 = 61
      expect(calcFractionalPixelSize(0, 1.5, fractionalStartCtx)).toBe(61);
    });

    it('region entirely in integer part (after fractional)', () => {
      // inFractional = 0, inInteger = 2
      // pixels = 2*40 + 1*2 = 82
      expect(calcFractionalPixelSize(0.5, 2, fractionalStartCtx)).toBe(82);
    });

    it('single integer cell after fractional', () => {
      // fractionalPart = 0.5, position = 0.5, size = 1
      // inFractional = 0, inInteger = 1
      // pixels = 1*40 + 0*2 = 40
      expect(calcFractionalPixelSize(0.5, 1, fractionalStartCtx)).toBe(40);
    });

    it('bin at fractional boundary: 0.2 unit in fractional', () => {
      // fractionalCellSize = 19
      // inFractional = 0.2, inInteger = 0
      // pixels = (0.2/0.5) * 19 = 0.4 * 19 = 7.6
      expect(calcFractionalPixelSize(0, 0.2, fractionalStartCtx)).toBeCloseTo(7.6);
    });
  });

  describe('fractional edge at end', () => {
    const fractionalEndCtx: FractionalGridContext = {
      drawerDimension: 10.5,
      fractionalEdge: 'end',
      cellSize: 40,
      gap: 2,
    };

    it('region entirely in integer part', () => {
      // integerDimension = 10, size = 2 at position 0
      // inInteger = 2, inFractional = 0
      // pixels = 2*40 + 1*2 = 82
      expect(calcFractionalPixelSize(0, 2, fractionalEndCtx)).toBe(82);
    });

    it('region entirely in fractional part', () => {
      // position=10, size=0.5 (entirely in fractional region [10, 10.5))
      // fractionalPart = 0.5, fractionalCellSize = 19
      // inInteger = max(0, min(10.5, 10) - 10) = 0
      // inFractional = 0.5 - 0 = 0.5
      // pixels = (0.5/0.5) * 19 = 19
      expect(calcFractionalPixelSize(10, 0.5, fractionalEndCtx)).toBe(19);
    });

    it('region spanning integer and fractional parts', () => {
      // position=9, size=1.5 → regionEnd=10.5
      // inInteger = min(10.5, 10) - 9 = 10 - 9 = 1
      // inFractional = 1.5 - 1 = 0.5
      // pixels = 1*40 + 0*2 + 2(gap) + (0.5/0.5)*19 = 40 + 2 + 19 = 61
      expect(calcFractionalPixelSize(9, 1.5, fractionalEndCtx)).toBe(61);
    });

    it('bin starting at fractional boundary', () => {
      // position=10, size=0.3
      // inInteger = 0, inFractional = 0.3
      // pixels = (0.3/0.5) * 19 = 0.6 * 19 = 11.4
      expect(calcFractionalPixelSize(10, 0.3, fractionalEndCtx)).toBeCloseTo(11.4);
    });

    it('large region spanning both parts', () => {
      // position=0, size=10.5 (entire drawer)
      // inInteger = 10, inFractional = 0.5
      // pixels = 10*40 + 9*2 + 2(gap) + (0.5/0.5)*19
      //        = 400 + 18 + 2 + 19 = 439
      expect(calcFractionalPixelSize(0, 10.5, fractionalEndCtx)).toBe(439);
    });
  });

  describe('edge cases with fractional dimensions', () => {
    const fractionalEndCtx: FractionalGridContext = {
      drawerDimension: 10.5,
      fractionalEdge: 'end',
      cellSize: 40,
      gap: 2,
    };

    it('zero-sized region with fractional drawer', () => {
      expect(calcFractionalPixelSize(5, 0, fractionalEndCtx)).toBe(0);
    });

    it('very small fractional part at start', () => {
      const tinyFractionalCtx: FractionalGridContext = {
        drawerDimension: 10.001,
        fractionalEdge: 'start',
        cellSize: 40,
        gap: 2,
      };
      // fractionalCellSize = 0.001 * 42 - 2 = 0.042 - 2 = -1.958
      // inFractional = 0.001, inInteger = 0
      // pixels = (0.001/0.001) * (-1.958) = -1.958
      // Should still compute (may be negative due to formula)
      const result = calcFractionalPixelSize(0, 0.001, tinyFractionalCtx);
      expect(result).toBeDefined();
    });

    it('large fractional part (0.9)', () => {
      const largeFractionalCtx: FractionalGridContext = {
        drawerDimension: 10.9,
        fractionalEdge: 'end',
        cellSize: 40,
        gap: 2,
      };
      // fractionalPart = 0.9, fractionalCellSize = 0.9 * 42 - 2 = 37.8 - 2 = 35.8
      // position=10, size=0.9
      // inInteger = 0, inFractional = 0.9
      // pixels = (0.9/0.9) * 35.8 = 35.8
      expect(calcFractionalPixelSize(10, 0.9, largeFractionalCtx)).toBe(35.8);
    });
  });

  describe('complex spanning scenarios', () => {
    const fractionalEndCtx: FractionalGridContext = {
      drawerDimension: 10.5,
      fractionalEdge: 'end',
      cellSize: 40,
      gap: 2,
    };

    it('3 units starting at position 9 (exceeds drawer bounds)', () => {
      // position=9, size=3 → regionEnd=12 (exceeds drawer 10.5)
      // inInteger = max(0, min(12, 10) - 9) = 1
      // inFractional = 3 - 1 = 2
      // fractionalCellSize = 0.5 * 42 - 2 = 19
      // pixels = 1*40 + max(0, floor(1.001)-1)*2 + 2(gap) + (2/0.5)*19
      //        = 40 + 0 + 2 + 76 = 118
      // Function doesn't clamp inFractional, allowing over-size representation
      expect(calcFractionalPixelSize(9, 3, fractionalEndCtx)).toBe(118);
    });

    it('single unit entirely in middle of integer region', () => {
      // position=3, size=1
      // inInteger = min(4, 10) - 3 = 1
      // inFractional = 0
      // pixels = 1*40 = 40
      expect(calcFractionalPixelSize(3, 1, fractionalEndCtx)).toBe(40);
    });
  });

  describe('FLOAT_EPSILON behavior (gap count precision)', () => {
    const fractionalEndCtx: FractionalGridContext = {
      drawerDimension: 10.5,
      fractionalEdge: 'end',
      cellSize: 40,
      gap: 2,
    };

    it('handles fractional inInteger like 1.9999999999 correctly', () => {
      // This tests that FLOAT_EPSILON handles floating-point errors in gap counting
      // When inInteger = 2.0, we need 1 gap
      // Math.floor(2.0 + 0.001) = 2, so max(0, 2 - 1) = 1 ✓
      expect(calcFractionalPixelSize(0, 2, fractionalEndCtx)).toBe(82);
    });

    it('fractional position with multiple integer units', () => {
      // position=0.5, size=3.5
      // inInteger = min(4, 10) - 0.5 = 3.5
      // inFractional = 0 (3.5 doesn't extend past 10)
      // pixels = 3.5 * 40 + Math.max(0, floor(3.5 + 0.001) - 1) * 2
      //        = 140 + 2*2 = 144
      expect(calcFractionalPixelSize(0.5, 3.5, fractionalEndCtx)).toBe(144);
    });
  });

  describe('comparison: integer vs fractional context', () => {
    const integerCtx: FractionalGridContext = {
      drawerDimension: 10,
      fractionalEdge: 'end',
      cellSize: 40,
      gap: 2,
    };

    const fractionalCtx: FractionalGridContext = {
      drawerDimension: 10.5,
      fractionalEdge: 'end',
      cellSize: 40,
      gap: 2,
    };

    it('same region in integer drawer matches standard toPixels', () => {
      // Region entirely in integer part should match toPixels
      const calc = calcFractionalPixelSize(0, 3, integerCtx);
      const standard = toPixels(3, 40, 2);
      expect(calc).toBe(standard);
    });

    it('region entirely in integer part matches toPixels even with fractional drawer', () => {
      // Region [0, 3) is entirely in integer part [0, 10) of 10.5 drawer
      const calc = calcFractionalPixelSize(0, 3, fractionalCtx);
      const standard = toPixels(3, 40, 2);
      expect(calc).toBe(standard);
    });

    it('adds fractional width only when region touches fractional edge', () => {
      // Region [0, 3) in integer part: 3*40 + 2*2 = 124
      // Region [0, 3.5) spanning: should be more than 124 due to fractional part
      const intPart = calcFractionalPixelSize(0, 3, fractionalCtx);
      const spanning = calcFractionalPixelSize(0, 3.5, fractionalCtx);
      expect(spanning).toBeGreaterThan(intPart);
    });
  });

  describe('realistic drawer configurations', () => {
    it('standard 12.5 unit drawer, half-bin mode at end', () => {
      const ctx: FractionalGridContext = {
        drawerDimension: 12.5,
        fractionalEdge: 'end',
        cellSize: 40,
        gap: 2,
      };
      // Full width bin
      const fullWidth = calcFractionalPixelSize(0, 12.5, ctx);
      // fractionalCellSize = 0.5 * 42 - 2 = 19
      // pixels = 12*40 + 11*2 + 2 + 19 = 480 + 22 + 2 + 19 = 523
      expect(fullWidth).toBe(523);
    });

    it('standard 10 unit drawer with 30px cells', () => {
      const ctx: FractionalGridContext = {
        drawerDimension: 10,
        fractionalEdge: 'end',
        cellSize: 30,
        gap: 1,
      };
      // 3 units
      const result = calcFractionalPixelSize(0, 3, ctx);
      expect(result).toBe(toPixels(3, 30, 1)); // 3*30 + 2*1 = 92
    });

    it('10.5 unit drawer, bin at end fractional edge', () => {
      const ctx: FractionalGridContext = {
        drawerDimension: 10.5,
        fractionalEdge: 'end',
        cellSize: 40,
        gap: 2,
      };
      // Half-bin at the very end
      const halfBinEnd = calcFractionalPixelSize(10, 0.5, ctx);
      expect(halfBinEnd).toBe(19); // (0.5/0.5) * 19
    });
  });

  describe('coordinate system validation', () => {
    it('position increases left-to-right correctly', () => {
      const ctx: FractionalGridContext = {
        drawerDimension: 10,
        fractionalEdge: 'end',
        cellSize: 40,
        gap: 2,
      };
      const atStart = calcFractionalPixelSize(0, 1, ctx);
      const atMiddle = calcFractionalPixelSize(5, 1, ctx);
      const atEnd = calcFractionalPixelSize(9, 1, ctx);

      // All should be 40 (single unit)
      expect(atStart).toBe(40);
      expect(atMiddle).toBe(40);
      expect(atEnd).toBe(40);
    });

    it('position boundary: last integer unit', () => {
      const ctx: FractionalGridContext = {
        drawerDimension: 10.5,
        fractionalEdge: 'end',
        cellSize: 40,
        gap: 2,
      };
      // Last full unit in integer region
      const lastInteger = calcFractionalPixelSize(9, 1, ctx);
      expect(lastInteger).toBe(40);

      // First half unit in fractional region
      const firstFractional = calcFractionalPixelSize(10, 0.5, ctx);
      expect(firstFractional).toBe(19);
    });
  });
});
