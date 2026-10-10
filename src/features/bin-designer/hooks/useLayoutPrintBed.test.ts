import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { useLayoutPrintBed } from './useLayoutPrintBed';

describe('useLayoutPrintBed', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it("reads the layout's bed, not the default for new layouts", () => {
    useSettingsStore.getState().updateSettings({ defaultPrintBedSize: 256 });
    useLayoutStore.getState().setPrintBedSize(220);

    const { result } = renderHook(() => useLayoutPrintBed());

    expect(result.current).toEqual({ printBedSize: 220, printBedDepth: undefined });
  });

  it('carries an independent depth', () => {
    useLayoutStore.getState().setPrintBedSize(256, 180);

    const { result } = renderHook(() => useLayoutPrintBed());

    expect(result.current).toEqual({ printBedSize: 256, printBedDepth: 180 });
  });
});
