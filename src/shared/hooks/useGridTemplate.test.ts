import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridTemplate } from '@/shared/hooks/useGridTemplate';
import type { Drawer } from '@/core/types';

// Minimal valid Drawer factory
function makeDrawer(overrides: Partial<Drawer> = {}): Drawer {
  return { width: 4, depth: 4, height: 10, ...overrides };
}

describe('useGridTemplate', () => {
  describe('integer drawer (4x4, cellSize=32, gap=4)', () => {
    it('produces repeat CSS template for columns', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateColumns).toBe('repeat(4, 32px)');
    });

    it('produces repeat CSS template for rows', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateRows).toBe('repeat(4, 32px)');
    });

    it('reports no fractional dimensions', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.hasFractionalWidth).toBe(false);
      expect(result.current.hasFractionalDepth).toBe(false);
    });

    it('reports zero fractional cell sizes', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.fractionalCellWidth).toBe(0);
      expect(result.current.fractionalCellHeight).toBe(0);
    });

    it('reports correct integer dimensions', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.integerWidth).toBe(4);
      expect(result.current.integerDepth).toBe(4);
    });

    it('reports correct grid dimensions', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridCols).toBe(4);
      expect(result.current.gridRows).toBe(4);
    });

    it('defaults fractionalEdgeX to end', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.fractionalEdgeX).toBe('end');
    });

    it('defaults fractionalEdgeY to end', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.fractionalEdgeY).toBe('end');
    });
  });

  describe('getCssColForCell — integer drawer', () => {
    it('maps x=0 to CSS column 1', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.getCssColForCell(0)).toBe(1);
    });

    it('maps x=3 to CSS column 4', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.getCssColForCell(3)).toBe(4);
    });
  });

  describe('getCssRowForCell — integer drawer (coordinate reversal)', () => {
    it('maps y=0 (bottom) to last CSS row', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      // y=0 is bottom; CSS rows start at top, so y=0 → row 4
      expect(result.current.getCssRowForCell(0)).toBe(4);
    });

    it('maps y=3 (top) to CSS row 1', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.getCssRowForCell(3)).toBe(1);
    });

    it('maps y=1 to CSS row 3 in a 4-row grid', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer(), cellSize: 32, gap: 4 })
      );
      expect(result.current.getCssRowForCell(1)).toBe(3);
    });
  });

  describe('fractional width at end (4.5 wide, cellSize=32, gap=4)', () => {
    it('sets hasFractionalWidth true', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.hasFractionalWidth).toBe(true);
    });

    it('sets hasFractionalDepth false', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.hasFractionalDepth).toBe(false);
    });

    it('reports integerWidth=4, gridCols=5', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.integerWidth).toBe(4);
      expect(result.current.gridCols).toBe(5);
    });

    it('places fractional column at end in gridTemplateColumns', () => {
      // fractionalCellWidth = 0.5 * (32 + 4) - 4 = 18 - 4 = 14px
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateColumns).toBe('repeat(4, 32px) 14px');
    });

    it('calculates fractionalCellWidth correctly: 0.5*(cellSize+gap)-gap', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5 }), cellSize: 32, gap: 4 })
      );
      const expected = 0.5 * (32 + 4) - 4; // 14
      expect(result.current.fractionalCellWidth).toBe(expected);
    });

    it('does not change gridTemplateRows', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateRows).toBe('repeat(4, 32px)');
    });

    it('getCssColForCell maps x=0 to column 1 (fractional is after, not before)', () => {
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ width: 4.5, fractionalEdgeX: 'end' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(result.current.getCssColForCell(0)).toBe(1);
    });
  });

  describe('fractional width at start (4.5 wide, fractionalEdgeX=start)', () => {
    it('places fractional column at start in gridTemplateColumns', () => {
      // fractionalCellWidth = 0.5 * (32 + 4) - 4 = 14px
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ width: 4.5, fractionalEdgeX: 'start' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(result.current.gridTemplateColumns).toBe('14px repeat(4, 32px)');
    });

    it('getCssColForCell shifts integer cells right by 1 to skip fractional column', () => {
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ width: 4.5, fractionalEdgeX: 'start' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(result.current.getCssColForCell(0)).toBe(2);
      expect(result.current.getCssColForCell(3)).toBe(5);
    });

    it('reports fractionalEdgeX as start', () => {
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ width: 4.5, fractionalEdgeX: 'start' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(result.current.fractionalEdgeX).toBe('start');
    });
  });

  describe('fractional depth at end (depth=4.5, fractionalEdgeY=end)', () => {
    it('sets hasFractionalDepth true', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.hasFractionalDepth).toBe(true);
    });

    it('places fractional row at top (CSS row 1) when fractionalEdgeY=end (default)', () => {
      // fractionalEdgeY='end' means top in our coordinate system → CSS row 1
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateRows).toBe('14px repeat(4, 32px)');
    });

    it('calculates fractionalCellHeight correctly', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.fractionalCellHeight).toBe(0.5 * (32 + 4) - 4);
    });

    it('reports integerDepth=4, gridRows=5', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.integerDepth).toBe(4);
      expect(result.current.gridRows).toBe(5);
    });

    it('getCssRowForCell offsets by 1 due to fractional row at top (CSS row 1)', () => {
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ depth: 4.5, fractionalEdgeY: 'end' }),
          cellSize: 32,
          gap: 4,
        })
      );
      // y=0 (bottom) → integerDepth - 0 + 1 = 5
      expect(result.current.getCssRowForCell(0)).toBe(5);
      // y=3 (top integer) → 4 - 3 + 1 = 2
      expect(result.current.getCssRowForCell(3)).toBe(2);
    });
  });

  describe('fractional depth at start (depth=4.5, fractionalEdgeY=start)', () => {
    it('places fractional row at bottom (last CSS row) when fractionalEdgeY=start', () => {
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ depth: 4.5, fractionalEdgeY: 'start' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(result.current.gridTemplateRows).toBe('repeat(4, 32px) 14px');
    });

    it('getCssRowForCell does not add fractional offset when fractionalEdgeY=start', () => {
      const { result } = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ depth: 4.5, fractionalEdgeY: 'start' }),
          cellSize: 32,
          gap: 4,
        })
      );
      // y=0 (bottom) → integerDepth - 0 = 4
      expect(result.current.getCssRowForCell(0)).toBe(4);
      // y=3 (top integer) → integerDepth - 3 = 1
      expect(result.current.getCssRowForCell(3)).toBe(1);
    });
  });

  describe('both dimensions fractional (4.5x4.5)', () => {
    it('sets both hasFractionalWidth and hasFractionalDepth true', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5, depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.hasFractionalWidth).toBe(true);
      expect(result.current.hasFractionalDepth).toBe(true);
    });

    it('builds correct column template (fractional at end)', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5, depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateColumns).toBe('repeat(4, 32px) 14px');
    });

    it('builds correct row template (fractional at top, default)', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5, depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateRows).toBe('14px repeat(4, 32px)');
    });

    it('reports gridCols=5 and gridRows=5', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4.5, depth: 4.5 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridCols).toBe(5);
      expect(result.current.gridRows).toBe(5);
    });
  });

  describe('fractionalCellWidth formula: fractionalPart * (cellSize + gap) - gap', () => {
    it('computes correctly for 0.5 fractional part', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 3.5 }), cellSize: 40, gap: 8 })
      );
      // 0.5 * (40 + 8) - 8 = 24 - 8 = 16
      expect(result.current.fractionalCellWidth).toBe(16);
    });

    it('computes correctly for 0.25 fractional part', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 3.25 }), cellSize: 40, gap: 8 })
      );
      // 0.25 * (40 + 8) - 8 = 12 - 8 = 4
      expect(result.current.fractionalCellWidth).toBe(4);
    });

    it('computes correctly for different gap values', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 2.5 }), cellSize: 20, gap: 2 })
      );
      // 0.5 * (20 + 2) - 2 = 11 - 2 = 9
      expect(result.current.fractionalCellWidth).toBe(9);
    });

    it('is zero when there is no fractional width', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 4 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.fractionalCellWidth).toBe(0);
    });
  });

  describe('various drawer sizes', () => {
    it('handles a 1x1 integer drawer', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 1, depth: 1 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateColumns).toBe('repeat(1, 32px)');
      expect(result.current.gridTemplateRows).toBe('repeat(1, 32px)');
      expect(result.current.gridCols).toBe(1);
      expect(result.current.gridRows).toBe(1);
    });

    it('handles a 10x8 large integer drawer', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 10, depth: 8 }), cellSize: 32, gap: 4 })
      );
      expect(result.current.gridTemplateColumns).toBe('repeat(10, 32px)');
      expect(result.current.gridTemplateRows).toBe('repeat(8, 32px)');
      expect(result.current.gridCols).toBe(10);
      expect(result.current.gridRows).toBe(8);
    });

    it('maps y correctly in a large grid (depth=8)', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 10, depth: 8 }), cellSize: 32, gap: 4 })
      );
      // y=0 (bottom) → CSS row 8, y=7 (top) → CSS row 1
      expect(result.current.getCssRowForCell(0)).toBe(8);
      expect(result.current.getCssRowForCell(7)).toBe(1);
    });
  });

  describe('gap=0 edge case', () => {
    it('produces correct templates with zero gap', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 3, depth: 3 }), cellSize: 20, gap: 0 })
      );
      expect(result.current.gridTemplateColumns).toBe('repeat(3, 20px)');
      expect(result.current.gridTemplateRows).toBe('repeat(3, 20px)');
    });

    it('computes fractionalCellWidth with zero gap: fractionalPart * cellSize', () => {
      const { result } = renderHook(() =>
        useGridTemplate({ drawer: makeDrawer({ width: 2.5 }), cellSize: 20, gap: 0 })
      );
      // 0.5 * (20 + 0) - 0 = 10
      expect(result.current.fractionalCellWidth).toBe(10);
    });
  });

  describe('explicit fractionalEdgeX=end matches default', () => {
    it('produces identical output to no fractionalEdgeX specified', () => {
      const withDefault = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ width: 4.5 }),
          cellSize: 32,
          gap: 4,
        })
      );
      const withExplicit = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ width: 4.5, fractionalEdgeX: 'end' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(withDefault.result.current.gridTemplateColumns).toBe(
        withExplicit.result.current.gridTemplateColumns
      );
      expect(withDefault.result.current.getCssColForCell(0)).toBe(
        withExplicit.result.current.getCssColForCell(0)
      );
    });
  });

  describe('explicit fractionalEdgeY=end matches default', () => {
    it('produces identical output to no fractionalEdgeY specified', () => {
      const withDefault = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ depth: 4.5 }),
          cellSize: 32,
          gap: 4,
        })
      );
      const withExplicit = renderHook(() =>
        useGridTemplate({
          drawer: makeDrawer({ depth: 4.5, fractionalEdgeY: 'end' }),
          cellSize: 32,
          gap: 4,
        })
      );
      expect(withDefault.result.current.gridTemplateRows).toBe(
        withExplicit.result.current.gridTemplateRows
      );
    });
  });
});
