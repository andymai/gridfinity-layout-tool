import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridUnitChange } from './useGridUnitChange';
import { useLayoutStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { createTestLayout, resetAllStores } from '@/test/testUtils';
import { gridUnits, mm } from '@/core/types';

function pitch(): { x: number; y: number | undefined } {
  const layout = useLayoutStore.getState().layout;
  return { x: layout.gridUnitMm, y: layout.gridUnitMmY };
}

describe('useGridUnitChange', () => {
  beforeEach(() => {
    resetAllStores();
    useLayoutStore.setState({ layout: createTestLayout() });
  });

  it('clears a stale Y pitch when only X is supplied', () => {
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

  // A custom outline floors each axis independently, but a SQUARE grid's X
  // floor honours the Y bound too (gridPitchFloors). Unlinking therefore has to
  // store Y before X, or X clamps against a floor that only applied while the
  // axes were still tied together.
  it('unlinks to a narrower X than the square-grid floor would allow', () => {
    useLayoutStore.setState({
      layout: {
        ...createTestLayout(),
        gridUnitMm: mm(42),
        gridUnitMmY: undefined,
        drawer: {
          ...createTestLayout().drawer,
          width: gridUnits(10),
          depth: gridUnits(5),
          outline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 200, y: 0 },
              { x: 200, y: 210 },
              { x: 0, y: 210 },
            ],
          },
        },
      },
    });
    const { result } = renderHook(() => useGridUnitChange());
    act(() => result.current(30, 42));
    expect(pitch()).toEqual({ x: 30, y: 42 });
  });

  it('relinks to a square pitch that clears the stored Y', () => {
    useLayoutStore.setState({
      layout: { ...createTestLayout(), gridUnitMm: mm(30), gridUnitMmY: mm(42) },
    });
    const { result } = renderHook(() => useGridUnitChange());
    act(() => result.current(50));
    expect(pitch()).toEqual({ x: 50, y: undefined });
  });

  it('ignores a commit that changes neither axis', () => {
    const { result } = renderHook(() => useGridUnitChange());
    const before = useHistoryStore.getState().past.length;
    act(() => result.current(useLayoutStore.getState().layout.gridUnitMm as number));
    expect(useHistoryStore.getState().past.length).toBe(before);
  });
});
