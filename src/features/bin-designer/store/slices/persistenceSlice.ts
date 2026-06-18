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
import { DEFAULT_BIN_PARAMS } from '../../constants';
import type { ItemKind } from '@/shared/types/item';
import { getItemDescriptor, hasItemDescriptor } from '@/shared/items/registry';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import '@/shared/items/registerDescriptors';

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

    newDesign: (kind: ItemKind = 'bin') => {
      set((state) => {
        state.history.past = [];
        state.history.future = [];
        state.currentDesignId = null;
        state.saveStatus = 'idle';
        state.exportFileNameConfig = { ...DEFAULT_EXPORT_FILE_NAME_CONFIG };
        state.pendingBinLink = null;
        state.needsThumbnailUpdate = false;
        state.generation.epoch += 1;
        state.itemKind = kind;
        state.ui.shapeEditorOpen = false;

        if (kind === 'bin') {
          state.params = { ...defaultsForNewDesign() };
          state.envelope = null;
          state.structure = null;
          state.designName = 'Untitled Bin';
          // Reset UI toggles derived from params. A user's custom default may
          // carry fractional dimensions — derive halfGridMode from the resolved
          // params so the toggle never desyncs from the geometry.
          state.ui.halfGridMode = paramsNeedHalfGridMode(state.params);
        } else {
          // Non-bin kind: live editable state is envelope + structure.
          state.structure = getItemDescriptor(kind).defaults();
          state.envelope = createDefaultEnvelope(DEFAULT_BIN_PARAMS.featureColors);
          state.designName = 'Untitled';
          state.ui.halfGridMode = false;
        }
        setPendingMeshCache(null);
      });
    },

    loadDesign: (design: SavedDesign) => {
      // Check if thumbnail needs regeneration (missing or outdated version)
      const needsNewThumbnail =
        !design.thumbnail || (design.thumbnailVersion ?? 0) < THUMBNAIL_VERSION;

      const kind: ItemKind = design.kind ?? 'bin';
      const savedEnvelope = design.envelope;
      const savedStructure = design.structure;
      // Unknown kind (e.g. a design shared from a newer version) falls through
      // to the bin path rather than crashing the designer on load.
      if (kind !== 'bin' && hasItemDescriptor(kind) && savedStructure && savedEnvelope) {
        set((state) => {
          state.itemKind = kind;
          state.structure = getItemDescriptor(kind).migrate(savedStructure, savedEnvelope);
          state.envelope = savedEnvelope;
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
          state.ui.halfGridMode = false;
          state.ui.shapeEditorOpen = false;
          setPendingMeshCache(null);
        });
        return;
      }

      let migrated = migrateParams(design.params ?? {});
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
        state.itemKind = 'bin';
        state.envelope = null;
        state.structure = null;
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
