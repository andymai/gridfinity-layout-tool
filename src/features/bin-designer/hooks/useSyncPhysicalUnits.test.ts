import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncPhysicalUnits } from './useSyncPhysicalUnits';
import { useDesignerStore } from '../store';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BIN_PARAMS } from '../constants';

describe('useSyncPhysicalUnits', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      generation: { status: 'idle', mesh: null, progress: 0, epoch: 0 },
    });
    useLayoutStore.getState().setGridUnitMm(42);
    useLayoutStore.getState().setHeightUnitMm(7);
  });

  it('skips update when values already match', () => {
    const epochBefore = useDesignerStore.getState().generation.epoch;

    renderHook(() => useSyncPhysicalUnits());

    // Epoch should NOT increment when layout and designer already agree
    expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore);
  });

  it('syncs gridUnitMm from layout store and increments epoch', () => {
    renderHook(() => useSyncPhysicalUnits());

    const epochBefore = useDesignerStore.getState().generation.epoch;

    act(() => {
      useLayoutStore.getState().setGridUnitMm(50);
    });

    expect(useDesignerStore.getState().params.gridUnitMm).toBe(50);
    expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
  });

  it('syncs heightUnitMm from layout store and increments epoch', () => {
    renderHook(() => useSyncPhysicalUnits());

    const epochBefore = useDesignerStore.getState().generation.epoch;

    act(() => {
      useLayoutStore.getState().setHeightUnitMm(10);
    });

    expect(useDesignerStore.getState().params.heightUnitMm).toBe(10);
    expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
  });

  it('does not push undo history', () => {
    renderHook(() => useSyncPhysicalUnits());

    act(() => {
      useLayoutStore.getState().setGridUnitMm(50);
    });

    // Sync should NOT create undo history entries
    expect(useDesignerStore.getState().history.past).toHaveLength(0);
  });
});
