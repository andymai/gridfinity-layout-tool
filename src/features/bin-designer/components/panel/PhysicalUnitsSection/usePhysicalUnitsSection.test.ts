import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhysicalUnitsSection } from './usePhysicalUnitsSection';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { CONSTRAINTS } from '@/core/constants';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { resetAllStores } from '@/test/testUtils';

describe('usePhysicalUnitsSection', () => {
  beforeEach(() => {
    resetAllStores();
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('returns grid and height unit values from layout store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.state.gridUnitMm).toBe(42);
    expect(result.current.state.heightUnitMm).toBe(7);
  });

  it('handleGridUnitChange updates layout store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleGridUnitChange(50);
    });

    expect(useLayoutStore.getState().layout.gridUnitMm).toBe(50);
  });

  it('handleGridUnitChange with a Y pitch stores the designer override', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleGridUnitChange(42, 40);
    });

    expect(useLayoutStore.getState().layout.gridUnitMm).toBe(42);
    expect(useDesignerStore.getState().params.gridUnitMmY).toBe(40);
  });

  it('handleGridUnitChange without Y clears the override (relinked)', () => {
    useDesignerStore.getState().setParam('gridUnitMmY', 40);
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleGridUnitChange(42);
    });

    expect(useDesignerStore.getState().params.gridUnitMmY).toBeUndefined();
  });

  it('handleGridUnitChange clamps the Y pitch', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleGridUnitChange(42, 999);
    });

    expect(useDesignerStore.getState().params.gridUnitMmY).toBe(200);
  });

  it('handleHeightUnitChange updates layout store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleHeightUnitChange(10);
    });

    expect(useLayoutStore.getState().layout.heightUnitMm).toBe(10);
  });

  it('summary shows both units', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.meta.summary).toBe('42mm grid, 7mm height');
  });

  it('returns print bed width and depth from settings store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.state.printBedSize).toBe(256);
    expect(result.current.state.printBedDepth).toBe(256);
  });

  it('printBedDepth falls back to printBedSize when unset (linked)', () => {
    useSettingsStore.getState().updateSettings({
      defaultPrintBedSize: 256,
      defaultPrintBedDepth: undefined,
    });
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.state.printBedDepth).toBe(256);
  });

  it('printBedDepth reflects independent depth when unlinked', () => {
    useSettingsStore.getState().updateSettings({
      defaultPrintBedSize: 256,
      defaultPrintBedDepth: 180,
    });
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.state.printBedSize).toBe(256);
    expect(result.current.state.printBedDepth).toBe(180);
  });

  it('handlePrintBedChange with single arg clears depth (linked)', () => {
    useSettingsStore.getState().updateSettings({ defaultPrintBedDepth: 180 });
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handlePrintBedChange(300);
    });

    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(300);
    expect(useSettingsStore.getState().settings.defaultPrintBedDepth).toBeUndefined();
  });

  it('handlePrintBedChange with both args stores independent depth', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handlePrintBedChange(300, 180);
    });

    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(300);
    expect(useSettingsStore.getState().settings.defaultPrintBedDepth).toBe(180);
  });

  it('handlePrintBedChange clamps both dimensions to valid range', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handlePrintBedChange(10, 99999);
    });
    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(
      CONSTRAINTS.PRINT_BED_MM_MIN
    );
    expect(useSettingsStore.getState().settings.defaultPrintBedDepth).toBe(
      CONSTRAINTS.PRINT_BED_MM_MAX
    );

    act(() => {
      result.current.handlers.handlePrintBedChange(1000);
    });
    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(1000);
    expect(useSettingsStore.getState().settings.defaultPrintBedDepth).toBeUndefined();
  });
});
