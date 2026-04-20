import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useShapeSection } from './useShapeSection';

describe('useShapeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 3 },
      ui: { ...useDesignerStore.getState().ui, halfBinMode: false },
    });
  });

  it('exposes cols/rows at 1u resolution when halfBinMode is off', () => {
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.cols).toBe(3);
    expect(result.current.state.rows).toBe(3);
  });

  it('exposes cols/rows at 0.5u resolution when halfBinMode is on', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfBinMode: true },
    });
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.cols).toBe(6);
    expect(result.current.state.rows).toBe(6);
  });

  it('isCustom starts false (fast rectangle path)', () => {
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.isCustom).toBe(false);
  });

  it('applyPreset("l") flips isCustom to true', () => {
    const { result } = renderHook(() => useShapeSection());
    act(() => result.current.handlers.applyPreset('l'));
    expect(result.current.state.isCustom).toBe(true);
  });

  it('applyPreset("rectangle") clears the mask (rectangle fast-path)', () => {
    const { result } = renderHook(() => useShapeSection());
    act(() => result.current.handlers.applyPreset('l'));
    expect(result.current.state.isCustom).toBe(true);
    act(() => result.current.handlers.applyPreset('rectangle'));
    expect(result.current.state.isCustom).toBe(false);
  });

  it('applyPreset skips no-op when current mask already matches preset', () => {
    const { result } = renderHook(() => useShapeSection());
    act(() => result.current.handlers.applyPreset('l'));
    const initialHistoryLength = useDesignerStore.getState().history.past.length;
    act(() => result.current.handlers.applyPreset('l'));
    expect(useDesignerStore.getState().history.past.length).toBe(initialHistoryLength);
  });

  it('1u toggleCell flips all four sub-cells of the grid square together', () => {
    const { result } = renderHook(() => useShapeSection());
    // Clear the bottom-right 1u grid square at (col=2, row=0).
    act(() => result.current.handlers.toggleCell(2, 0));
    expect(result.current.state.isCustom).toBe(true);
    // Display (coarse) cell is now empty.
    expect(result.current.state.mask.cells[0 * 3 + 2]).toBe(0);
    // All four underlying sub-cells in the store should be cleared.
    const stored = useDesignerStore.getState().params.cellMask;
    expect(stored).toBeDefined();
    expect(stored!.cells[0 * 6 + 4]).toBe(0);
    expect(stored!.cells[0 * 6 + 5]).toBe(0);
    expect(stored!.cells[1 * 6 + 4]).toBe(0);
    expect(stored!.cells[1 * 6 + 5]).toBe(0);
  });

  it('0.5u toggleCell (halfBinMode on) flips a single sub-cell', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfBinMode: true },
    });
    const { result } = renderHook(() => useShapeSection());
    act(() => result.current.handlers.toggleCell(5, 0));
    expect(result.current.state.isCustom).toBe(true);
    const stored = useDesignerStore.getState().params.cellMask;
    expect(stored!.cells[0 * 6 + 5]).toBe(0);
    // Sibling sub-cells in the same 1u square are unchanged.
    expect(stored!.cells[0 * 6 + 4]).toBe(1);
    expect(stored!.cells[1 * 6 + 4]).toBe(1);
    expect(stored!.cells[1 * 6 + 5]).toBe(1);
  });

  it('1u toggleCell rejects changes that would create a hole', () => {
    const { result } = renderHook(() => useShapeSection());
    // Clearing a fully-interior grid square (col=1, row=1) would enclose
    // a void at the centre of the 3×3 bin — rejected by validateMask.
    act(() => result.current.handlers.toggleCell(1, 1));
    expect(result.current.state.isCustom).toBe(false);
  });

  it('coarse display hides half-bin detail while preserving stored data', () => {
    // Paint a single 0.5u cell clear with halfBinMode on.
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfBinMode: true },
    });
    const onHook = renderHook(() => useShapeSection());
    act(() => onHook.result.current.handlers.toggleCell(5, 0));
    const storedAfterFineEdit = useDesignerStore.getState().params.cellMask;
    expect(storedAfterFineEdit).toBeDefined();

    // Switch halfBinMode off. The stored mask keeps its 0.5u detail.
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfBinMode: false },
    });
    const offHook = renderHook(() => useShapeSection());
    const stored = useDesignerStore.getState().params.cellMask;
    expect(stored).toEqual(storedAfterFineEdit);
    // Coarse display marks the 1u cell empty because one sub-cell is cleared.
    expect(offHook.result.current.state.mask.cells[0 * 3 + 2]).toBe(0);
    // Other 1u cells are still filled.
    expect(offHook.result.current.state.mask.cells[0 * 3 + 0]).toBe(1);
  });
});
