/**
 * Hook for handling bin placement from the Designer into the Layout Planner.
 *
 * When the user clicks "Use in Layout" in the Designer, it navigates to
 * the planner with `?placeBin=WxDxH&binName=...` query params.
 * This hook detects those params, creates the bin, and cleans up the URL.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { isOk } from '@/core/result';

/**
 * Navigate to the Layout Planner with a bin to place.
 * Called from the Designer UI.
 */
export function navigateToPlaceInLayout(
  width: number,
  depth: number,
  height: number,
  name?: string
): void {
  const url = new URL(window.location.origin);
  url.searchParams.set('placeBin', `${width}x${depth}x${height}`);
  if (name) {
    url.searchParams.set('binName', name);
  }
  window.history.pushState(null, '', url.pathname + url.search);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Hook that checks for `?placeBin=` param on mount and places
 * the bin in the current layout at the first available position.
 *
 * Should be called from the Layout Planner (not the Designer).
 */
export function usePlaceBinFromURL(): void {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const placeBin = urlParams.get('placeBin');
    if (!placeBin) return;

    handled.current = true;

    // Clean URL immediately
    const url = new URL(window.location.href);
    url.searchParams.delete('placeBin');
    const binName = url.searchParams.get('binName') ?? undefined;
    url.searchParams.delete('binName');
    window.history.replaceState({}, '', url.pathname + url.search || '/');

    // Parse dimensions: WxDxH
    const parts = placeBin.split('x').map(Number);
    if (parts.length !== 3 || parts.some(isNaN) || parts.some((v) => v <= 0)) {
      return;
    }
    const [w, d, h] = parts;

    // Place bin at (0,0) on active layer
    const { addBin, layout } = useLayoutStore.getState();
    const { activeLayerId } = useSelectionStore.getState();
    const addToast = useToastStore.getState().addToast;

    const layerId = activeLayerId || layout.layers[0]?.id;
    if (!layerId) return;

    const result = addBin({
      x: 0,
      y: 0,
      width: w,
      depth: d,
      height: h,
      layerId,
      category: '',
      label: binName ?? '',
      notes: '',
    });

    if (isOk(result)) {
      // Select the newly placed bin
      useSelectionStore.getState().setSelectedBins([result.value]);
      addToast(
        `Placed "${binName ?? 'custom bin'}" (${w}×${d}×${h}) — drag to reposition`,
        'success'
      );
    } else {
      // Placement failed (likely collision at 0,0) - add to staging instead
      const stagingResult = addBin({
        x: 0,
        y: 0,
        width: w,
        depth: d,
        height: h,
        layerId: '__staging__',
        category: '',
        label: binName ?? '',
        notes: '',
      });

      if (isOk(stagingResult)) {
        useSelectionStore.getState().setSelectedBins([stagingResult.value]);
        addToast(
          `"${binName ?? 'custom bin'}" added to staging — drag it to the grid`,
          'info'
        );
      }
    }
  }, []);
}
