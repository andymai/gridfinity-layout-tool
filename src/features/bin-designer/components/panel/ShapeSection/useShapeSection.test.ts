import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { useShapeSection } from './useShapeSection';

describe('useShapeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 3 },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('exposes cols/rows at 1u resolution when halfGridMode is off', () => {
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.cols).toBe(3);
    expect(result.current.state.rows).toBe(3);
  });

  it('exposes cols/rows at 0.5u resolution when halfGridMode is on', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfGridMode: true },
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

  it('toggleEditingEnabled opens the editor without painting a mask', () => {
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.editingEnabled).toBe(false);
    act(() => result.current.handlers.toggleEditingEnabled());
    expect(result.current.state.editingEnabled).toBe(true);
    // No painting yet — stays on the rectangle fast path.
    expect(result.current.state.isCustom).toBe(false);
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(true);
  });

  it('toggleEditingEnabled clears the mask and closes the editor when turning off', () => {
    const { result } = renderHook(() => useShapeSection());
    act(() => result.current.handlers.applyPreset('l'));
    expect(result.current.state.isCustom).toBe(true);
    act(() => result.current.handlers.toggleEditingEnabled());
    expect(result.current.state.editingEnabled).toBe(false);
    expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    expect(useDesignerStore.getState().ui.shapeEditorOpen).toBe(false);
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

  it('0.5u toggleCell (halfGridMode on) flips a single sub-cell', () => {
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfGridMode: true },
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

  it('1u toggleCell clearing the centre produces a valid O-shape (ring)', () => {
    const { result } = renderHook(() => useShapeSection());
    // Clearing a fully-interior grid square (col=1, row=1) encloses a
    // void at the centre of the 3×3 bin. Holes are valid — the filled
    // region remains 4-connected and the generator handles inner loops.
    act(() => result.current.handlers.toggleCell(1, 1));
    expect(result.current.state.isCustom).toBe(true);
    const stored = useDesignerStore.getState().params.cellMask;
    expect(stored).toBeDefined();
    // Centre 1u block (all four half-bin sub-cells at col 2-3, row 2-3) cleared.
    expect(stored!.cells[2 * 6 + 2]).toBe(0);
    expect(stored!.cells[2 * 6 + 3]).toBe(0);
    expect(stored!.cells[3 * 6 + 2]).toBe(0);
    expect(stored!.cells[3 * 6 + 3]).toBe(0);
  });

  it('falls back to half-bin display when bin dims are odd (fractional-size bins)', () => {
    // A 1.5×1.5 bin has a 3×3 mask — can't be cleanly grouped into 1u
    // squares. With halfGridMode off, the UI should still render at 0.5u
    // granularity instead of throwing a RangeError inside coarsenToGridUnits.
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 1.5, depth: 1.5 },
      ui: { ...useDesignerStore.getState().ui, halfGridMode: false },
    });
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.cols).toBe(3);
    expect(result.current.state.rows).toBe(3);
    // Toggling a cell at 0.5u-granularity coords must not throw either.
    expect(() => {
      act(() => result.current.handlers.toggleCell(2, 0));
    }).not.toThrow();
  });

  it('coarse display hides half-bin detail while preserving stored data', () => {
    // Paint a single 0.5u cell clear with halfGridMode on.
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfGridMode: true },
    });
    const onHook = renderHook(() => useShapeSection());
    act(() => onHook.result.current.handlers.toggleCell(5, 0));
    const storedAfterFineEdit = useDesignerStore.getState().params.cellMask;
    expect(storedAfterFineEdit).toBeDefined();

    // Switch halfGridMode off. The stored mask keeps its 0.5u detail.
    useDesignerStore.setState({
      ui: { ...useDesignerStore.getState().ui, halfGridMode: false },
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
