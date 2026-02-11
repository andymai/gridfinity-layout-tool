/**
 * Bin Designer Zustand store.
 *
 * Composes focused slices into a single store for backward compatibility.
 * Slices live in ./slices/ and shared helpers in ./helpers.ts.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DesignerState, SaveStatus, WasmStatus } from '../types';
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
  immer((set, get) => ({
    // Initial state
    params: { ...DEFAULT_BIN_PARAMS },
    generation: { ...DEFAULT_GENERATION_STATE },
    history: { ...DEFAULT_HISTORY },
    wasmStatus: 'unloaded' as WasmStatus,
    ui: { ...DEFAULT_UI_STATE },
    transactionDepth: 0,

    // Persistence state
    currentDesignId: null as string | null,
    designName: 'Untitled Bin',
    saveStatus: 'idle' as SaveStatus,
    exportFileNameConfig: { ...DEFAULT_EXPORT_FILE_NAME_CONFIG },
    pendingBinLink: null as string | null,
    needsThumbnailUpdate: false,

    // Compose slices
    ...createParamSlice(set, get),
    ...createCutoutSlice(set),
    ...createHistorySlice(set, get),
    ...createUISlice(set),
    ...createPersistenceSlice(set),
  }))
);

// Re-export the test utility from helpers
export { _resetPendingMeshCache } from './helpers';
