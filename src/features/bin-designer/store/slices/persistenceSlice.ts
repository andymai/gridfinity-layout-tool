/**
 * Persistence slice: design name, save status, export config, design lifecycle.
 */

import type { Draft } from 'immer';
import type { DesignerState, SaveStatus, ExportFileNameConfig, SavedDesign } from '../../types';
import { THUMBNAIL_VERSION } from '../../types';
import { DEFAULT_BIN_PARAMS, migrateParams } from '../../constants';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '../../utils/fileNaming';
import { setPendingMeshCache } from '../helpers';

type Set = (fn: (state: Draft<DesignerState>) => void) => void;

export function createPersistenceSlice(set: Set) {
  return {
    setCurrentDesignId: (id: string | null) => {
      set((state) => {
        state.currentDesignId = id;
      });
    },

    setDesignName: (name: string) => {
      set((state) => {
        state.designName = name;
      });
    },

    setSaveStatus: (status: SaveStatus) => {
      set((state) => {
        state.saveStatus = status;
      });
    },

    setExportFileNameConfig: (config: ExportFileNameConfig) => {
      set((state) => {
        state.exportFileNameConfig = config;
      });
    },

    setPendingBinLink: (binId: string | null) => {
      set((state) => {
        state.pendingBinLink = binId;
      });
    },

    clearPendingBinLink: () => {
      set((state) => {
        state.pendingBinLink = null;
      });
    },

    setNeedsThumbnailUpdate: (needed: boolean) => {
      set((state) => {
        state.needsThumbnailUpdate = needed;
      });
    },

    newDesign: () => {
      set((state) => {
        state.history.past = [];
        state.history.future = [];
        state.params = { ...DEFAULT_BIN_PARAMS };
        state.currentDesignId = null;
        state.designName = 'Untitled Bin';
        state.saveStatus = 'idle';
        state.exportFileNameConfig = { ...DEFAULT_EXPORT_FILE_NAME_CONFIG };
        state.pendingBinLink = null;
        state.needsThumbnailUpdate = false;
        state.generation.epoch += 1;
        setPendingMeshCache(null);
      });
    },

    loadDesign: (design: SavedDesign) => {
      // Check if thumbnail needs regeneration (missing or outdated version)
      const needsNewThumbnail =
        !design.thumbnail || (design.thumbnailVersion ?? 0) < THUMBNAIL_VERSION;

      set((state) => {
        state.params = migrateParams(design.params);
        state.currentDesignId = design.id;
        state.designName = design.name;
        state.exportFileNameConfig = design.exportFileNameConfig ?? {
          ...DEFAULT_EXPORT_FILE_NAME_CONFIG,
        };
        state.history = { past: [], future: [] };
        state.saveStatus = 'saved';
        state.pendingBinLink = null;
        state.needsThumbnailUpdate = needsNewThumbnail;
        state.generation.epoch += 1;
        setPendingMeshCache(null);
      });
    },
  };
}
