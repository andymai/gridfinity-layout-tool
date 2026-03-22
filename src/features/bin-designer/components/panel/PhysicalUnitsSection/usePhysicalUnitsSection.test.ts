import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhysicalUnitsSection } from './usePhysicalUnitsSection';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';

describe('usePhysicalUnitsSection', () => {
  beforeEach(() => {
    // Reset layout store to defaults (gridUnitMm: 42, heightUnitMm: 7)
    const state = useLayoutStore.getState();
    state.setGridUnitMm(42);
    state.setHeightUnitMm(7);
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
