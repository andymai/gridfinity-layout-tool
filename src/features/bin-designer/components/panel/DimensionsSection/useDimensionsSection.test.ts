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
      ui: { ...DEFAULT_UI_STATE, halfGridMode: true },
    });

    const { result } = renderHook(() => useDimensionsSection());

    expect(result.current.state.dimensionStep).toBe(0.5);
    // Both dimensions are 2 (≥1), so min can be 0.5 for either
    expect(result.current.state.minWidth).toBe(0.5);
    expect(result.current.state.minDepth).toBe(0.5);
  });

  it('prevents 0.5×0.5 footprint in half-bin mode', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 0.5, depth: 2 },
      ui: { ...DEFAULT_UI_STATE, halfGridMode: true },
    });

    const { result } = renderHook(() => useDimensionsSection());

    // Width is 0.5, so depth min must be 1
    expect(result.current.state.minWidth).toBe(0.5);
    expect(result.current.state.minDepth).toBe(1);
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

    expect(useDesignerStore.getState().ui.halfGridMode).toBe(true);
    expect(useDesignerStore.getState().params.width).toBe(1.5);
  });

  it('auto-enables half-bin mode when depth is set to a fractional value', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('depth', 2.5);
    });

    expect(useDesignerStore.getState().ui.halfGridMode).toBe(true);
    expect(useDesignerStore.getState().params.depth).toBe(2.5);
  });

  it('does not toggle half-bin mode when an integer value is set', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('width', 3);
    });

    expect(useDesignerStore.getState().ui.halfGridMode).toBe(false);
    expect(useDesignerStore.getState().params.width).toBe(3);
  });

  it('does not double-toggle half-bin mode when already enabled', () => {
    useDesignerStore.setState({
      ui: { ...DEFAULT_UI_STATE, halfGridMode: true },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.setParam('width', 1.5);
    });

    // Should still be enabled (not toggled off)
    expect(useDesignerStore.getState().ui.halfGridMode).toBe(true);
    expect(useDesignerStore.getState().params.width).toBe(1.5);
  });

  it('flags fractional dimensions so the edge toggles can show', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2.5, depth: 2 },
    });
    const { result } = renderHook(() => useDimensionsSection());

    expect(result.current.state.hasFractionalWidth).toBe(true);
    expect(result.current.state.hasFractionalDepth).toBe(false);
  });

  it('hides the edge toggles in half-sockets mode (uniform half feet)', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2.5,
        depth: 1.5,
        base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      },
    });
    const { result } = renderHook(() => useDimensionsSection());

    expect(result.current.state.hasFractionalWidth).toBe(false);
    expect(result.current.state.hasFractionalDepth).toBe(false);
  });

  it('swaps the fractional edge with its axis when dimensions are swapped', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2.5,
        depth: 1,
        fractionalEdgeX: 'start',
        fractionalEdgeY: 'end',
      },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleSwapDimensions();
    });

    const params = useDesignerStore.getState().params;
    expect(params.width).toBe(1);
    expect(params.depth).toBe(2.5);
    // The 'start' preference followed width → depth.
    expect(params.fractionalEdgeX).toBe('end');
    expect(params.fractionalEdgeY).toBe('start');
  });

  it('exposes the exterior-wall collar, defaulting a legacy-absent value to 0', () => {
    useDesignerStore.setState({
      // Simulate a legacy design that predates the field.
      params: { ...DEFAULT_BIN_PARAMS, extraWallHeightMm: undefined },
    });
    const { result } = renderHook(() => useDimensionsSection());
    expect(result.current.state.extraWallHeightMm).toBe(0);
  });

  it('handleExtraWallHeightStep increments the collar', () => {
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleExtraWallHeightStep(5);
    });
    expect(useDesignerStore.getState().params.extraWallHeightMm).toBe(5);
  });

  it('handleExtraWallHeightStep clamps the collar at the 100mm max', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, extraWallHeightMm: 100 },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleExtraWallHeightStep(1);
    });
    expect(useDesignerStore.getState().params.extraWallHeightMm).toBe(100);
  });

  it('handleExtraWallHeightStep clamps the collar at the 0mm min', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, extraWallHeightMm: 2 },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleExtraWallHeightStep(-999);
    });
    expect(useDesignerStore.getState().params.extraWallHeightMm).toBe(0);
  });

  it('handleFractionalEdgeChange writes the chosen edge to the store', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2.5 },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleFractionalEdgeChange('x', 'start');
    });
    expect(useDesignerStore.getState().params.fractionalEdgeX).toBe('start');

    act(() => {
      result.current.handlers.handleFractionalEdgeChange('y', 'start');
    });
    expect(useDesignerStore.getState().params.fractionalEdgeY).toBe('start');
  });

  it('handleFractionalEdgeChange marks the edge as manually chosen', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 2.5, fractionalEdgeManualX: false },
    });
    const { result } = renderHook(() => useDimensionsSection());

    act(() => {
      result.current.handlers.handleFractionalEdgeChange('x', 'start');
    });

    expect(useDesignerStore.getState().params.fractionalEdgeManualX).toBe(true);
  });
});
