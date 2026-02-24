import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridAxisLabels } from './useGridAxisLabels';
import type { Drawer } from '@/core/types';

function makeDrawer(overrides: Partial<Drawer> = {}): Drawer {
  return {
    width: 10,
    depth: 8,
    height: 12,
    ...overrides,
  };
}

describe('useGridAxisLabels', () => {
  describe('integer dimensions', () => {
    it('generates column labels 1 to width', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer({ width: 4, depth: 3 }), zoom: 1, cellSize: 32 })
      );

      expect(result.current.columnLabels).toEqual([1, 2, 3, 4]);
    });

    it('generates row labels from depth down to 1 (top-to-bottom visual order)', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer({ width: 4, depth: 3 }), zoom: 1, cellSize: 32 })
      );

      expect(result.current.rowLabels).toEqual([3, 2, 1]);
    });

    it('reports integer dimensions correctly', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer({ width: 6, depth: 4 }), zoom: 1, cellSize: 32 })
      );

      expect(result.current.integerWidth).toBe(6);
      expect(result.current.integerDepth).toBe(4);
      expect(result.current.hasFractionalWidth).toBe(false);
      expect(result.current.hasFractionalDepth).toBe(false);
    });
  });

  describe('fractional dimensions', () => {
    it('appends +.5 column label at end when fractionalEdgeX is end (default)', () => {
      const drawer = makeDrawer({ width: 4.5, depth: 3 });

      const { result } = renderHook(() => useGridAxisLabels({ drawer, zoom: 1, cellSize: 32 }));

      expect(result.current.hasFractionalWidth).toBe(true);
      expect(result.current.columnLabels).toEqual([1, 2, 3, 4, '+.5']);
    });

    it('prepends +.5 column label at start when fractionalEdgeX is start', () => {
      const drawer = makeDrawer({ width: 4.5, depth: 3, fractionalEdgeX: 'start' });

      const { result } = renderHook(() => useGridAxisLabels({ drawer, zoom: 1, cellSize: 32 }));

      expect(result.current.columnLabels).toEqual(['+.5', 1, 2, 3, 4]);
    });

    it('prepends +.5 row label at top when fractionalEdgeY is end (default)', () => {
      const drawer = makeDrawer({ width: 4, depth: 3.5 });

      const { result } = renderHook(() => useGridAxisLabels({ drawer, zoom: 1, cellSize: 32 }));

      expect(result.current.hasFractionalDepth).toBe(true);
      // 'end' = top (CSS row 1), so +.5 is at start of array
      expect(result.current.rowLabels[0]).toBe('+.5');
    });

    it('appends +.5 row label at bottom when fractionalEdgeY is start', () => {
      const drawer = makeDrawer({ width: 4, depth: 3.5, fractionalEdgeY: 'start' });

      const { result } = renderHook(() => useGridAxisLabels({ drawer, zoom: 1, cellSize: 32 }));

      expect(result.current.rowLabels.at(-1)).toBe('+.5');
    });

    it('reports integerWidth and integerDepth correctly for fractional drawers', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({
          drawer: makeDrawer({ width: 5.5, depth: 4.5 }),
          zoom: 1,
          cellSize: 32,
        })
      );

      expect(result.current.integerWidth).toBe(5);
      expect(result.current.integerDepth).toBe(4);
    });
  });

  describe('label sizing based on zoom and cellSize', () => {
    it('hides label font when cellSize is below 14', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer(), zoom: 0.2, cellSize: 10 })
      );

      expect(result.current.labelFontSize).toBe(0);
    });

    it('shows label font when cellSize is 14 or above', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer(), zoom: 1, cellSize: 32 })
      );

      expect(result.current.labelFontSize).toBeGreaterThan(0);
    });

    it('hides axis labels when cellSize is below 12', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer(), zoom: 0.1, cellSize: 8 })
      );

      expect(result.current.axisLabelsVisible).toBe(false);
    });

    it('shows axis labels when cellSize is 12 or above', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer(), zoom: 1, cellSize: 32 })
      );

      expect(result.current.axisLabelsVisible).toBe(true);
    });

    it('computes label width and height from zoom', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer(), zoom: 2, cellSize: 64 })
      );

      // labelWidth = max(16, round(20 * 2)) = max(16, 40) = 40
      expect(result.current.labelWidth).toBe(40);
      expect(result.current.columnLabelHeight).toBe(40);
    });

    it('uses minimum label dimensions at very small zoom', () => {
      const { result } = renderHook(() =>
        useGridAxisLabels({ drawer: makeDrawer(), zoom: 0.1, cellSize: 8 })
      );

      expect(result.current.labelWidth).toBe(16);
      expect(result.current.columnLabelHeight).toBe(16);
    });
  });

  describe('fractionalEdgeX/Y defaults', () => {
    it('defaults fractionalEdgeX to end when not set', () => {
      const drawer = makeDrawer({ width: 4.5, depth: 3 });
      // No fractionalEdgeX set → should default to 'end'

      const { result } = renderHook(() => useGridAxisLabels({ drawer, zoom: 1, cellSize: 32 }));

      expect(result.current.fractionalEdgeX).toBe('end');
    });

    it('defaults fractionalEdgeY to end when not set', () => {
      const drawer = makeDrawer({ width: 4, depth: 3.5 });

      const { result } = renderHook(() => useGridAxisLabels({ drawer, zoom: 1, cellSize: 32 }));

      expect(result.current.fractionalEdgeY).toBe('end');
    });
  });
});
