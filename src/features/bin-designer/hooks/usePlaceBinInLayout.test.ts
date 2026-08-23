import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { navigateToPlaceInLayout, usePlaceBinFromURL } from './usePlaceBinInLayout';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { designId, gridUnits, heightUnits } from '@/core/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { loadRegistry, upsertRegistryEntry } from '../store/customBinRegistry';
import type { SavedDesign } from '../types';

function makeDesign(overrides: Partial<SavedDesign> = {}): SavedDesign {
  return {
    id: designId('design-1'),
    name: 'My Design',
    params: { ...DEFAULT_BIN_PARAMS, width: 2, depth: 3, height: 4 },
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    exportFileNameConfig: null,
    ...overrides,
  };
}

describe('navigateToPlaceInLayout', () => {
  let originalPathname: string;

  beforeEach(() => {
    localStorage.clear();
    originalPathname = window.location.pathname + window.location.search;
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  it('sets URL with placeBin, binName and placeDesignId params', () => {
    navigateToPlaceInLayout(makeDesign());
    expect(window.location.search).toContain('placeBin=2x3x4');
    expect(window.location.search).toContain('binName=My+Design');
    expect(window.location.search).toContain('placeDesignId=design-1');
  });

  it('navigates to root path', () => {
    window.history.replaceState(null, '', '/designer');
    navigateToPlaceInLayout(makeDesign());
    expect(window.location.pathname).toBe('/');
  });

  it('dispatches popstate event for routing sync', () => {
    const listener = vi.fn();
    window.addEventListener('popstate', listener);
    navigateToPlaceInLayout(makeDesign());
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('popstate', listener);
  });

  it('registers an imported-mesh design in the custom-bin registry', () => {
    const imported = makeDesign({
      id: designId('mesh-1'),
      name: 'Scanned Tray',
      params: undefined,
      kind: 'importedMesh',
      envelope: {
        width: 3,
        depth: 2,
        gridUnitMm: 42,
        heightUnitMm: 7,
      } as unknown as SavedDesign['envelope'],
      structure: { kind: 'importedMesh', heightUnits: 5 } as unknown as SavedDesign['structure'],
    });
    navigateToPlaceInLayout(imported);
    const ref = loadRegistry().find((r) => r.id === 'mesh-1');
    expect(ref?.kind).toBe('importedMesh');
    expect(ref).toMatchObject({ width: 3, depth: 2, height: 5 });
    expect(window.location.search).toContain('placeDesignId=mesh-1');
  });

  it('registers an assembly design with rise and lip fields', () => {
    const assembly = makeDesign({
      id: designId('asm-1'),
      name: 'Pliers Rack',
      params: undefined,
      kind: 'assembly',
      envelope: {
        width: 2,
        depth: 2,
        gridUnitMm: 42,
        heightUnitMm: 7,
      } as unknown as SavedDesign['envelope'],
      structure: {
        kind: 'assembly',
        schemaVersion: 1,
        base: { floorThickness: 2 },
        mirrorAxis: 'x',
        parts: [],
      } as unknown as SavedDesign['structure'],
    });
    navigateToPlaceInLayout(assembly);
    const ref = loadRegistry().find((r) => r.id === 'asm-1');
    expect(ref?.kind).toBe('assembly');
    expect(ref).toMatchObject({ width: 2, depth: 2, socketless: false, hasLip: false });
    expect(ref?.assembledRiseMm).toBeGreaterThan(0);
    expect(window.location.search).toContain('placeDesignId=asm-1');
  });

  it('registers a bin design in the custom-bin registry', () => {
    navigateToPlaceInLayout(makeDesign());
    const ref = loadRegistry().find((r) => r.id === 'design-1');
    expect(ref).toBeDefined();
    expect(ref?.width).toBe(2);
    expect(ref?.depth).toBe(3);
    expect(ref?.height).toBe(4);
  });
});

describe('usePlaceBinFromURL', () => {
  let originalPathname: string;

  beforeEach(() => {
    localStorage.clear();
    originalPathname = window.location.pathname + window.location.search;
    const state = useLayoutStore.getState();
    const layerId = state.layout.layers[0]?.id ?? 'test-layer';
    useLayoutStore.setState({
      layout: {
        ...state.layout,
        bins: [],
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
        layers: [{ id: layerId, name: 'Layer 1', height: heightUnits(3) }],
      },
    });
    useSelectionStore.setState({ selectedBinIds: [], activeLayerId: layerId });
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  it('does nothing when no placeBin param present', () => {
    window.history.replaceState(null, '', '/');
    const binsBefore = useLayoutStore.getState().layout.bins.length;
    renderHook(() => usePlaceBinFromURL());
    expect(useLayoutStore.getState().layout.bins.length).toBe(binsBefore);
  });

  it('places bin with parsed dimensions from URL', () => {
    window.history.replaceState(null, '', '/?placeBin=3x2x3');
    const binsBefore = useLayoutStore.getState().layout.bins.length;
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    expect(bins.length).toBe(binsBefore + 1);
    const placed = bins[bins.length - 1];
    expect(placed.width).toBe(3);
    expect(placed.depth).toBe(2);
    expect(placed.height).toBe(3);
    expect(placed.linkedDesignId).toBeUndefined();
  });

  it('sets label from binName param', () => {
    window.history.replaceState(null, '', '/?placeBin=2x2x3&binName=Custom%20Bin');
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins[bins.length - 1];
    expect(placed.label).toBe('Custom Bin');
  });

  it('cleans URL after placement', () => {
    window.history.replaceState(null, '', '/?placeBin=2x2x3&binName=Test&placeDesignId=design-1');
    renderHook(() => usePlaceBinFromURL());
    expect(window.location.search).not.toContain('placeBin');
    expect(window.location.search).not.toContain('binName');
    expect(window.location.search).not.toContain('placeDesignId');
  });

  it('selects the placed bin', () => {
    window.history.replaceState(null, '', '/?placeBin=2x2x3');
    renderHook(() => usePlaceBinFromURL());
    const selected = useSelectionStore.getState().selectedBinIds;
    expect(selected).toHaveLength(1);
  });

  it('shows success toast after placement', () => {
    window.history.replaceState(null, '', '/?placeBin=2x2x3&binName=My%20Bin');
    renderHook(() => usePlaceBinFromURL());
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.message.includes('My Bin'))).toBe(true);
  });

  it('ignores invalid dimensions', () => {
    window.history.replaceState(null, '', '/?placeBin=invalid');
    const binsBefore = useLayoutStore.getState().layout.bins.length;
    renderHook(() => usePlaceBinFromURL());
    expect(useLayoutStore.getState().layout.bins.length).toBe(binsBefore);
  });

  it('ignores negative dimensions', () => {
    window.history.replaceState(null, '', '/?placeBin=-1x2x3');
    const binsBefore = useLayoutStore.getState().layout.bins.length;
    renderHook(() => usePlaceBinFromURL());
    expect(useLayoutStore.getState().layout.bins.length).toBe(binsBefore);
  });

  it('links the placed bin when placeDesignId resolves in the registry', () => {
    upsertRegistryEntry({
      id: designId('design-1'),
      name: 'Screw Bin',
      width: 2,
      depth: 3,
      height: 4,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    window.history.replaceState(
      null,
      '',
      '/?placeBin=2x3x4&binName=Screw+Bin&placeDesignId=design-1'
    );
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins[bins.length - 1];
    expect(placed.linkedDesignId).toBe('design-1');
  });

  it('uses registry dimensions over stale URL dimensions', () => {
    upsertRegistryEntry({
      id: designId('design-1'),
      name: 'Screw Bin',
      width: 4,
      depth: 2,
      height: 6,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    window.history.replaceState(null, '', '/?placeBin=2x3x4&placeDesignId=design-1');
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins[bins.length - 1];
    expect(placed.width).toBe(4);
    expect(placed.depth).toBe(2);
    expect(placed.height).toBe(6);
  });

  it('places unlinked with URL dimensions when placeDesignId is unknown', () => {
    window.history.replaceState(null, '', '/?placeBin=2x3x4&placeDesignId=missing');
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins[bins.length - 1];
    expect(placed.linkedDesignId).toBeUndefined();
    expect(placed.width).toBe(2);
    expect(placed.depth).toBe(3);
  });

  it('places on popstate after mount (in-app navigation from the designer)', () => {
    window.history.replaceState(null, '', '/');
    renderHook(() => usePlaceBinFromURL());
    expect(useLayoutStore.getState().layout.bins.length).toBe(0);

    act(() => {
      window.history.pushState(null, '', '/?placeBin=2x2x3&binName=Popstate+Bin');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    const bins = useLayoutStore.getState().layout.bins;
    expect(bins.length).toBe(1);
    expect(bins[0].label).toBe('Popstate Bin');
    expect(window.location.search).not.toContain('placeBin');
  });

  it('rotates the footprint when only the swapped orientation fits', () => {
    const state = useLayoutStore.getState();
    useLayoutStore.setState({
      layout: {
        ...state.layout,
        drawer: { width: gridUnits(2), depth: gridUnits(5), height: heightUnits(12) },
      },
    });
    window.history.replaceState(null, '', '/?placeBin=5x2x3');
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    expect(bins.length).toBe(1);
    expect(bins[0].width).toBe(2);
    expect(bins[0].depth).toBe(5);
    expect(bins[0].layerId).not.toBe('__staging__');
  });

  it('falls back to staging when grid placement fails', () => {
    const state = useLayoutStore.getState();
    useLayoutStore.setState({
      layout: {
        ...state.layout,
        drawer: { width: gridUnits(1), depth: gridUnits(1), height: heightUnits(10) },
      },
    });

    window.history.replaceState(null, '', '/?placeBin=5x5x3&binName=Big%20Bin');
    renderHook(() => usePlaceBinFromURL());

    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins.find((b) => b.label === 'Big Bin');
    expect(placed).toBeDefined();
    expect(placed?.layerId).toBe('__staging__');
  });
});
