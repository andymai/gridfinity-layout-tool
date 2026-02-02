import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhysicalUnitsSection } from './usePhysicalUnitsSection';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';

describe('usePhysicalUnitsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
    });
  });

  it('returns grid and height unit values', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.state.gridUnitMm).toBe(42);
    expect(result.current.state.heightUnitMm).toBe(7);
  });

  it('handleGridUnitChange updates store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleGridUnitChange(50);
    });

    expect(useDesignerStore.getState().params.gridUnitMm).toBe(50);
  });

  it('handleHeightUnitChange updates store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handleHeightUnitChange(10);
    });

    expect(useDesignerStore.getState().params.heightUnitMm).toBe(10);
  });

  it('summary shows both units', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.meta.summary).toBe('42mm grid, 7mm height');
  });

  it('returns print bed size from settings store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    expect(result.current.state.printBedSize).toBe(256);
  });

  it('handlePrintBedChange updates settings store', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handlePrintBedChange(300);
    });

    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(300);
  });

  it('handlePrintBedChange clamps to valid range', () => {
    const { result } = renderHook(() => usePhysicalUnitsSection());

    act(() => {
      result.current.handlers.handlePrintBedChange(10);
    });
    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(42);

    act(() => {
      result.current.handlers.handlePrintBedChange(999);
    });
    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(500);
  });
});
