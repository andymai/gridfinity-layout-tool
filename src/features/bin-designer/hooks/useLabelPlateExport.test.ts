import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { useLabelPlateExport, snapTextDepthToLayers } from './useLabelPlateExport';

describe('snapTextDepthToLayers', () => {
  it('snaps to whole layer multiples within the 1-layer..0.4mm band', () => {
    expect(snapTextDepthToLayers(0.4, 0.2)).toBeCloseTo(0.4);
    expect(snapTextDepthToLayers(0.35, 0.2)).toBeCloseTo(0.4);
    expect(snapTextDepthToLayers(0.25, 0.2)).toBeCloseTo(0.2);
    expect(snapTextDepthToLayers(1.5, 0.2)).toBeCloseTo(0.4);
    expect(snapTextDepthToLayers(0.05, 0.2)).toBeCloseTo(0.2);
    expect(snapTextDepthToLayers(0.3, 0.28)).toBeCloseTo(0.28);
  });

  it('tolerates a non-finite layer height', () => {
    expect(snapTextDepthToLayers(0.4, Number.NaN)).toBeCloseTo(0.4);
    expect(snapTextDepthToLayers(0.9, 0)).toBeCloseTo(0.4);
  });
});

describe('useLabelPlateExport', () => {
  beforeEach(() => {
    useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS } });
  });

  it('derives no plates outside socket mode', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      },
    });
    const { result } = renderHook(() => useLabelPlateExport());
    expect(result.current.plates).toEqual([]);
  });

  it('derives one plate per socket with compartment text in socket mode', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 1,
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, mode: 'socket', depth: 14 },
        compartments: {
          ...DEFAULT_BIN_PARAMS.compartments,
          cols: 2,
          rows: 1,
          cells: [0, 1],
          compartmentTexts: ['SCREWS', 'BOLTS'],
        },
      },
    });
    const { result } = renderHook(() => useLabelPlateExport());
    expect(result.current.plates).toEqual([
      { compartmentId: 0, widthU: 1, text: 'SCREWS' },
      { compartmentId: 1, widthU: 1, text: 'BOLTS' },
    ]);
  });

  it('cannot export without an active bridge', () => {
    const { result } = renderHook(() => useLabelPlateExport());
    expect(result.current.canExport).toBe(false);
  });
});
