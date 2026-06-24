import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompartmentLabeling } from './useCompartmentLabeling';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  createUniformGrid,
  createSingleCell,
  getCompartmentCount,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';

const render = (config: CompartmentConfig, style = 'standard') =>
  renderHook(({ c, s }) => useCompartmentLabeling(c, s, getCompartmentCount(c)), {
    initialProps: { c: config, s: style },
  });

describe('useCompartmentLabeling', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  describe('canLabel gating', () => {
    it('is true for a standard grid with >1 compartment', () => {
      const { result } = render(createUniformGrid(3, 2, 1.2));
      expect(result.current.canLabel).toBe(true);
    });

    it('is false for a single-cell grid', () => {
      const { result } = render(createSingleCell(1.2));
      expect(result.current.canLabel).toBe(false);
    });

    it('is false for slotted / solid interiors', () => {
      const grid = createUniformGrid(3, 2, 1.2);
      expect(render(grid, 'slotted').result.current.canLabel).toBe(false);
      expect(render(grid, 'solid').result.current.canLabel).toBe(false);
    });
  });

  describe('mode + selection', () => {
    it('entering label mode selects the first compartment (visual top-left)', () => {
      // 3x2 grid: data rows [0,1,2] (bottom) and [3,4,5] (top). Reading order is
      // top-left first, so the first compartment is id 3 (#2338).
      const { result } = render(createUniformGrid(3, 2, 1.2));
      expect(result.current.editingId).toBeNull();
      act(() => result.current.setLabelMode(true));
      expect(result.current.labelMode).toBe(true);
      expect(result.current.editingId).toBe(3);
    });

    it('refuses to enter label mode when labeling is unavailable', () => {
      const { result } = render(createSingleCell(1.2));
      act(() => result.current.setLabelMode(true));
      expect(result.current.labelMode).toBe(false);
    });

    it('forces label mode off when labeling becomes unavailable', () => {
      const { result, rerender } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.setLabelMode(true));
      expect(result.current.labelMode).toBe(true);
      rerender({ c: createSingleCell(1.2), s: 'standard' });
      expect(result.current.labelMode).toBe(false);
      expect(result.current.editingId).toBeNull();
    });
  });

  describe('display numbering', () => {
    it('maps compartment ids to 1-based display order (visual top-left first)', () => {
      const { result } = render(createUniformGrid(3, 2, 1.2));
      // Top row [3,4,5] reads before the bottom row [0,1,2] (#2338).
      expect(result.current.orderedIds).toEqual([3, 4, 5, 0, 1, 2]);
      expect(result.current.displayNumberOf(3)).toBe(1);
      expect(result.current.displayNumberOf(2)).toBe(6);
    });
  });

  describe('navigation', () => {
    it('advance walks forward and clamps at the last compartment', () => {
      // Reading order is [3,4,5,0,1,2]: first = id 3, last = id 2.
      const { result } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.setLabelMode(true));
      act(() => result.current.advance('next'));
      expect(result.current.editingId).toBe(4);
      act(() => result.current.selectCompartment(2));
      act(() => result.current.advance('next'));
      expect(result.current.editingId).toBe(2); // clamped at last
    });

    it('advance prev clamps at the first compartment', () => {
      const { result } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.setLabelMode(true));
      act(() => result.current.advance('prev'));
      expect(result.current.editingId).toBe(3); // clamped at first (top-left)
    });

    it('moveByGrid steps right and (visually) up to the adjacent compartment', () => {
      const { result } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.setLabelMode(true)); // first = id 3 at (col0,row1)
      act(() => result.current.moveByGrid('right'));
      expect(result.current.editingId).toBe(4); // (col1,row1)
      act(() => result.current.selectCompartment(0));
      act(() => result.current.moveByGrid('up'));
      expect(result.current.editingId).toBe(3); // (col0,row1) — visual up = higher data row
    });

    it('moveByGrid past the grid edge is a no-op', () => {
      const { result } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.setLabelMode(true)); // first = id 3 at (col0,row1)
      act(() => result.current.moveByGrid('left')); // already at col 0
      expect(result.current.editingId).toBe(3);
    });
  });

  describe('text', () => {
    it('commitText writes through to the store', () => {
      const { result } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.commitText(2, 'SCREWS'));
      expect(useDesignerStore.getState().params.compartments.compartmentTexts?.[2]).toBe('SCREWS');
    });

    it('textOf reads committed text from the passed config', () => {
      const grid = { ...createUniformGrid(3, 2, 1.2), compartmentTexts: ['', '', 'BOLTS'] };
      const { result } = render(grid);
      expect(result.current.textOf(2)).toBe('BOLTS');
      expect(result.current.textOf(0)).toBe('');
    });

    it('falls back to the first compartment when the edited id disappears', () => {
      const { result, rerender } = render(createUniformGrid(3, 2, 1.2));
      act(() => result.current.setLabelMode(true));
      act(() => result.current.selectCompartment(5));
      expect(result.current.editingId).toBe(5);
      // Shrink the grid so id 5 no longer exists. The 2x2 reading order is
      // [2,3,0,1], so the fallback is the top-left id 2.
      rerender({ c: createUniformGrid(2, 2, 1.2), s: 'standard' });
      expect(result.current.editingId).toBe(2);
    });
  });
});
