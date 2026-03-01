import { create } from 'zustand';
import type { BinId, CategoryId } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';

/**
 * View Store
 *
 * Manages viewport, panels, and visual display settings.
 * Extracted from ui.ts as part of the god object decomposition.
 *
 * State groups:
 * - Zoom: viewport zoom level
 * - Visibility: layer/label visibility toggles
 * - Panels: desktop panel collapsed states
 * - Context menu: right-click menu state
 * - Highlighting: hover preview highlights for categories/rows/columns
 * - Modals: print modal open state
 */

export interface ContextMenuState {
  binIds: BinId[];
  position: { x: number; y: number };
  source: 'grid' | 'staging';
}

export type LayerViewMode = 'focus' | 'stack' | 'all';

interface ViewState {
  // Zoom
  zoom: number;

  // Visibility toggles
  showOtherLayers: boolean;

  // Desktop panel states
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;

  // Context menu
  contextMenu: ContextMenuState | null;

  // Highlighting (for hover preview)
  highlightedCategoryId: CategoryId | null;
  highlightedRowLabel: number | null; // 1-indexed row number
  highlightedColLabel: number | null; // 1-indexed column number

  // Modals
  printModalOpen: boolean;
  showLayoutManager: boolean;

  // 3D Preview
  showIsometricPreview: boolean;
  isometricRotation: number;
  layerViewMode: LayerViewMode;
  isPreviewExpanded: boolean;
}

interface ViewActions {
  // Zoom
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Visibility
  toggleShowOtherLayers: () => void;

  // Panels
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Context menu (backwards compatible - accepts single ID or array)
  showContextMenu: (
    binIdsOrId: BinId | BinId[],
    position: { x: number; y: number },
    source?: 'grid' | 'staging'
  ) => void;
  hideContextMenu: () => void;

  // Highlighting
  setHighlightedCategoryId: (categoryId: CategoryId | null) => void;
  setHighlightedRowLabel: (row: number | null) => void;
  setHighlightedColLabel: (col: number | null) => void;

  // Modals
  setPrintModalOpen: (open: boolean) => void;
  setShowLayoutManager: (show: boolean) => void;

  // 3D Preview
  toggleIsometricPreview: () => void;
  setIsometricRotation: (rotation: number) => void;
  setLayerViewMode: (mode: LayerViewMode) => void;
  snapToIsometric: () => void;
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;
}

export type ViewStore = ViewState & ViewActions;

export const INITIAL_VIEW_STATE = {
  zoom: 1,
  showOtherLayers: true,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  contextMenu: null as ContextMenuState | null,
  highlightedCategoryId: null as CategoryId | null,
  highlightedRowLabel: null as number | null,
  highlightedColLabel: null as number | null,
  printModalOpen: false,
  showLayoutManager: false,
  showIsometricPreview: false,
  isometricRotation: 0,
  layerViewMode: 'stack' as LayerViewMode,
  isPreviewExpanded: false,
} as const;

export const useViewStore = create<ViewStore>((set) => ({
  // Initial state
  ...INITIAL_VIEW_STATE,

  // Zoom actions
  setZoom: (zoom) =>
    set({
      zoom: clamp(zoom, CONSTRAINTS.ZOOM_MIN, CONSTRAINTS.ZOOM_MAX),
    }),

  zoomIn: () =>
    set((state) => ({
      zoom: Math.min(CONSTRAINTS.ZOOM_MAX, state.zoom + CONSTRAINTS.ZOOM_STEP),
    })),

  zoomOut: () =>
    set((state) => ({
      zoom: Math.max(CONSTRAINTS.ZOOM_MIN, state.zoom - CONSTRAINTS.ZOOM_STEP),
    })),

  // Visibility actions
  toggleShowOtherLayers: () =>
    set((state) => ({
      showOtherLayers: !state.showOtherLayers,
    })),

  // Panel actions
  toggleLeftPanel: () =>
    set((state) => ({
      leftPanelCollapsed: !state.leftPanelCollapsed,
    })),

  toggleRightPanel: () =>
    set((state) => ({
      rightPanelCollapsed: !state.rightPanelCollapsed,
    })),

  // Context menu actions
  showContextMenu: (binIdsOrId, position, source = 'grid') => {
    const binIds = Array.isArray(binIdsOrId) ? binIdsOrId : [binIdsOrId];
    set({
      contextMenu: {
        binIds,
        position,
        source,
      },
    });
  },
  hideContextMenu: () => set({ contextMenu: null }),

  // Highlighting actions
  setHighlightedCategoryId: (categoryId) => set({ highlightedCategoryId: categoryId }),
  setHighlightedRowLabel: (row) => set({ highlightedRowLabel: row }),
  setHighlightedColLabel: (col) => set({ highlightedColLabel: col }),

  // Modal actions
  setPrintModalOpen: (open) => set({ printModalOpen: open }),
  setShowLayoutManager: (show) => set({ showLayoutManager: show }),

  // 3D Preview actions
  toggleIsometricPreview: () =>
    set((state) => ({
      showIsometricPreview: !state.showIsometricPreview,
    })),
  setIsometricRotation: (rotation) =>
    set({
      isometricRotation: ((rotation % 360) + 360) % 360, // Normalize to 0-360
    }),
  setLayerViewMode: (mode) => set({ layerViewMode: mode }),
  snapToIsometric: () =>
    set((state) => {
      // Snap to nearest 90° angle
      const snapped = Math.round(state.isometricRotation / 90) * 90;
      return { isometricRotation: snapped % 360 };
    }),
  togglePreviewExpanded: () =>
    set((state) => ({
      isPreviewExpanded: !state.isPreviewExpanded,
    })),
  setPreviewExpanded: (expanded) => set({ isPreviewExpanded: expanded }),
}));
