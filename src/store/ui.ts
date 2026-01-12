import { create } from 'zustand';
import type { Interaction, Layout, OperationResult } from '../types';
import { CONSTRAINTS } from '../constants';
import { clamp } from '../utils/validation';
import { validateHalfBinModeToggle } from '../utils/halfBinConstraints';
import { useLayoutStore } from './layout';

// Storage key for half-bin mode preference
const HALF_BIN_MODE_KEY = 'gridfinity-half-bin-mode';

// Load half-bin mode from localStorage (default to false)
function loadHalfBinMode(): boolean {
  try {
    return localStorage.getItem(HALF_BIN_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Save half-bin mode to localStorage
function saveHalfBinMode(enabled: boolean): void {
  try {
    localStorage.setItem(HALF_BIN_MODE_KEY, enabled.toString());
  } catch {
    // Ignore storage errors
  }
}

export type DropTarget = 'trash' | 'staging' | null;

export type MobilePanel = 'layers' | 'inspector' | 'categories' | 'print' | 'settings' | 'layouts' | null;

export type LayerViewMode = 'focus' | 'stack' | 'all';

export interface PaintSize {
  width: number;
  depth: number;
}

export interface ContextMenuState {
  binId: string;
  position: { x: number; y: number };
}

interface UIState {
  // Selection
  activeLayerId: string;
  selectedBinIds: string[];
  activeCategoryId: string;

  // View
  zoom: number;
  showOtherLayers: boolean;
  showLabels: boolean;

  // Panel visibility
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;

  // Interaction
  interaction: Interaction | null;
  dropTarget: DropTarget;

  // Paint mode
  paintSize: PaintSize | null;

  // Mobile
  activeMobilePanel: MobilePanel;

  // Context menu (for long-press on mobile)
  contextMenu: ContextMenuState | null;

  // Isometric preview
  showIsometricPreview: boolean;
  isometricRotation: number; // Horizontal rotation degrees, 0-360
  layerViewMode: LayerViewMode; // 'focus' (active only), 'stack' (active+below), 'all'
  isPreviewExpanded: boolean; // Expanded modal view

  // Keyboard navigation
  focusedBinId: string | null; // Bin with keyboard focus (separate from selection)
  keyboardDragMode: boolean; // In keyboard drag mode (M key)
  keyboardResizeMode: boolean; // In keyboard resize mode (R key)
  liveMessage: string | null; // Message for screen reader announcements

  // Quick label popover (desktop double-click or L key)
  quickLabelBinId: string | null;

  // Category highlighting (for hover preview)
  highlightedCategoryId: string | null;

  // Half-bin mode (power user feature for 0.5 unit increments)
  halfBinMode: boolean;

  // Shared layout preview (viewing but not saved)
  sharedLayoutPreview: Layout | null;
  sharedLayoutOriginalName: string | null; // For forkedFrom metadata
  sharedLayoutAuthorName: string | null;  // Author of cloud-shared layout

  // Actions
  setActiveLayer: (id: string) => void;
  setSelectedBin: (id: string | null) => void; // Single select (clears others)
  setSelectedBins: (ids: string[]) => void; // Set multiple
  addToSelection: (id: string) => void; // Add to existing selection
  removeFromSelection: (id: string) => void; // Remove from selection
  toggleSelection: (id: string) => void; // Toggle single bin in selection
  setActiveCategory: (id: string) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleShowOtherLayers: () => void;
  toggleShowLabels: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Interaction actions
  setInteraction: (interaction: Interaction | null) => void;
  setDropTarget: (target: DropTarget) => void;
  clearSelection: () => void;

  // Paint mode actions
  setPaintSize: (size: PaintSize | null) => void;
  togglePaintSize: (size: PaintSize) => void;

  // Mobile panel actions
  setActiveMobilePanel: (panel: MobilePanel) => void;
  closeMobilePanel: () => void;
  toggleMobilePanel: (panel: MobilePanel) => void;

  // Context menu actions
  showContextMenu: (binId: string, position: { x: number; y: number }) => void;
  hideContextMenu: () => void;

  // Isometric preview actions
  toggleIsometricPreview: () => void;
  setIsometricRotation: (rotation: number) => void;
  setLayerViewMode: (mode: LayerViewMode) => void;
  snapToIsometric: () => void; // Snap to nearest 90°
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;

  // Keyboard navigation actions
  setFocusedBin: (binId: string | null) => void;
  setKeyboardDragMode: (enabled: boolean) => void;
  setKeyboardResizeMode: (enabled: boolean) => void;
  announceToScreenReader: (message: string) => void;

  // Quick label actions
  showQuickLabel: (binId: string) => void;
  hideQuickLabel: () => void;

  // Category highlighting actions
  setHighlightedCategoryId: (categoryId: string | null) => void;

  // Half-bin mode actions
  toggleHalfBinMode: () => OperationResult<void>;
  setHalfBinMode: (enabled: boolean) => void;

  // Shared layout preview actions
  setSharedLayoutPreview: (layout: Layout | null, originalName?: string, authorName?: string) => void;
  clearSharedLayoutPreview: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeLayerId: '',
  selectedBinIds: [],
  activeCategoryId: 'coral',
  zoom: 1,
  showOtherLayers: true,
  showLabels: true,
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  interaction: null,
  dropTarget: null,
  paintSize: null,
  activeMobilePanel: null,
  contextMenu: null,
  showIsometricPreview: false,
  isometricRotation: 0,
  layerViewMode: 'stack', // Default: show active layer and below
  isPreviewExpanded: false,
  focusedBinId: null,
  keyboardDragMode: false,
  keyboardResizeMode: false,
  liveMessage: null,
  quickLabelBinId: null,
  highlightedCategoryId: null,
  halfBinMode: loadHalfBinMode(),
  sharedLayoutPreview: null,
  sharedLayoutOriginalName: null,
  sharedLayoutAuthorName: null,

  setActiveLayer: (id) => set({
    activeLayerId: id,
    selectedBinIds: [] // Clear selection on layer change (PRD: selection is layer-scoped)
  }),

  // Single select - clears other selections
  setSelectedBin: (id) => set({ selectedBinIds: id ? [id] : [] }),

  // Set multiple bins as selected
  setSelectedBins: (ids) => set({ selectedBinIds: ids }),

  // Add a bin to existing selection
  addToSelection: (id) => set(state => ({
    selectedBinIds: state.selectedBinIds.includes(id)
      ? state.selectedBinIds
      : [...state.selectedBinIds, id]
  })),

  // Remove a bin from selection
  removeFromSelection: (id) => set(state => ({
    selectedBinIds: state.selectedBinIds.filter(binId => binId !== id)
  })),

  // Toggle a bin in selection (for Ctrl/Cmd+click)
  toggleSelection: (id) => set(state => ({
    selectedBinIds: state.selectedBinIds.includes(id)
      ? state.selectedBinIds.filter(binId => binId !== id)
      : [...state.selectedBinIds, id]
  })),

  setActiveCategory: (id) => set({ activeCategoryId: id }),

  setZoom: (zoom) => set({
    zoom: clamp(zoom, CONSTRAINTS.ZOOM_MIN, CONSTRAINTS.ZOOM_MAX)
  }),

  zoomIn: () => set(state => ({
    zoom: Math.min(CONSTRAINTS.ZOOM_MAX, state.zoom + CONSTRAINTS.ZOOM_STEP)
  })),

  zoomOut: () => set(state => ({
    zoom: Math.max(CONSTRAINTS.ZOOM_MIN, state.zoom - CONSTRAINTS.ZOOM_STEP)
  })),

  toggleShowOtherLayers: () => set(state => ({
    showOtherLayers: !state.showOtherLayers
  })),

  toggleShowLabels: () => set(state => ({
    showLabels: !state.showLabels
  })),

  toggleLeftPanel: () => set(state => ({
    leftPanelCollapsed: !state.leftPanelCollapsed,
  })),

  toggleRightPanel: () => set(state => ({
    rightPanelCollapsed: !state.rightPanelCollapsed,
  })),

  setInteraction: (interaction) => set({ interaction }),

  setDropTarget: (target) => set({ dropTarget: target }),

  clearSelection: () => set({ selectedBinIds: [], interaction: null }),

  setPaintSize: (size) => set({ paintSize: size }),

  togglePaintSize: (size) => set(state => ({
    paintSize: state.paintSize?.width === size.width && state.paintSize?.depth === size.depth
      ? null
      : size
  })),

  // Mobile panel actions
  setActiveMobilePanel: (panel) => set({ activeMobilePanel: panel }),

  closeMobilePanel: () => set({ activeMobilePanel: null }),

  toggleMobilePanel: (panel) => set(state => ({
    activeMobilePanel: state.activeMobilePanel === panel ? null : panel
  })),

  // Context menu actions
  showContextMenu: (binId, position) => set({ contextMenu: { binId, position } }),
  hideContextMenu: () => set({ contextMenu: null }),

  // Isometric preview actions
  toggleIsometricPreview: () => set(state => ({
    showIsometricPreview: !state.showIsometricPreview
  })),
  setIsometricRotation: (rotation) => set({
    isometricRotation: ((rotation % 360) + 360) % 360 // Normalize to 0-360
  }),
  setLayerViewMode: (mode) => set({ layerViewMode: mode }),
  snapToIsometric: () => set(state => {
    // Snap to nearest 90° angle
    const snapped = Math.round(state.isometricRotation / 90) * 90;
    return { isometricRotation: snapped % 360 };
  }),
  togglePreviewExpanded: () => set(state => ({
    isPreviewExpanded: !state.isPreviewExpanded
  })),
  setPreviewExpanded: (expanded) => set({ isPreviewExpanded: expanded }),

  // Keyboard navigation actions
  setFocusedBin: (binId) => set({ focusedBinId: binId }),
  setKeyboardDragMode: (enabled) => set({
    keyboardDragMode: enabled,
    // Exit resize mode when entering drag mode
    keyboardResizeMode: enabled ? false : undefined,
  }),
  setKeyboardResizeMode: (enabled) => set({
    keyboardResizeMode: enabled,
    // Exit drag mode when entering resize mode
    keyboardDragMode: enabled ? false : undefined,
  }),
  announceToScreenReader: (message) => {
    set({ liveMessage: message });
    // Clear after 1 second to allow repeat announcements of the same message
    setTimeout(() => {
      set({ liveMessage: null });
    }, 1000);
  },

  // Quick label actions
  showQuickLabel: (binId) => set({ quickLabelBinId: binId }),
  hideQuickLabel: () => set({ quickLabelBinId: null }),

  // Category highlighting actions
  setHighlightedCategoryId: (categoryId) => set({ highlightedCategoryId: categoryId }),

  // Half-bin mode actions
  toggleHalfBinMode: () => {
    const state = useUIStore.getState();
    const targetState = !state.halfBinMode;

    // Turning ON: no validation needed
    if (targetState === true) {
      saveHalfBinMode(true);
      set({ halfBinMode: true });
      return { success: true };
    }

    // Turning OFF: validate layout for fractional bins
    const layout = useLayoutStore.getState().layout;
    const result = validateHalfBinModeToggle(layout, false);

    if (!result.canDisable) {
      return {
        success: false,
        error: 'Cannot disable half-bin mode while bins with fractional dimensions exist',
      };
    }

    saveHalfBinMode(false);
    set({ halfBinMode: false });
    return { success: true };
  },
  setHalfBinMode: (enabled) => {
    saveHalfBinMode(enabled);
    set({ halfBinMode: enabled });
  },

  // Shared layout preview actions
  setSharedLayoutPreview: (layout, originalName, authorName) => set({
    sharedLayoutPreview: layout,
    sharedLayoutOriginalName: originalName ?? layout?.name ?? null,
    sharedLayoutAuthorName: authorName ?? null,
  }),
  clearSharedLayoutPreview: () => set({
    sharedLayoutPreview: null,
    sharedLayoutOriginalName: null,
    sharedLayoutAuthorName: null,
  }),
}));
