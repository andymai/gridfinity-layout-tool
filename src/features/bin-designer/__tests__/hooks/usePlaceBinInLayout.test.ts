import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { navigateToPlaceInLayout, usePlaceBinFromURL } from '../../hooks/usePlaceBinInLayout';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';

describe('navigateToPlaceInLayout', () => {
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = window.location.pathname + window.location.search;
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalPathname);
  });

  it('sets URL with placeBin param', () => {
    navigateToPlaceInLayout(2, 3, 4);
    expect(window.location.search).toContain('placeBin=2x3x4');
  });

  it('includes bin name when provided', () => {
    navigateToPlaceInLayout(2, 3, 4, 'My Bin');
    expect(window.location.search).toContain('binName=My+Bin');
  });

  it('navigates to root path', () => {
    window.history.replaceState(null, '', '/designer');
    navigateToPlaceInLayout(2, 3, 4);
    expect(window.location.pathname).toBe('/');
  });

  it('dispatches popstate event for routing sync', () => {
    const listener = vi.fn();
    window.addEventListener('popstate', listener);
    navigateToPlaceInLayout(2, 3, 4);
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('popstate', listener);
  });
});

describe('usePlaceBinFromURL', () => {
  let originalPathname: string;

  beforeEach(() => {
    originalPathname = window.location.pathname + window.location.search;
    // Reset layout state: clear bins, ensure valid layer exists
    const state = useLayoutStore.getState();
    const layerId = state.layout.layers[0]?.id ?? 'test-layer';
    useLayoutStore.setState({
      layout: {
        ...state.layout,
        bins: [],
        drawer: { width: 10, depth: 8, height: 12 },
        layers: [{ id: layerId, name: 'Layer 1', height: 3 }],
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
  });

  it('sets label from binName param', () => {
    window.history.replaceState(null, '', '/?placeBin=2x2x3&binName=Custom%20Bin');
    renderHook(() => usePlaceBinFromURL());
    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins[bins.length - 1];
    expect(placed.label).toBe('Custom Bin');
  });

  it('cleans URL after placement', () => {
    window.history.replaceState(null, '', '/?placeBin=2x2x3&binName=Test');
    renderHook(() => usePlaceBinFromURL());
    expect(window.location.search).not.toContain('placeBin');
    expect(window.location.search).not.toContain('binName');
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

  it('falls back to staging when grid placement fails', () => {
    // Fill the grid position (0,0) to force collision
    const state = useLayoutStore.getState();

    // Set drawer to tiny so bin won't fit on grid
    useLayoutStore.setState({
      layout: {
        ...state.layout,
        drawer: { width: 1, depth: 1, height: 10 },
      },
    });

    window.history.replaceState(null, '', '/?placeBin=5x5x3&binName=Big%20Bin');
    renderHook(() => usePlaceBinFromURL());

    // Should be in staging
    const bins = useLayoutStore.getState().layout.bins;
    const placed = bins.find((b) => b.label === 'Big Bin');
    expect(placed).toBeDefined();
    expect(placed?.layerId).toBe('__staging__');

    // Restore drawer
    useLayoutStore.setState({
      layout: {
        ...useLayoutStore.getState().layout,
        drawer: { width: 10, depth: 8, height: 12 },
      },
    });
  });
});
