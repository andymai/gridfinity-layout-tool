/**
 * UI Store - Legacy Facade
 *
 * This store was refactored into focused stores for better separation of concerns:
 * - useSelectionStore: selection, focus, active layer/category
 * - useViewStore: zoom, panels, context menu, highlighting
 * - useInteractionStore: interactions, paint mode, keyboard modes, 3D preview
 * - useMobileStore: mobile panel state
 * - useHalfBinModeStore: half-bin mode setting
 * - useSharedPreviewStore: shared layout preview
 *
 * This facade maintains backwards compatibility by delegating to the new stores.
 * New code should import from the specific stores directly.
 *
 * @deprecated Import from specific stores instead:
 * - Selection: import { useSelectionStore } from '@/core/store/selection'
 * - View: import { useViewStore } from '@/core/store/view'
 * - Interaction: import { useInteractionStore } from '@/core/store/interaction'
 * - Mobile: import { useMobileStore } from '@/core/store/mobile'
 * - HalfBinMode: import { useHalfBinModeStore } from '@/core/store/halfBinMode'
 * - SharedPreview: import { useSharedPreviewStore } from '@/core/store/sharedPreview'
 */

import { create } from 'zustand';
import type { Interaction, Layout, OperationResult } from '@/core/types';
import type { Result, Unit, LayoutError } from '@/core/result';
import { useSelectionStore } from './selection';
import { useViewStore, type ContextMenuState } from './view';
import { useInteractionStore, type DropTarget, type PaintSize, type LayerViewMode } from './interaction';
import { useMobileStore, type MobilePanel, type MobileLayersTab } from './mobile';
import { useHalfBinModeStore } from './halfBinMode';
import { useSharedPreviewStore } from './sharedPreview';

// Re-export types for backwards compatibility
export type { DropTarget, MobilePanel, MobileLayersTab, LayerViewMode, PaintSize, ContextMenuState };

interface UIState {
  // Selection (delegated to useSelectionStore)
  activeLayerId: string;
  selectedBinIds: string[];
  activeCategoryId: string;
  focusedBinId: string | null;
  quickLabelBinId: string | null;

  // View (delegated to useViewStore)
  zoom: number;
  showOtherLayers: boolean;
  showLabels: boolean;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  contextMenu: ContextMenuState | null;
  highlightedCategoryId: string | null;
  highlightedRowLabel: number | null;
  highlightedColLabel: number | null;
  printModalOpen: boolean;

  // Interaction (delegated to useInteractionStore)
  interaction: Interaction | null;
  dropTarget: DropTarget;
  paintSize: PaintSize | null;
  keyboardDragMode: boolean;
  keyboardResizeMode: boolean;
  liveMessage: string | null;
  showIsometricPreview: boolean;
  isometricRotation: number;
  layerViewMode: LayerViewMode;
  isPreviewExpanded: boolean;

  // Mobile (delegated to useMobileStore)
  activeMobilePanel: MobilePanel;
  mobileLayersTab: MobileLayersTab;

  // Half-bin mode (delegated to useHalfBinModeStore)
  halfBinMode: boolean;

  // Shared preview (delegated to useSharedPreviewStore)
  sharedLayoutPreview: Layout | null;
  sharedLayoutOriginalName: string | null;
  sharedLayoutAuthorName: string | null;
  sharedLayoutCloudShareId: string | null;
  sharedLayoutPermission: 'view' | 'edit' | null;

  // Selection actions
  setActiveLayer: (id: string) => void;
  setSelectedBin: (id: string | null) => void;
  setSelectedBins: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  toggleSelection: (id: string) => void;
  setActiveCategory: (id: string) => void;
  clearSelection: () => void;
  setFocusedBin: (binId: string | null) => void;
  showQuickLabel: (binId: string) => void;
  hideQuickLabel: () => void;

  // View actions
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleShowOtherLayers: () => void;
  toggleShowLabels: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  showContextMenu: (binIdsOrId: string | string[], position: { x: number; y: number }, source?: 'grid' | 'staging') => void;
  hideContextMenu: () => void;
  setHighlightedCategoryId: (categoryId: string | null) => void;
  setHighlightedRowLabel: (row: number | null) => void;
  setHighlightedColLabel: (col: number | null) => void;
  setPrintModalOpen: (open: boolean) => void;

  // Interaction actions
  setInteraction: (interaction: Interaction | null) => void;
  setDropTarget: (target: DropTarget) => void;
  setPaintSize: (size: PaintSize | null) => void;
  togglePaintSize: (size: PaintSize) => void;
  setKeyboardDragMode: (enabled: boolean) => void;
  setKeyboardResizeMode: (enabled: boolean) => void;
  announceToScreenReader: (message: string) => void;
  toggleIsometricPreview: () => void;
  setIsometricRotation: (rotation: number) => void;
  setLayerViewMode: (mode: LayerViewMode) => void;
  snapToIsometric: () => void;
  togglePreviewExpanded: () => void;
  setPreviewExpanded: (expanded: boolean) => void;

  // Mobile actions
  setActiveMobilePanel: (panel: MobilePanel) => void;
  closeMobilePanel: () => void;
  toggleMobilePanel: (panel: MobilePanel) => void;
  setMobileLayersTab: (tab: MobileLayersTab) => void;

  // Half-bin mode actions
  toggleHalfBinMode: () => OperationResult<void>;
  toggleHalfBinModeResult: () => Result<Unit, LayoutError>;
  setHalfBinMode: (enabled: boolean) => void;

  // Shared preview actions
  setSharedLayoutPreview: (layout: Layout | null, originalName?: string, authorName?: string, cloudShareId?: string, permission?: 'view' | 'edit') => void;
  clearSharedLayoutPreview: () => void;
}

/**
 * Helper to get current combined state from all stores
 */
function getCombinedState(): Omit<UIState,
  'setActiveLayer' | 'setSelectedBin' | 'setSelectedBins' | 'addToSelection' |
  'removeFromSelection' | 'toggleSelection' | 'setActiveCategory' | 'clearSelection' |
  'setFocusedBin' | 'showQuickLabel' | 'hideQuickLabel' | 'setZoom' | 'zoomIn' | 'zoomOut' |
  'toggleShowOtherLayers' | 'toggleShowLabels' | 'toggleLeftPanel' | 'toggleRightPanel' |
  'showContextMenu' | 'hideContextMenu' | 'setHighlightedCategoryId' | 'setHighlightedRowLabel' |
  'setHighlightedColLabel' | 'setPrintModalOpen' | 'setInteraction' | 'setDropTarget' |
  'setPaintSize' | 'togglePaintSize' | 'setKeyboardDragMode' | 'setKeyboardResizeMode' |
  'announceToScreenReader' | 'toggleIsometricPreview' | 'setIsometricRotation' | 'setLayerViewMode' |
  'snapToIsometric' | 'togglePreviewExpanded' | 'setPreviewExpanded' | 'setActiveMobilePanel' |
  'closeMobilePanel' | 'toggleMobilePanel' | 'setMobileLayersTab' | 'toggleHalfBinMode' |
  'toggleHalfBinModeResult' | 'setHalfBinMode' | 'setSharedLayoutPreview' | 'clearSharedLayoutPreview'
> {
  const selection = useSelectionStore.getState();
  const view = useViewStore.getState();
  const interaction = useInteractionStore.getState();
  const mobile = useMobileStore.getState();
  const halfBin = useHalfBinModeStore.getState();
  const sharedPreview = useSharedPreviewStore.getState();

  return {
    // Selection
    activeLayerId: selection.activeLayerId,
    selectedBinIds: selection.selectedBinIds,
    activeCategoryId: selection.activeCategoryId,
    focusedBinId: selection.focusedBinId,
    quickLabelBinId: selection.quickLabelBinId,
    // View
    zoom: view.zoom,
    showOtherLayers: view.showOtherLayers,
    showLabels: view.showLabels,
    leftPanelCollapsed: view.leftPanelCollapsed,
    rightPanelCollapsed: view.rightPanelCollapsed,
    contextMenu: view.contextMenu,
    highlightedCategoryId: view.highlightedCategoryId,
    highlightedRowLabel: view.highlightedRowLabel,
    highlightedColLabel: view.highlightedColLabel,
    printModalOpen: view.printModalOpen,
    // Interaction
    interaction: interaction.interaction,
    dropTarget: interaction.dropTarget,
    paintSize: interaction.paintSize,
    keyboardDragMode: interaction.keyboardDragMode,
    keyboardResizeMode: interaction.keyboardResizeMode,
    liveMessage: interaction.liveMessage,
    showIsometricPreview: interaction.showIsometricPreview,
    isometricRotation: interaction.isometricRotation,
    layerViewMode: interaction.layerViewMode,
    isPreviewExpanded: interaction.isPreviewExpanded,
    // Mobile
    activeMobilePanel: mobile.activeMobilePanel,
    mobileLayersTab: mobile.mobileLayersTab,
    // Half-bin mode
    halfBinMode: halfBin.halfBinMode,
    // Shared preview
    sharedLayoutPreview: sharedPreview.sharedLayoutPreview,
    sharedLayoutOriginalName: sharedPreview.sharedLayoutOriginalName,
    sharedLayoutAuthorName: sharedPreview.sharedLayoutAuthorName,
    sharedLayoutCloudShareId: sharedPreview.sharedLayoutCloudShareId,
    sharedLayoutPermission: sharedPreview.sharedLayoutPermission,
  };
}

/**
 * Combined UI Store (Legacy Facade)
 *
 * This store reads from and writes to the new focused stores, maintaining
 * backwards compatibility for existing consumers.
 *
 * @deprecated Use specific stores directly for better performance and clearer code.
 */
export const useUIStore = create<UIState>((_set) => ({
  // Initial state from underlying stores
  ...getCombinedState(),

  // Selection actions (delegate to useSelectionStore)
  setActiveLayer: (id) => {
    useSelectionStore.getState().setActiveLayer(id);
  },
  setSelectedBin: (id) => {
    useSelectionStore.getState().setSelectedBin(id);
  },
  setSelectedBins: (ids) => {
    useSelectionStore.getState().setSelectedBins(ids);
  },
  addToSelection: (id) => {
    useSelectionStore.getState().addToSelection(id);
  },
  removeFromSelection: (id) => {
    useSelectionStore.getState().removeFromSelection(id);
  },
  toggleSelection: (id) => {
    useSelectionStore.getState().toggleSelection(id);
  },
  setActiveCategory: (id) => {
    useSelectionStore.getState().setActiveCategory(id);
  },
  clearSelection: () => {
    useSelectionStore.getState().clearSelection();
    useInteractionStore.getState().setInteraction(null);
  },
  setFocusedBin: (binId) => {
    useSelectionStore.getState().setFocusedBin(binId);
  },
  showQuickLabel: (binId) => {
    useSelectionStore.getState().showQuickLabel(binId);
  },
  hideQuickLabel: () => {
    useSelectionStore.getState().hideQuickLabel();
  },

  // View actions (delegate to useViewStore)
  setZoom: (zoom) => {
    useViewStore.getState().setZoom(zoom);
  },
  zoomIn: () => {
    useViewStore.getState().zoomIn();
  },
  zoomOut: () => {
    useViewStore.getState().zoomOut();
  },
  toggleShowOtherLayers: () => {
    useViewStore.getState().toggleShowOtherLayers();
  },
  toggleShowLabels: () => {
    useViewStore.getState().toggleShowLabels();
  },
  toggleLeftPanel: () => {
    useViewStore.getState().toggleLeftPanel();
  },
  toggleRightPanel: () => {
    useViewStore.getState().toggleRightPanel();
  },
  showContextMenu: (binIdsOrId, position, source) => {
    useViewStore.getState().showContextMenu(binIdsOrId, position, source);
  },
  hideContextMenu: () => {
    useViewStore.getState().hideContextMenu();
  },
  setHighlightedCategoryId: (categoryId) => {
    useViewStore.getState().setHighlightedCategoryId(categoryId);
  },
  setHighlightedRowLabel: (row) => {
    useViewStore.getState().setHighlightedRowLabel(row);
  },
  setHighlightedColLabel: (col) => {
    useViewStore.getState().setHighlightedColLabel(col);
  },
  setPrintModalOpen: (open) => {
    useViewStore.getState().setPrintModalOpen(open);
  },

  // Interaction actions (delegate to useInteractionStore)
  setInteraction: (interaction) => {
    useInteractionStore.getState().setInteraction(interaction);
  },
  setDropTarget: (target) => {
    useInteractionStore.getState().setDropTarget(target);
  },
  setPaintSize: (size) => {
    useInteractionStore.getState().setPaintSize(size);
  },
  togglePaintSize: (size) => {
    useInteractionStore.getState().togglePaintSize(size);
  },
  setKeyboardDragMode: (enabled) => {
    useInteractionStore.getState().setKeyboardDragMode(enabled);
  },
  setKeyboardResizeMode: (enabled) => {
    useInteractionStore.getState().setKeyboardResizeMode(enabled);
  },
  announceToScreenReader: (message) => {
    useInteractionStore.getState().announceToScreenReader(message);
  },
  toggleIsometricPreview: () => {
    useInteractionStore.getState().toggleIsometricPreview();
  },
  setIsometricRotation: (rotation) => {
    useInteractionStore.getState().setIsometricRotation(rotation);
  },
  setLayerViewMode: (mode) => {
    useInteractionStore.getState().setLayerViewMode(mode);
  },
  snapToIsometric: () => {
    useInteractionStore.getState().snapToIsometric();
  },
  togglePreviewExpanded: () => {
    useInteractionStore.getState().togglePreviewExpanded();
  },
  setPreviewExpanded: (expanded) => {
    useInteractionStore.getState().setPreviewExpanded(expanded);
  },

  // Mobile actions (delegate to useMobileStore)
  setActiveMobilePanel: (panel) => {
    useMobileStore.getState().setActiveMobilePanel(panel);
  },
  closeMobilePanel: () => {
    useMobileStore.getState().closeMobilePanel();
  },
  toggleMobilePanel: (panel) => {
    useMobileStore.getState().toggleMobilePanel(panel);
  },
  setMobileLayersTab: (tab) => {
    useMobileStore.getState().setMobileLayersTab(tab);
  },

  // Half-bin mode actions (delegate to useHalfBinModeStore)
  toggleHalfBinMode: () => {
    return useHalfBinModeStore.getState().toggleHalfBinMode();
  },
  toggleHalfBinModeResult: () => {
    return useHalfBinModeStore.getState().toggleHalfBinModeResult();
  },
  setHalfBinMode: (enabled) => {
    useHalfBinModeStore.getState().setHalfBinMode(enabled);
  },

  // Shared preview actions (delegate to useSharedPreviewStore)
  setSharedLayoutPreview: (layout, originalName, authorName, cloudShareId, permission) => {
    useSharedPreviewStore.getState().setSharedLayoutPreview(layout, originalName, authorName, cloudShareId, permission);
  },
  clearSharedLayoutPreview: () => {
    useSharedPreviewStore.getState().clearSharedLayoutPreview();
  },
}));

// Subscribe to changes in all underlying stores and sync to useUIStore
// This ensures components using useUIStore re-render when underlying state changes
//
// PERFORMANCE NOTE: This cascade causes ALL useUIStore consumers to re-render
// when ANY underlying store changes. For hot-path components (Bin.tsx, Overlay.tsx),
// import from focused stores directly to bypass this overhead:
//   import { useSelectionStore, useViewStore, useInteractionStore } from '@/core/store';
useSelectionStore.subscribe(() => {
  useUIStore.setState(getCombinedState());
});
useViewStore.subscribe(() => {
  useUIStore.setState(getCombinedState());
});
useInteractionStore.subscribe(() => {
  useUIStore.setState(getCombinedState());
});
useMobileStore.subscribe(() => {
  useUIStore.setState(getCombinedState());
});
useHalfBinModeStore.subscribe(() => {
  useUIStore.setState(getCombinedState());
});
useSharedPreviewStore.subscribe(() => {
  useUIStore.setState(getCombinedState());
});
