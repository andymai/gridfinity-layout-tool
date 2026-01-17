import { create } from 'zustand';
import { CONSTRAINTS } from '../constants';
import { clamp } from '../../utils/validation';

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
  binIds: string[];
  position: { x: number; y: number };
  source: 'grid' | 'staging';
}

interface ViewState {
  // Zoom
  zoom: number;

  // Visibility toggles
  showOtherLayers: boolean;
  showLabels: boolean;

  // Desktop panel states
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;

  // Context menu
  contextMenu: ContextMenuState | null;

  // Highlighting (for hover preview)
  highlightedCategoryId: string | null;
  highlightedRowLabel: number | null; // 1-indexed row number
  highlightedColLabel: number | null; // 1-indexed column number

  // Modals
  printModalOpen: boolean;
}

interface ViewActions {
  // Zoom
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Visibility
  toggleShowOtherLayers: () => void;
  toggleShowLabels: () => void;

  // Panels
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Context menu (backwards compatible - accepts single ID or array)
  showContextMenu: (
    binIdsOrId: string | string[],
    position: { x: number; y: number },
    source?: 'grid' | 'staging'
  ) => void;
  hideContextMenu: () => void;

  // Highlighting
  setHighlightedCategoryId: (categoryId: string | null) => void;
  setHighlightedRowLabel: (row: number | null) => void;
  setHighlightedColLabel: (col: number | null) => void;

  // Modals
  setPrintModalOpen: (open: boolean) => void;
}

export type ViewStore = ViewState & ViewActions;

export const useViewStore = create<ViewStore>((set) => ({
  // Initial state
  zoom: 1,
  showOtherLayers: true,
  showLabels: true,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  contextMenu: null,
  highlightedCategoryId: null,
  highlightedRowLabel: null,
  highlightedColLabel: null,
  printModalOpen: false,

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

  toggleShowLabels: () =>
    set((state) => ({
      showLabels: !state.showLabels,
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
  setHighlightedCategoryId: (categoryId) =>
    set({ highlightedCategoryId: categoryId }),
  setHighlightedRowLabel: (row) => set({ highlightedRowLabel: row }),
  setHighlightedColLabel: (col) => set({ highlightedColLabel: col }),

  // Modal actions
  setPrintModalOpen: (open) => set({ printModalOpen: open }),
}));
