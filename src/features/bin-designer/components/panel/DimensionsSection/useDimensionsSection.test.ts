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

  it('auto-enables half-bin mode when width is set to a fractional value', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('width', 1.5);
    });

    expect(useDesignerStore.getState().ui.halfBinMode).toBe(true);
    expect(useDesignerStore.getState().params.width).toBe(1.5);
  });

  it('auto-enables half-bin mode when depth is set to a fractional value', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('depth', 2.5);
    });

    expect(useDesignerStore.getState().ui.halfBinMode).toBe(true);
    expect(useDesignerStore.getState().params.depth).toBe(2.5);
  });

  it('does not toggle half-bin mode when an integer value is set', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('width', 3);
    });

    expect(useDesignerStore.getState().ui.halfBinMode).toBe(false);
    expect(useDesignerStore.getState().params.width).toBe(3);
  });

  it('does not double-toggle half-bin mode when already enabled', () => {
    useDesignerStore.setState({
      ui: { ...DEFAULT_UI_STATE, halfBinMode: true },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('width', 1.5);
    });

    // Should still be enabled (not toggled off)
    expect(useDesignerStore.getState().ui.halfBinMode).toBe(true);
    expect(useDesignerStore.getState().params.width).toBe(1.5);
  });
});
