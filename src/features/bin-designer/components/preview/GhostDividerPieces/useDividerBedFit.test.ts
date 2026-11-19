import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store';
import { resetAllStores } from '@/test/testUtils';
import { useDividerBedFit } from './useDividerBedFit';

function setBed(size: number): void {
  const { layout } = useLayoutStore.getState();
  useLayoutStore.setState({
    layout: { ...layout, printBedSize: size as never, printBedDepth: undefined },
  });
}

describe('useDividerBedFit', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('gives the bed and nozzle when the export splits the bin', () => {
    setBed(200);
    const nozzle = useSettingsStore.getState().settings.printSettings.nozzleSizeMm;
    const { result } = renderHook(() => useDividerBedFit());
    act(() => useDesignerStore.getState().setParams({ width: 7, depth: 1 }));
    expect(result.current).toEqual({
      printBed: { widthMm: 200, depthMm: 200 },
      nozzleSizeMm: nozzle,
    });
  });

  it('gives nothing when the bin prints whole', () => {
    setBed(200);
    const { result } = renderHook(() => useDividerBedFit());
    act(() => useDesignerStore.getState().setParams({ width: 2, depth: 2 }));
    expect(result.current).toBeUndefined();
  });
});
