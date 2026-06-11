/**
 * UI slice: tabs, dialogs, wireframe, half-bin mode, preview states.
 */

import type { Draft } from 'immer';
import type {
  DesignerState,
  BinParams,
  ColorTool,
  DesignerTab,
  PickerOverlayState,
  SplitViewMode,
  SplitPieceMeshEntry,
  DividerTiltPreview,
  OverhangHighlightSide,
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

    setHoveredOverhangSide: (side: OverhangHighlightSide | null) => {
      set((state) => {
        state.ui.hoveredOverhangSide = side;
      });
    },

    setSelectedDividerKey: (key: string | null) => {
      set((state) => {
        state.ui.selectedDividerKey = key;
      });
    },

    setHoveredDividerKey: (key: string | null) => {
      set((state) => {
        state.ui.hoveredDividerKey = key;
      });
    },

    setDividerTiltPreview: (preview: DividerTiltPreview | null) => {
      set((state) => {
        state.ui.dividerTiltPreview = preview;
      });
    },

    setHoveredCompartmentId: (id: number | null) => {
      set((state) => {
        state.ui.hoveredCompartmentId = id;
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
        // Drop hover focus on every tool transition so the glow doesn't
        // leak from one mode into the next.
        state.ui.hoveredColorZone = null;
        // Picker only makes sense in eyedropper mode — clear it whenever
        // we transition to anything else (null, swap-pick-first, etc.),
        // otherwise a picker opened during eyedropper would float over the
        // swap banner ("mutually exclusive tool overlay" promise).
        if (tool !== 'eyedropper') {
          state.ui.pickerOverlay = null;
        }
      });
    },

    setPickerOverlay: (overlay: PickerOverlayState | null) => {
      set((state) => {
        state.ui.pickerOverlay = overlay;
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
        const bothLip = first !== null && lipCornerOf(first) && lipCornerOf(zone);
        if (!first || first === zone || bothLip) {
          // Picking the same zone twice OR two lip corners (visually one
          // zone after the per-corner rollback) is a no-op cancel.
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

    toggleHalfGridMode: () => {
      set((state) => {
        const enabling = !state.ui.halfGridMode;
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
        state.ui.halfGridMode = enabling;
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
  if (lipCornerOf(zone)) {
    // The per-corner lip UI is rolled back to a single visual zone; mirror
    // any corner-targeted write across all four slots so the lip stays
    // visually uniform regardless of which corner the raycast hit.
    for (const corner of LIP_CORNERS) {
      colors.lip[corner] = hex;
    }
    return;
  }
  colors[zone as 'body' | 'labelTab' | 'base' | 'scoop' | 'dividers'] = hex;
}
