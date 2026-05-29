import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSplitOptionsSection } from './useSplitOptionsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';

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
        defaultHeightUnitMm: 7,
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
    expect(result.current.config).toEqual(DEFAULT_SPLIT_CONNECTOR_CONFIG);
  });

  it('toggleEnabled writes splitConnectors to store', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());

    act(() => {
      result.current.handlers.toggleEnabled();
    });

    expect(useDesignerStore.getState().params.splitConnectors?.enabled).toBe(false);
  });

  it('toggleWallConnector writes wallConnector to store', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());

    act(() => {
      result.current.handlers.toggleWallConnector();
    });

    expect(useDesignerStore.getState().params.splitConnectors?.wallConnector).toBe('key');
  });

  it('exposes splitViewMode from UI state', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.splitViewMode).toBe('exploded');
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

  it('returns splitAxis="width" when only width exceeds', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 3 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.splitAxis).toBe('width');
  });

  it('returns splitAxis="depth" when only depth exceeds', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 3, depth: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.splitAxis).toBe('depth');
  });

  it('returns splitAxis="both" when both exceed', () => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, width: 8, depth: 8 },
    });
    const { result } = renderHook(() => useSplitOptionsSection());
    expect(result.current.splitAxis).toBe('both');
  });
});
