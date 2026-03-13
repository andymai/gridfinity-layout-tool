import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createDefaultLayout } from '@/core/constants';
import { createBinActions } from './binActions';
import { createLayerActions } from './layerActions';
import { createCategoryActions } from './categoryActions';
import { createDrawerActions } from './drawerActions';
import { createBulkActions } from './bulkActions';
import { createCoreActions } from './coreActions';
import type { LayoutState } from './types';

export type { FillMeta, EditSource } from './types';

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
      layout: createDefaultLayout(),
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
