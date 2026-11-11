import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncPhysicalUnits } from './useSyncPhysicalUnits';
import { useDesignerStore } from '../store';
import { _resetPendingMeshCache } from '../store/designer';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout } from '@/core/constants';
import { DEFAULT_BIN_PARAMS, DEFAULT_GENERATION_STATE } from '../constants';
import { lidTopAboveRimMm } from '@/shared/printSettings/assembledHeight';
import type { DesignId } from '@/core/types';
import type { BinParams, Cutout, SavedDesign } from '../types';

function savedDesign(params: Partial<BinParams>): SavedDesign {
  return {
    id: 'saved-elsewhere' as DesignId,
    name: 'Saved elsewhere',
    params: { ...DEFAULT_BIN_PARAMS, ...params },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exportFileNameConfig: null,
  };
}

describe('useSyncPhysicalUnits', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    _resetPendingMeshCache();
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
    useLayoutStore.setState({ layout: createDefaultLayout() });
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

  describe('a design opened after mount', () => {
    beforeEach(() => {
      useLayoutStore.getState().setGridUnitMm(40);
      useLayoutStore.getState().setHeightUnitMm(10);
      useLayoutStore.getState().setMagnetAnchor('center');
    });

    it("takes the layout's units, not the ones it was saved with", () => {
      renderHook(() => useSyncPhysicalUnits());

      act(() => {
        useDesignerStore
          .getState()
          .loadDesign(
            savedDesign({ width: 4, gridUnitMm: 42, heightUnitMm: 7, magnetAnchor: 'edge' })
          );
      });

      const { params } = useDesignerStore.getState();
      expect(params.width).toBe(4);
      expect(params.gridUnitMm).toBe(40);
      expect(params.heightUnitMm).toBe(10);
      expect(params.magnetAnchor).toBe('center');
    });

    it('regenerates once for the load and leaves no undo entry', () => {
      renderHook(() => useSyncPhysicalUnits());
      const epochBefore = useDesignerStore.getState().generation.epoch;

      act(() => {
        useDesignerStore.getState().loadDesign(savedDesign({ gridUnitMm: 42, heightUnitMm: 7 }));
      });

      expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
      expect(useDesignerStore.getState().history.past).toHaveLength(0);
    });

    // These two restore a version rather than load a design: `loadDesign` makes
    // a second store write, whose `set` re-derives the lid and the pockets on
    // its own. A restore is one write, so only the sync can re-derive them.
    it("keeps a unit-sized lid on the layout's unit line", () => {
      renderHook(() => useSyncPhysicalUnits());

      act(() => {
        useDesignerStore.getState().restoreVersion({
          name: 'v1',
          params: {
            ...DEFAULT_BIN_PARAMS,
            heightUnitMm: 7,
            lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, heightUnits: 2 },
          },
        });
      });

      expect(lidTopAboveRimMm(useDesignerStore.getState().params)).toBeCloseTo(2 * 10, 6);
    });

    // 3u at 10mm on a 4.75mm socket is 25.25mm of fill, so a floor 8mm above
    // the underside leaves 25.25 + 4.75 - 8 = 22mm. At the saved 7mm it was 13.
    it("resolves a floored pocket against the layout's height unit", () => {
      const pocket: Cutout = {
        id: 'p1',
        shape: 'rectangle',
        x: 10,
        y: 10,
        width: 20,
        depth: 15,
        cutDepth: 13,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
        depthMode: 'floor',
        floorMm: 8,
      };
      renderHook(() => useSyncPhysicalUnits());

      act(() => {
        useDesignerStore.getState().restoreVersion({
          name: 'v1',
          params: { ...DEFAULT_BIN_PARAMS, height: 3, heightUnitMm: 7, cutouts: [pocket] },
        });
      });

      expect(useDesignerStore.getState().params.cutouts[0]?.cutDepth).toBe(22);
    });

    it("gives a restored version the layout's units, and undo keeps them", () => {
      renderHook(() => useSyncPhysicalUnits());
      const widthBefore = useDesignerStore.getState().params.width;

      act(() => {
        useDesignerStore.getState().restoreVersion({
          name: 'v1',
          params: { ...DEFAULT_BIN_PARAMS, width: 4, gridUnitMm: 42, heightUnitMm: 7 },
        });
      });
      expect(useDesignerStore.getState().params.width).toBe(4);
      expect(useDesignerStore.getState().params.gridUnitMm).toBe(40);
      expect(useDesignerStore.getState().params.heightUnitMm).toBe(10);

      act(() => useDesignerStore.getState().undo());
      expect(useDesignerStore.getState().params.width).toBe(widthBefore);
      expect(useDesignerStore.getState().params.gridUnitMm).toBe(40);
    });
  });

  it('does not bring back old units when undo crosses a layout unit change', () => {
    renderHook(() => useSyncPhysicalUnits());
    useDesignerStore.getState().setGenerationResult({
      vertices: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
      edgeVertices: new Float32Array(0),
      error: null,
      timingMs: 100,
    });
    act(() => useDesignerStore.getState().setParam('width', 4));
    act(() => useLayoutStore.getState().setGridUnitMm(40));
    const epochBefore = useDesignerStore.getState().generation.epoch;

    act(() => useDesignerStore.getState().undo());

    // The entry's cached mesh was built at 42mm, so it must not stand in.
    expect(useDesignerStore.getState().params.width).toBe(DEFAULT_BIN_PARAMS.width);
    expect(useDesignerStore.getState().params.gridUnitMm).toBe(40);
    expect(useDesignerStore.getState().generation.epoch).toBe(epochBefore + 1);
  });

  describe('non-square grid', () => {
    it("follows the layout's Y pitch and drops it when the layout goes square", () => {
      renderHook(() => useSyncPhysicalUnits());

      act(() => useLayoutStore.getState().setGridUnitMmY(22));
      expect(useDesignerStore.getState().params.gridUnitMmY).toBe(22);

      act(() => useLayoutStore.getState().setGridUnitMmY(null));
      expect(useDesignerStore.getState().params.gridUnitMmY).toBeUndefined();
    });

    it('drops the Y pitch a design was saved with when the layout is square', () => {
      renderHook(() => useSyncPhysicalUnits());

      act(() => {
        useDesignerStore.getState().loadDesign(savedDesign({ gridUnitMmY: 30 }));
      });

      expect(useDesignerStore.getState().params.gridUnitMmY).toBeUndefined();
    });

    it("gives a square design the layout's Y pitch", () => {
      useLayoutStore.getState().setGridUnitMmY(22);
      renderHook(() => useSyncPhysicalUnits());

      act(() => {
        useDesignerStore.getState().loadDesign(savedDesign({ width: 4 }));
      });

      expect(useDesignerStore.getState().params.width).toBe(4);
      expect(useDesignerStore.getState().params.gridUnitMmY).toBe(22);
    });
  });
});
