import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncPhysicalUnits } from './useSyncPhysicalUnits';
import { useDesignerStore } from '../store';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '../constants';
import { lidTopAboveRimMm } from '@/shared/printSettings/assembledHeight';

describe('useSyncPhysicalUnits', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS },
      generation: {
        ...DEFAULT_GENERATION_STATE,
        status: 'idle',
        mesh: null,
        progress: 0,
        epoch: 0,
      },
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

  it('keeps a lid sized in units on its unit line when the height unit changes', () => {
    useDesignerStore.setState((state) => ({
      params: { ...state.params, lid: { ...state.params.lid, enabled: true, heightUnits: 1 } },
    }));
    renderHook(() => useSyncPhysicalUnits());

    act(() => {
      useLayoutStore.getState().setHeightUnitMm(10);
    });

    const { params } = useDesignerStore.getState();
    expect(lidTopAboveRimMm(params)).toBeCloseTo(10, 6);
  });

  it('does not push undo history', () => {
    renderHook(() => useSyncPhysicalUnits());

    act(() => {
      useLayoutStore.getState().setGridUnitMm(50);
    });

    // Sync should NOT create undo history entries
    expect(useDesignerStore.getState().history.past).toHaveLength(0);
  });

  describe('low-profile base', () => {
    const setLayoutLowProfile = (enabled: boolean): void => {
      useLayoutStore.setState((state) => {
        const { lowProfileBase: _drop, ...layout } = state.layout;
        return { layout: enabled ? { ...layout, lowProfileBase: true } : layout };
      });
    };

    beforeEach(() => setLayoutLowProfile(false));

    it('keeps a unit-sized lid when the profile and height unit change together', () => {
      useLayoutStore.getState().setHeightUnitMm(9);
      useDesignerStore.setState((state) => ({
        params: {
          ...state.params,
          heightUnitMm: 9,
          lid: { ...state.params.lid, enabled: true, stackableTop: true, heightUnits: 12 },
        },
      }));
      renderHook(() => useSyncPhysicalUnits());

      act(() => {
        setLayoutLowProfile(true);
        useLayoutStore.getState().setHeightUnitMm(7);
      });

      const { params } = useDesignerStore.getState();
      expect(params.lid.heightUnits).toBe(12);
      expect(lidTopAboveRimMm(params)).toBeCloseTo(12 * 7, 6);
    });

    it('marks the open design low profile when the layout turns it on', () => {
      renderHook(() => useSyncPhysicalUnits());
      act(() => setLayoutLowProfile(true));
      expect(useDesignerStore.getState().params.base.lowProfile).toBe(true);
    });

    it('clears it when the layout turns it off', () => {
      renderHook(() => useSyncPhysicalUnits());
      act(() => setLayoutLowProfile(true));
      expect(useDesignerStore.getState().params.base.lowProfile).toBe(true);
      act(() => setLayoutLowProfile(false));
      expect('lowProfile' in useDesignerStore.getState().params.base).toBe(false);
    });

    it('re-applies the layout setting to a design opened afterwards', () => {
      setLayoutLowProfile(true);
      renderHook(() => useSyncPhysicalUnits());
      act(() => {
        useDesignerStore.setState({ params: { ...DEFAULT_BIN_PARAMS, width: 3 } });
      });
      const { params } = useDesignerStore.getState();
      expect(params.width).toBe(3);
      expect(params.base.lowProfile).toBe(true);
    });
  });
});
