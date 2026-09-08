import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridUnitChange } from './useGridUnitChange';
import { useLayoutStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { mm } from '@/core/types';

function pitch(): { x: number; y: number | undefined } {
  const layout = useLayoutStore.getState().layout;
  return { x: layout.gridUnitMm, y: layout.gridUnitMmY };
}

describe('useGridUnitChange', () => {
  beforeEach(() => {
    resetAllStores();
    useLayoutStore.setState({ layout: createTestLayout() });
  });

  it('writes X and clears the Y pitch when the axes are linked', () => {
    useLayoutStore.setState({
      layout: { ...createTestLayout(), gridUnitMm: mm(42), gridUnitMmY: mm(30) },
    });
    const { result } = renderHook(() => useGridUnitChange());
    act(() => result.current(40));
    expect(pitch()).toEqual({ x: 40, y: undefined });
  });

  it('writes independent X and Y when unlinked', () => {
    const { result } = renderHook(() => useGridUnitChange());
    act(() => result.current(40, 42));
    expect(pitch()).toEqual({ x: 40, y: 42 });
  });

  it('records an unlinked X+Y edit as a single undo step', () => {
    const { result } = renderHook(() => useGridUnitChange());
    const before = useHistoryStore.getState().past.length;
    act(() => result.current(40, 42));
    expect(useHistoryStore.getState().past.length).toBe(before + 1);
  });

  it('ignores a commit that changes neither axis', () => {
    const { result } = renderHook(() => useGridUnitChange());
    const before = useHistoryStore.getState().past.length;
    act(() => result.current(useLayoutStore.getState().layout.gridUnitMm as number));
    expect(useHistoryStore.getState().past.length).toBe(before);
  });
});
