import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
} from '@/features/bin-designer/types';
import type { Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { useKnifeRestSection } from './useKnifeRestSection';

const CHEF: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
  openEnd: 'end',
};

const KNIFE_SLOT: Cutout = {
  id: 'k1',
  shape: 'knifeSlot',
  x: 20,
  y: 16,
  width: 215,
  depth: 3.8,
  cutDepth: 51,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  knife: CHEF,
};

function setParams(over: Partial<typeof DEFAULT_BIN_PARAMS> = {}): void {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 1,
      height: 8,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [KNIFE_SLOT],
      ...over,
    },
  });
}

beforeEach(() => setParams());

describe('useKnifeRestSection', () => {
  it('offers the feature while it is still off — the probe runs with it on', () => {
    const { result } = renderHook(() => useKnifeRestSection());
    expect(result.current.state.enabled).toBe(false);
    expect(result.current.meta.disabledReason).toBeUndefined();
  });

  it('blocks a design with no open-ended knife slot', () => {
    setParams({ cutouts: [] });
    const { result } = renderHook(() => useKnifeRestSection());
    expect(result.current.meta.disabledReason).toBeTruthy();
  });

  it('blocks a non-solid bin, which has no fill for a slot to cut into', () => {
    setParams({ base: { ...DEFAULT_BIN_PARAMS.base, solid: false } });
    const { result } = renderHook(() => useKnifeRestSection());
    expect(result.current.meta.disabledReason).toBeTruthy();
  });

  it('resolves the absent fields to the same defaults the plan uses', () => {
    setParams({ knifeRest: { enabled: true } });
    const { result } = renderHook(() => useKnifeRestSection());
    expect(result.current.state.style).toBe('companion');
    expect(result.current.state.gapMm).toBe(KNIFE_REST_DEFAULT_GAP_MM);
    expect(result.current.state.depthU).toBe(1);
    expect(result.current.state.grooveDepthMm).toBe(KNIFE_REST_GROOVE_DEPTH_MM);
  });

  it('writes each field without dropping the others', () => {
    const { result } = renderHook(() => useKnifeRestSection());
    act(() => result.current.handlers.toggle());
    act(() => result.current.handlers.setDepthU(2));
    act(() => result.current.handlers.setGrooveDepthMm(9));
    expect(useDesignerStore.getState().params.knifeRest).toEqual({
      enabled: true,
      depthU: 2,
      grooveDepthMm: 9,
    });
  });

  it('summarises only while enabled', () => {
    const { result, rerender } = renderHook(() => useKnifeRestSection());
    expect(result.current.meta.summary).toBeUndefined();
    act(() => result.current.handlers.toggle());
    rerender();
    expect(result.current.meta.summary).toBeTruthy();
  });
});
