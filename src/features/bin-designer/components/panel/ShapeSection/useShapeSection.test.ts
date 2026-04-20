import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useShapeSection } from './useShapeSection';

describe('useShapeSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 3 } });
  });

  it('exposes current cols/rows at half-bin resolution', () => {
    const { result } = renderHook(() => useShapeSection());
    expect(result.current.state.cols).toBe(6); // 3 grid units × 2
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

  it('toggleCell clears a filled cell (producing a valid partial mask)', () => {
    const { result } = renderHook(() => useShapeSection());
    // Clear bottom-right corner cell (col = cols-1, row = 0).
    act(() => result.current.handlers.toggleCell(5, 0));
    expect(result.current.state.isCustom).toBe(true);
    expect(result.current.state.mask.cells[0 * 6 + 5]).toBe(0);
  });

  it('toggleCell rejects changes that would create a hole', () => {
    const { result } = renderHook(() => useShapeSection());
    // Clearing a fully-interior cell would enclose an empty void -> rejected.
    act(() => result.current.handlers.toggleCell(3, 3));
    expect(result.current.state.isCustom).toBe(false);
  });
});
