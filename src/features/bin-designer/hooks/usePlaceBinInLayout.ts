/**
 * Designer → Layout Planner bin placement.
 *
 * "Place in layout" navigates to the planner with
 * `?placeBin=WxDxH&binName=...&placeDesignId=...` query params. The App-level
 * hook detects those params, places the bin (linked to its design when the
 * registry can resolve it), and cleans up the URL. Detection runs on mount for
 * full page loads and on popstate for in-app navigation — App stays mounted
 * across the designer/planner route switch, so a mount-only effect would never
 * see params added by `navigateToPlaceInLayout`.
 */

import { useEffect } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore } from '@/core/store/selection';
import { useToastStore } from '@/core/store/toast';
import { commandBus, createCqrsMutations } from '@/core/cqrs';
import { isOk } from '@/core/result';
import { gridUnits, heightUnits } from '@/core/types';
import type { GridUnits, HeightUnits, LayerId, Layout } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { canPlaceBin } from '@/shared/utils/validation';
import { useTranslation } from '@/i18n';
import type { TFunction } from '@/i18n';
import { dispatchSyntheticPopstate } from '@/shared/hooks/useDesignerRouting';
import {
  loadRegistry,
  upsertRegistryEntry,
  registryEdgeFields,
  registryHeightFields,
  registryKnifeRestFields,
  registryOverhangFields,
} from '../store/customBinRegistry';
import { designFootprint, isBinDesign } from '../utils/designKind';
import type { SavedDesign } from '../types';

/**
 * Open the Layout Planner with `design` queued for placement as a linked bin.
 */
export function navigateToPlaceInLayout(design: SavedDesign): void {
  const { width, depth, height } = designFootprint(design);
  if (isBinDesign(design)) {
    // A design can exist in IndexedDB without a registry entry (only the
    // mounted Designer page's save hooks register). Register here so the
    // placed bin links to an id the planner can resolve.
    upsertRegistryEntry({
      id: design.id,
      name: design.name,
      width,
      depth,
      height,
      ...registryEdgeFields(design.params),
      ...registryHeightFields(design.params),
      ...registryKnifeRestFields(design.params),
      ...registryOverhangFields(design.params),
      updatedAt: design.updatedAt,
    });
  }
  const url = new URL(window.location.origin);
  url.searchParams.set('placeBin', `${width}x${depth}x${height}`);
  url.searchParams.set('binName', design.name);
  url.searchParams.set('placeDesignId', design.id);
  window.history.pushState(null, '', url.pathname + url.search);
  dispatchSyntheticPopstate();
}

interface FitRect {
  x: GridUnits;
  y: GridUnits;
  width: GridUnits;
  depth: GridUnits;
}

/**
 * First free whole-unit position on `layerId`, trying the as-authored
 * orientation and then width/depth swapped (canPlaceBin never rotates).
 */
function findFirstFit(
  layout: Layout,
  layerId: LayerId,
  width: number,
  depth: number,
  height: HeightUnits
): FitRect | null {
  const orientations =
    width === depth
      ? [{ width, depth }]
      : [
          { width, depth },
          { width: depth, depth: width },
        ];
  for (const orientation of orientations) {
    for (let y = 0; y <= layout.drawer.depth - orientation.depth; y += 1) {
      for (let x = 0; x <= layout.drawer.width - orientation.width; x += 1) {
        const rect = {
          x: gridUnits(x),
          y: gridUnits(y),
          width: gridUnits(orientation.width),
          depth: gridUnits(orientation.depth),
        };
        if (canPlaceBin({ ...rect, height }, layerId, layout).valid) {
          return rect;
        }
      }
    }
  }
  return null;
}

function placeBinFromUrl(t: TFunction): void {
  const urlParams = new URLSearchParams(window.location.search);
  const placeBin = urlParams.get('placeBin');
  if (!placeBin) return;

  // Clean the URL before placing so a re-entry (StrictMode double-effect,
  // back/forward) can never place twice.
  const url = new URL(window.location.href);
  url.searchParams.delete('placeBin');
  const binName = url.searchParams.get('binName') ?? undefined;
  url.searchParams.delete('binName');
  const designIdParam = url.searchParams.get('placeDesignId');
  url.searchParams.delete('placeDesignId');
  window.history.replaceState({}, '', url.pathname + url.search || '/');

  const parts = placeBin.split('x').map(Number);
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v) || v <= 0)) {
    return;
  }
  const [wRaw, dRaw, hRaw] = parts;

  // Registry dimensions win over the URL's: the linked-mesh preview draws the
  // design's real geometry, so a placed bin must match the design, not a
  // possibly stale link.
  const ref =
    designIdParam === null ? undefined : loadRegistry().find((r) => r.id === designIdParam);
  const width = ref?.width ?? wRaw;
  const depth = ref?.depth ?? dRaw;
  const height = heightUnits(ref?.height ?? hRaw);

  const { layout } = useLayoutStore.getState();
  const selection = useSelectionStore.getState();
  const layerId = selection.activeLayerId || layout.layers[0]?.id;
  if (!layerId) return;

  const addToast = useToastStore.getState().addToast;
  const mutations = createCqrsMutations(commandBus);
  const name = binName ?? ref?.name ?? '';
  const displayName = name || t('binDesigner.placeInLayout.defaultName');
  const common = {
    height,
    category: selection.activeCategoryId,
    label: name,
    notes: '',
    ...(ref === undefined ? {} : { linkedDesignId: ref.id }),
  };

  const fit = findFirstFit(layout, layerId, width, depth, height);
  if (fit !== null) {
    const result = mutations.addBin({ ...common, layerId, ...fit });
    if (isOk(result)) {
      useSelectionStore.getState().setSelectedBins([result.value]);
      addToast({
        message: t('binDesigner.placeInLayout.placed', { name: displayName }),
        type: 'success',
        duration: 3000,
      });
      return;
    }
  }

  const stagingResult = mutations.addBin({
    ...common,
    layerId: STAGING_ID,
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(width),
    depth: gridUnits(depth),
  });
  if (isOk(stagingResult)) {
    useSelectionStore.getState().setSelectedBins([stagingResult.value]);
    addToast({
      message: t('binDesigner.placeInLayout.staged', { name: displayName }),
      type: 'info',
      duration: 4000,
    });
  }
}

/**
 * Places the bin described by `?placeBin` query params into the current
 * layout: on the active layer at the first free position (either orientation),
 * else into staging. When `placeDesignId` resolves in the custom-bin registry,
 * the placed bin is linked to that design.
 */
export function usePlaceBinFromURL(): void {
  const t = useTranslation();

  useEffect(() => {
    placeBinFromUrl(t);
    const handlePopState = () => placeBinFromUrl(t);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [t]);
}
