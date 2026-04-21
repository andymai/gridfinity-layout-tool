/**
 * UI slice: tabs, dialogs, wireframe, half-bin mode, preview states.
 */

import type { Draft } from 'immer';
import type {
  DesignerState,
  BinParams,
  DesignerTab,
  SplitViewMode,
  SplitPieceMeshEntry,
} from '../../types';
import type { ColorZone } from '../../types/featureColors';
import { isFractional } from '@/core/constants';
import { pushHistoryEntry } from '../helpers';

type Set = (fn: (state: Draft<DesignerState>) => void) => void;

export function createUISlice(set: Set) {
  return {
    setActiveTab: (tab: DesignerTab) => {
      set((state) => {
        state.ui.activeTab = tab;
      });
    },

    setExportDialogOpen: (open: boolean) => {
      set((state) => {
        state.ui.exportDialogOpen = open;
      });
    },

    setDesignListOpen: (open: boolean) => {
      set((state) => {
        state.ui.designListOpen = open;
      });
    },

    setWireframeMode: (enabled: boolean) => {
      set((state) => {
        state.ui.wireframeMode = enabled;
      });
    },

    setCutoutEditorOpen: (open: boolean) => {
      set((state) => {
        state.ui.cutoutEditorOpen = open;
      });
    },

    setPreviewCompartments: (preview: BinParams['compartments'] | null) => {
      set((state) => {
        state.ui.previewCompartments = preview;
      });
    },

    setPreviewSelection: (
      selection: {
        action: 'merge' | 'split';
        minCol: number;
        maxCol: number;
        minRow: number;
        maxRow: number;
      } | null
    ) => {
      set((state) => {
        state.ui.previewSelection = selection;
      });
    },

    setSplitViewMode: (mode: SplitViewMode) => {
      set((state) => {
        state.ui.splitViewMode = mode;
      });
    },

    setSplitPieceMeshes: (meshes: readonly SplitPieceMeshEntry[]) => {
      set((state) => {
        state.ui.splitPieceMeshes = [...meshes];
      });
    },

    setHoveredColorZone: (zone: ColorZone | null) => {
      set((state) => {
        state.ui.hoveredColorZone = zone;
      });
    },

    setShapeEditorOpen: (open: boolean) => {
      set((state) => {
        state.ui.shapeEditorOpen = open;
      });
    },

    toggleHalfBinMode: () => {
      set((state) => {
        const enabling = !state.ui.halfBinMode;
        if (!enabling) {
          if (isFractional(state.params.width) || isFractional(state.params.depth)) {
            pushHistoryEntry(state);
          }
          if (isFractional(state.params.width)) {
            state.params.width = Math.round(state.params.width);
          }
          if (isFractional(state.params.depth)) {
            state.params.depth = Math.round(state.params.depth);
          }
        }
        state.ui.halfBinMode = enabling;
      });
    },
  };
}
