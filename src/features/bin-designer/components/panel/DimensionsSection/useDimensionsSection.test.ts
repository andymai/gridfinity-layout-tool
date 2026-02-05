import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDimensionsSection } from './useDimensionsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('useDimensionsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
  });

  it('returns current dimensions from store', () => {
    const { result } = renderHook(() => useDimensionsSection());

    expect(result.current.state.width).toBe(2);
    expect(result.current.state.depth).toBe(2);
    expect(result.current.state.height).toBe(3);
  });

  it('computes mm values correctly', () => {
    const { result } = renderHook(() => useDimensionsSection());

    // 2 × 42mm = 84mm, 3 × 7mm = 21mm
    expect(result.current.state.widthMm).toBe(84);
    expect(result.current.state.depthMm).toBe(84);
    expect(result.current.state.heightMm).toBe(21);
  });

  it('computes summary string', () => {
    const { result } = renderHook(() => useDimensionsSection());

    expect(result.current.meta.summary).toContain('2\u00d72');
    expect(result.current.meta.summary).toContain('3u');
    expect(result.current.meta.summary).toContain('84');
  });

  it('handleWidthStep increments correctly', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleWidthStep(1);
    });

    expect(useDesignerStore.getState().params.width).toBe(3);
  });

  it('handleSwapDimensions swaps width and depth', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 4 },
    });

    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleSwapDimensions();
    });

    expect(useDesignerStore.getState().params.width).toBe(4);
    expect(useDesignerStore.getState().params.depth).toBe(2);
  });

  it('uses 0.5 step in half-bin mode', () => {
    useDesignerStore.setState({
      ui: { ...DEFAULT_UI_STATE, halfBinMode: true },
    });

    const { result } = renderHook(() => useDimensionsSection());

    expect(result.current.state.dimensionStep).toBe(0.5);
    expect(result.current.state.minDimension).toBe(0.5);
  });

  it('clamps width to max dimension', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 16 },
    });

    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleWidthStep(1);
    });

    // Should stay at 16 (MAX_DIMENSION)
    expect(useDesignerStore.getState().params.width).toBe(16);
  });
});
