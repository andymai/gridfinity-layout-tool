/**
 * Persistence slice: design name, save status, export config, design lifecycle.
 */

import type { Draft } from 'immer';
import type { DesignerState, SaveStatus, ExportFileNameConfig, SavedDesign } from '../../types';
import { THUMBNAIL_VERSION } from '../../types';
import { migrateParams } from '../../constants';
import { DEFAULT_EXPORT_FILE_NAME_CONFIG } from '../../utils/fileNaming';
import { defaultsForNewDesign, paramsNeedHalfGridMode, setPendingMeshCache } from '../helpers';
import { isPartialMask, validateMask } from '@/shared/utils/cellMask';

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
        state.params = { ...defaultsForNewDesign() };
        state.currentDesignId = null;
        state.designName = 'Untitled Bin';
        state.saveStatus = 'idle';
        state.exportFileNameConfig = { ...DEFAULT_EXPORT_FILE_NAME_CONFIG };
        state.pendingBinLink = null;
        state.needsThumbnailUpdate = false;
        state.generation.epoch += 1;
        // Reset UI toggles that are derived from params so the new design
        // starts clean instead of inheriting the previous session's state.
        state.ui.halfGridMode = false;
        state.ui.shapeEditorOpen = false;
        setPendingMeshCache(null);
      });
    },

    loadDesign: (design: SavedDesign) => {
      // Check if thumbnail needs regeneration (missing or outdated version)
      const needsNewThumbnail =
        !design.thumbnail || (design.thumbnailVersion ?? 0) < THUMBNAIL_VERSION;

      let migrated = migrateParams(design.params);
      // Belt-and-braces: `setCellMask` would reject a malformed mask, but
      // `state.params = migrated` bypasses that action. If a persisted or
      // shared design carries a structurally-invalid cellMask (crafted
      // payload, data corruption, schema drift), drop it back to the
      // rectangle fast-path rather than hand an invalid polygon to the
      // generator.
      if (isPartialMask(migrated.cellMask) && validateMask(migrated.cellMask) !== null) {
        migrated = { ...migrated, cellMask: undefined };
      }
      set((state) => {
        state.params = migrated;
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
        // halfGridMode and shapeEditorOpen live in UI state (not in
        // SavedDesign), so derive them from the loaded params. Without
        // this, a half-bin design opens in a 1u UI that can't represent
        // its own state, and a custom-masked design opens with its shape
        // editor collapsed. Normalize both ways so switching between
        // saved designs doesn't leak the previous session's toggles.
        state.ui.halfGridMode = paramsNeedHalfGridMode(migrated);
        state.ui.shapeEditorOpen = isPartialMask(migrated.cellMask);
        setPendingMeshCache(null);
      });
    },
  };
}
