import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhysicalUnitsSection } from './usePhysicalUnitsSection';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';

describe('usePhysicalUnitsSection', () => {
  beforeEach(() => {
    resetAllStores();
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
      result.current.handlers.handlePrintBedChange(10, 999);
    });
    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(42);
    expect(useSettingsStore.getState().settings.defaultPrintBedDepth).toBe(500);

    act(() => {
      result.current.handlers.handlePrintBedChange(999);
    });
    expect(useSettingsStore.getState().settings.defaultPrintBedSize).toBe(500);
    expect(useSettingsStore.getState().settings.defaultPrintBedDepth).toBeUndefined();
  });
});
