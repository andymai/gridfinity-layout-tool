import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSelectedElement } from './useSelectedElement';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { createUniformGrid } from '@/features/bin-designer/utils/compartments';

/** 2×1 grid → compartments {0,1}, one eligible divider with key "0-1". */
function setGridParams(overrides: Partial<typeof DEFAULT_BIN_PARAMS> = {}): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      compartments: createUniformGrid(2, 1, 1.2),
      ...overrides,
    },
    ui: {
      ...useDesignerStore.getState().ui,
      selectedCompartmentId: null,
      selectedColorZone: null,
      selectedDividerKey: null,
    },
  });
}

describe('useSelectedElement', () => {
  beforeEach(() => {
    useSettingsStore.getState().updateSetting('angledDividersEnabled', false);
    setGridParams();
  });

  it('returns null when nothing is selected', () => {
    const { result } = renderHook(() => useSelectedElement());
    expect(result.current).toBeNull();
  });

  it('resolves a selected compartment that exists in the grid', () => {
    const { result } = renderHook(() => useSelectedElement());
    act(() => useDesignerStore.getState().setSelectedCompartmentId(1));
    expect(result.current).toEqual({ kind: 'compartment', id: 1 });
  });

  it('self-heals a compartment id that no longer exists', () => {
    const { result } = renderHook(() => useSelectedElement());
    act(() => useDesignerStore.getState().setSelectedCompartmentId(99));
    expect(result.current).toBeNull();
  });

  it('resolves a divider only when angled dividers are enabled', () => {
    const { result } = renderHook(() => useSelectedElement());
    act(() => useDesignerStore.getState().setSelectedDividerKey('0-1'));
    // Setting unavailable → arm self-heals to null.
    expect(result.current).toBeNull();

    act(() => useSettingsStore.getState().updateSetting('angledDividersEnabled', true));
    expect(result.current).toEqual({ kind: 'divider', key: '0-1' });
  });

  it('drops an invalid divider key even when angled dividers are on', () => {
    act(() => useSettingsStore.getState().updateSetting('angledDividersEnabled', true));
    const { result } = renderHook(() => useSelectedElement());
    act(() => useDesignerStore.getState().setSelectedDividerKey('5-6'));
    expect(result.current).toBeNull();
  });

  it('resolves a color zone only when multi-color is enabled and the zone is active', () => {
    const { result } = renderHook(() => useSelectedElement());
    act(() => useDesignerStore.getState().setSelectedColorZone('body'));
    // featureColors disabled by default → null.
    expect(result.current).toBeNull();

    act(() =>
      setGridParams({ featureColors: { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true } })
    );
    act(() => useDesignerStore.getState().setSelectedColorZone('body'));
    expect(result.current).toEqual({ kind: 'colorZone', zone: 'body' });
  });
});
