/**
 * Bin Designer Zustand store.
 *
 * Composes focused slices into a single store for backward compatibility.
 * Slices live in ./slices/ and shared helpers in ./helpers.ts.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DesignerState, SavedDesign } from '../types';
import { reconcilePublishedId } from '../sync/publishedIdReconcile';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_GENERATION_STATE,
  DEFAULT_UI_STATE,
  DEFAULT_HISTORY,
} from '../constants';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '../utils/fileNaming';

import {
  createParamSlice,
  createCutoutSlice,
  createHistorySlice,
  createUISlice,
  createPersistenceSlice,
} from './slices';

export const useDesignerStore = create<DesignerState>()(
  immer((set, get) => {
    // Wrapped at composition time (not per call site) so every path that
    // turns a SavedDesign into the current design (including programmatic
    // getState().loadDesign callers that mount no hook) reconciles a
    // cached publishedId against the community API.
    const persistenceSlice = createPersistenceSlice(set);
    return {
      params: { ...DEFAULT_BIN_PARAMS },
      itemKind: 'bin',
      envelope: null,
      structure: null,
      generation: { ...DEFAULT_GENERATION_STATE },
      history: { ...DEFAULT_HISTORY },
      wasmStatus: 'unloaded',
      ui: { ...DEFAULT_UI_STATE },
      transactionDepth: 0,

      // Persistence state
      currentDesignId: null as string | null,
      designName: 'Untitled Bin',
      saveStatus: 'idle',
      exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
      pendingBinLink: null as string | null,
      needsThumbnailUpdate: false,

      // Compose slices
      ...createParamSlice(set, get),
      ...createCutoutSlice(set),
      ...createHistorySlice(set, get),
      ...createUISlice(set),
      ...persistenceSlice,
      loadDesign: (design: SavedDesign) => {
        persistenceSlice.loadDesign(design);
        void reconcilePublishedId(design);
      },
    };
  })
);

// Re-export the test utility from helpers
export { _resetPendingMeshCache } from './helpers';
