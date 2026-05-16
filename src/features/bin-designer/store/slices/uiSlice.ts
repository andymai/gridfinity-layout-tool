/**
 * UI slice: tabs, dialogs, wireframe, half-bin mode, preview states.
 */

import type { Draft } from 'immer';
import type {
  DesignerState,
  BinParams,
  ColorTool,
  DesignerTab,
  SplitViewMode,
  SplitPieceMeshEntry,
} from '../../types';
import type { ColorZone, HoverableZone, LipCorner } from '../../types/featureColors';
import { LIP_CORNERS, lipCornerZone } from '../../types/featureColors';
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

    setHoveredColorZone: (zone: HoverableZone | null) => {
      set((state) => {
        state.ui.hoveredColorZone = zone;
      });
    },

    setColorTool: (tool: ColorTool) => {
      set((state) => {
        state.ui.colorTool = tool;
        // Clear any in-flight swap pick whenever the tool changes — entering
        // eyedropper mid-swap shouldn't leave a stale first zone behind.
        if (tool !== 'swap-pick-second') {
          state.ui.swapFirstZone = null;
        }
        // Drop the hover focus when leaving a tool so the glow doesn't linger.
        if (tool === null) {
          state.ui.hoveredColorZone = null;
        }
      });
    },

    pickSwapZone: (zone: ColorZone): { first: ColorZone; second: ColorZone } | null => {
      let swapped: { first: ColorZone; second: ColorZone } | null = null;
      set((state) => {
        if (state.ui.colorTool === 'swap-pick-first') {
          state.ui.swapFirstZone = zone;
          state.ui.colorTool = 'swap-pick-second';
          return;
        }
        if (state.ui.colorTool !== 'swap-pick-second') return;

        const first = state.ui.swapFirstZone;
        if (!first || first === zone) {
          // Picking the same zone twice is a no-op cancel: exit the flow.
          state.ui.colorTool = null;
          state.ui.swapFirstZone = null;
          state.ui.hoveredColorZone = null;
          return;
        }

        pushHistoryEntry(state);
        applyZoneSwap(state.params.featureColors, first, zone);
        state.ui.colorTool = null;
        state.ui.swapFirstZone = null;
        state.ui.hoveredColorZone = null;
        swapped = { first, second: zone };
      });
      return swapped;
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

/**
 * Swap two zones' colors in place on the FeatureColorConfig draft.
 *
 * Lip corner zones live nested under `lip.{corner}`, so reading and
 * writing both ends needs a small adapter — top-level zones map 1:1 to
 * keys on FeatureColorConfig.
 */
function applyZoneSwap(
  colors: Draft<DesignerState['params']['featureColors']>,
  a: ColorZone,
  b: ColorZone
): void {
  const colorA = readZone(colors, a);
  const colorB = readZone(colors, b);
  writeZone(colors, a, colorB);
  writeZone(colors, b, colorA);
}

function lipCornerOf(zone: ColorZone): LipCorner | null {
  for (const corner of LIP_CORNERS) {
    if (lipCornerZone(corner) === zone) return corner;
  }
  return null;
}

function readZone(
  colors: Draft<DesignerState['params']['featureColors']>,
  zone: ColorZone
): string {
  const corner = lipCornerOf(zone);
  if (corner) return colors.lip[corner];
  // body | labelTab | base | scoop | dividers — direct properties
  return colors[zone as 'body' | 'labelTab' | 'base' | 'scoop' | 'dividers'];
}

function writeZone(
  colors: Draft<DesignerState['params']['featureColors']>,
  zone: ColorZone,
  hex: string
): void {
  const corner = lipCornerOf(zone);
  if (corner) {
    colors.lip[corner] = hex;
    return;
  }
  colors[zone as 'body' | 'labelTab' | 'base' | 'scoop' | 'dividers'] = hex;
}
