import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Layout, Mm, GridUnits, HeightUnits } from '@/core/types';
import { createBinActions } from './binActions';
import { createLayerActions } from './layerActions';
import { createCategoryActions } from './categoryActions';
import { createDrawerActions } from './drawerActions';
import { createBulkActions } from './bulkActions';
import { createCoreActions } from './coreActions';
import type { LayoutState } from './types';

export type { FillMeta, EditSource } from './types';

/**
 * Empty placeholder layout used as the initial state.
 *
 * Pure literal — calls no imported functions. This matters because Zustand
 * runs the store creator eagerly at module-init, and any cross-module
 * function call there can hit undefined imported bindings under chunk-level
 * static-import cycles (see issue #1466). The real layout is loaded via
 * `importLayout` during app bootstrap (main.tsx).
 *
 * Branded-type casts (Mm, GridUnits, HeightUnits) are used directly because
 * the branded-types module's runtime exports are identity functions; using
 * casts keeps this declaration a true literal with no function calls.
 */
const PLACEHOLDER_LAYOUT: Layout = {
  version: '1.0',
  name: '',
  drawer: { width: 0 as GridUnits, depth: 0 as GridUnits, height: 0 as HeightUnits },
  printBedSize: 256 as Mm,
  gridUnitMm: 42 as Mm,
  heightUnitMm: 7 as Mm,
  categories: [],
  layers: [],
  bins: [],
};

/**
 * Layout store — the single source of truth for the active layout's data model.
 * Contains drawer dimensions, bins, layers, categories, and all mutations.
 * Mutations return `Result<T, LayoutError>` for explicit error handling.
 */
export const useLayoutStore = create<LayoutState>()(
  immer((set, get) => {
    const setLocal = (fn: (state: LayoutState) => void): void => {
      set((state) => {
        fn(state);
        state.lastEditSource = 'local';
      });
    };

    return {
      layout: PLACEHOLDER_LAYOUT,
      activeLayoutId: null,
      lastEditSource: null,
      _fillMeta: null,

      ...createBinActions(setLocal, get),
      ...createLayerActions(setLocal, get),
      ...createCategoryActions(setLocal, get),
      ...createDrawerActions(setLocal),
      ...createBulkActions(setLocal, get),
      ...createCoreActions(setLocal, set, get),
    };
  })
);
