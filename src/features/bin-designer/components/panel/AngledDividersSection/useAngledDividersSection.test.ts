import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAngledDividersSection } from './useAngledDividersSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLabsStore } from '@/core/store/labs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('useAngledDividersSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: DEFAULT_BIN_PARAMS });
    useLabsStore.getState().enableFeature('angled_dividers');
  });

  function setCompartments(cols: number, rows: number, cells: number[]) {
    useDesignerStore.setState((s) => ({
      params: {
        ...s.params,
        compartments: { ...s.params.compartments, cols, rows, cells },
      },
    }));
  }

  it('reports unavailable when there are no interior dividers', () => {
    setCompartments(1, 1, [0]);
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.isUnavailable).toBe(true);
    expect(result.current.state.rows).toEqual([]);
    expect(result.current.meta.disabledReason).toBeDefined();
  });

  it('lists one row per eligible divider in a 1×2 grid', () => {
    setCompartments(1, 2, [0, 1]);
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.rows).toHaveLength(1);
    expect(result.current.state.rows[0]).toMatchObject({
      compartmentA: 0,
      compartmentB: 1,
      axis: 'horizontal',
      offsetStart: 0,
      offsetEnd: 0,
      displayNumber: 1,
    });
  });

  it('setOffset writes a divider override and clamps to the UI cap', () => {
    setCompartments(1, 2, [0, 1]);
    const { result } = renderHook(() => useAngledDividersSection());
    act(() => {
      result.current.handlers.setOffset(result.current.state.rows[0], 'start', 999);
    });
    const overrides = useDesignerStore.getState().params.compartments.dividerOverrides;
    expect(overrides).toHaveLength(1);
    // UI cap is ±50; storage shouldn't receive 999.
    expect(overrides?.[0].offsetStart).toBe(50);
  });

  it('resetRow removes the override and shrinks the summary', () => {
    setCompartments(1, 2, [0, 1]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    act(() => {
      result.current.handlers.setOffset(result.current.state.rows[0], 'start', 10);
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(true);
    act(() => {
      result.current.handlers.resetRow(result.current.state.rows[0]);
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(false);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('toggleEnabled clears all overrides when any exist', () => {
    setCompartments(2, 2, [0, 1, 2, 3]);
    const { result, rerender } = renderHook(() => useAngledDividersSection());
    act(() => {
      result.current.handlers.setOffset(result.current.state.rows[0], 'start', 10);
      result.current.handlers.setOffset(result.current.state.rows[1], 'end', -5);
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(true);
    act(() => {
      result.current.handlers.toggleEnabled();
    });
    rerender();
    expect(result.current.state.hasAnyOverride).toBe(false);
    expect(useDesignerStore.getState().params.compartments.dividerOverrides).toBeUndefined();
  });

  it('hides itself when the labs flag is off', () => {
    useLabsStore.getState().disableFeature('angled_dividers');
    setCompartments(1, 2, [0, 1]);
    const { result } = renderHook(() => useAngledDividersSection());
    expect(result.current.state.flagEnabled).toBe(false);
  });
});
