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
import { categoryId, gridUnits, heightUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

/**
 * Open the Layout Planner with a preselected bin described by dimensions and an optional name.
 *
 * @param width - The bin width
 * @param depth - The bin depth
 * @param height - The bin height
 * @param name - Optional display name for the bin
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
 * Detects a ?placeBin=WxDxH query on mount, places that bin into the current layout, and removes the query from the URL.
 *
 * If a valid `placeBin` value is present, this hook removes `placeBin` (and optional `binName`) from the URL immediately, parses the dimensions (width×depth×height) as numbers greater than zero, determines a target layer (the active layer or the first layout layer), and attempts to add the bin at position (0,0). If placement on the target layer succeeds the new bin is selected and a success toast is shown; if placement fails the hook attempts to add the bin to the staging layer (`'__staging__'`), selects it if successful, and shows an informational toast. The hook performs no action for missing or invalid `placeBin` values.
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
    const [wRaw, dRaw, hRaw] = parts;
    const w = gridUnits(wRaw);
    const d = gridUnits(dRaw);
    const h = heightUnits(hRaw);

    // Try to place bin on grid, scanning positions
    const { addBin, layout } = useLayoutStore.getState();
    const { activeLayerId } = useSelectionStore.getState();
    const addToast = useToastStore.getState().addToast;

    const layerId = activeLayerId || layout.layers[0]?.id;
    if (!layerId) return;

    // Scan for a valid position (top-left to bottom-right)
    const { drawer } = layout;
    let placed = false;
    for (let y = gridUnits(0); y <= drawer.depth - d && !placed; y = gridUnits(y + 1)) {
      for (let x = gridUnits(0); x <= drawer.width - w && !placed; x = gridUnits(x + 1)) {
        const result = addBin({
          x,
          y,
          width: w,
          depth: d,
          height: h,
          layerId,
          category: categoryId(''),
          label: binName ?? '',
          notes: '',
        });

        if (isOk(result)) {
          useSelectionStore.getState().setSelectedBins([result.value]);
          addToast({
            message: `Placed "${binName ?? 'custom bin'}" (${w}×${d}×${h}) — drag to reposition`,
            type: 'success',
            duration: 3000,
          });
          placed = true;
        }
      }
    }

    if (!placed) {
      // No valid grid position found — add to staging
      const stagingResult = addBin({
        x: gridUnits(0),
        y: gridUnits(0),
        width: w,
        depth: d,
        height: h,
        layerId: STAGING_ID,
        category: categoryId(''),
        label: binName ?? '',
        notes: '',
      });

      if (isOk(stagingResult)) {
        useSelectionStore.getState().setSelectedBins([stagingResult.value]);
        addToast({
          message: `"${binName ?? 'custom bin'}" added to staging — drag it to the grid`,
          type: 'info',
          duration: 4000,
        });
      }
    }
  }, []);
}
