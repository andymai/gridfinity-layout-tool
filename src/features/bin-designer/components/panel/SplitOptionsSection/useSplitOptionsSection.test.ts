import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSplitOptionsSection } from './useSplitOptionsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';

describe('useSplitOptionsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      ui: { ...DEFAULT_UI_STATE },
    });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        defaultPrintBedSize: 256,
        defaultGridUnitMm: 42,
      },
    });
  });

  it('reports needsSplit=false for small bin', () => {
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.needsSplit).toBe(false);
    expect(result.current.pieceCount).toBe(1);
  });

  it('reports needsSplit=true for oversized bin', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.needsSplit).toBe(true);
    expect(result.current.pieceCount).toBe(2);
  });

  it('uses DEFAULT_SPLIT_CONNECTOR_CONFIG when params.splitConnectors is undefined', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.config.enabled).toBe(true);
    expect(result.current.config.clearance).toBe(0.1);
    expect(result.current.config.pinDiameter).toBe(2.5);
  });

  it('toggleEnabled writes splitConnectors to store', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());

    act(() => {
      result.current.handlers.toggleEnabled();
    });

    const state = useDesignerStore.getState();
    expect(state.params.splitConnectors?.enabled).toBe(false);
  });

  it('setClearance updates clearance value', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());

    act(() => {
      result.current.handlers.setClearance(0.2);
    });

    const state = useDesignerStore.getState();
    expect(state.params.splitConnectors?.clearance).toBe(0.2);
  });

  it('exposes splitViewMode from UI state', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.splitViewMode).toBe('exploded'); // default
  });

  it('setSplitViewMode updates UI state', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());

    act(() => {
      result.current.handlers.setSplitViewMode('assembled');
    });

    expect(useDesignerStore.getState().ui.splitViewMode).toBe('assembled');
  });
});
