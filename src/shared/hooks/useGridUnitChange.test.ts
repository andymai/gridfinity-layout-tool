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

  /**
   * Both ordering cases need a custom outline: without one `gridPitchFloors`
   * returns the 1mm floor on both axes and neither clamp can fire, so the
   * assertions would hold whichever write lands first.
   *
   * 200mm over 10 units floors X at 20; 210mm over 5 units floors Y at 42.
   */
  const flooredLayout = (gridUnitMm: number, gridUnitMmY: number | undefined) => ({
    ...createTestLayout(),
    gridUnitMm: mm(gridUnitMm),
    gridUnitMmY: gridUnitMmY === undefined ? undefined : mm(gridUnitMmY),
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
  });

  // A square grid's X floor honours the Y bound too, so X must land AFTER Y or
  // it clamps to 42 against a floor that only applied while the axes were tied.
  it('unlinks to a narrower X than the square-grid floor would allow', () => {
    useLayoutStore.setState({ layout: flooredLayout(42, undefined) });
    const { result } = renderHook(() => useGridUnitChange());
    act(() => result.current(30, 42));
    expect(pitch()).toEqual({ x: 30, y: 42 });
  });

  // The mirror: clearing Y refuses to collapse onto an X below the Y floor, so
  // X must land FIRST. Writing Y first leaves the refused Y at 42.
  it('relinks to a square pitch that clears the stored Y', () => {
    useLayoutStore.setState({ layout: flooredLayout(30, 42) });
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
