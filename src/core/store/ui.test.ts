import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUIStore } from '@/core/store/ui';
import { useLayoutStore } from '@/core/store/layout';
import {
  useSelectionStore,
  useViewStore,
  useInteractionStore,
  useMobileStore,
  useHalfBinModeStore,
  useSharedPreviewStore,
} from '@/core/store';
import { CONSTRAINTS } from '@/core/constants';
import { resetAllStores, expectOk, expectErr } from '@/test/testUtils';

// Helper to get state from the correct focused store after facade actions
// Since the facade no longer syncs state synchronously, we need to read from the source stores
const getSelectionState = () => useSelectionStore.getState();
const getViewState = () => useViewStore.getState();
const getInteractionState = () => useInteractionStore.getState();
const getMobileState = () => useMobileStore.getState();
const getHalfBinModeState = () => useHalfBinModeStore.getState();
const getSharedPreviewState = () => useSharedPreviewStore.getState();

describe('ui store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('selection', () => {
    it('setActiveLayer changes active layer and clears selection', () => {
      const { setActiveLayer, addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      addToSelection('bin2');
      expect(getSelectionState().selectedBinIds).toHaveLength(2);

      setActiveLayer('layer2');

      const state = getSelectionState();
      expect(state.activeLayerId).toBe('layer2');
      expect(state.selectedBinIds).toHaveLength(0);
    });

    it('setSelectedBin sets single selection', () => {
      const { setSelectedBin, addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      addToSelection('bin2');

      setSelectedBin('bin3');

      expect(getSelectionState().selectedBinIds).toEqual(['bin3']);
    });

    it('setSelectedBin with null clears selection', () => {
      const { setSelectedBin, addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      setSelectedBin(null);

      expect(getSelectionState().selectedBinIds).toHaveLength(0);
    });

    it('setSelectedBins sets multiple selection', () => {
      const { setSelectedBins } = useUIStore.getState();

      setSelectedBins(['bin1', 'bin2', 'bin3']);

      expect(getSelectionState().selectedBinIds).toEqual(['bin1', 'bin2', 'bin3']);
    });

    it('addToSelection adds without duplicates', () => {
      const { addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      addToSelection('bin1'); // Duplicate
      addToSelection('bin2');

      expect(getSelectionState().selectedBinIds).toEqual(['bin1', 'bin2']);
    });

    it('removeFromSelection removes specific bin', () => {
      const { setSelectedBins, removeFromSelection } = useUIStore.getState();

      setSelectedBins(['bin1', 'bin2', 'bin3']);
      removeFromSelection('bin2');

      expect(getSelectionState().selectedBinIds).toEqual(['bin1', 'bin3']);
    });

    it('toggleSelection toggles bin in selection', () => {
      const { toggleSelection, addToSelection } = useUIStore.getState();

      addToSelection('bin1');

      toggleSelection('bin2');
      expect(getSelectionState().selectedBinIds).toContain('bin2');

      toggleSelection('bin1');
      expect(getSelectionState().selectedBinIds).not.toContain('bin1');
    });

    it('clearSelection clears selection and interaction', () => {
      const { addToSelection, setInteraction, clearSelection } = useUIStore.getState();

      addToSelection('bin1');
      setInteraction({ type: 'draw', start: { x: 0, y: 0 }, current: { x: 0, y: 0 } });

      clearSelection();

      expect(getSelectionState().selectedBinIds).toHaveLength(0);
      expect(getInteractionState().interaction).toBeNull();
    });
  });

  describe('zoom', () => {
    it('setZoom sets zoom level', () => {
      const { setZoom } = useUIStore.getState();

      setZoom(2);
      expect(getViewState().zoom).toBe(2);
    });

    it('setZoom clamps to min/max', () => {
      const { setZoom } = useUIStore.getState();

      setZoom(0.1); // Below min
      expect(getViewState().zoom).toBe(CONSTRAINTS.ZOOM_MIN);

      setZoom(10); // Above max
      expect(getViewState().zoom).toBe(CONSTRAINTS.ZOOM_MAX);
    });

    it('zoomIn increases zoom by step', () => {
      const { setZoom, zoomIn } = useUIStore.getState();

      setZoom(1);
      zoomIn();

      expect(getViewState().zoom).toBe(1 + CONSTRAINTS.ZOOM_STEP);
    });

    it('zoomOut decreases zoom by step', () => {
      const { setZoom, zoomOut } = useUIStore.getState();

      setZoom(1);
      zoomOut();

      expect(getViewState().zoom).toBe(1 - CONSTRAINTS.ZOOM_STEP);
    });

    it('zoomIn respects max limit', () => {
      const { setZoom, zoomIn } = useUIStore.getState();

      setZoom(CONSTRAINTS.ZOOM_MAX);
      zoomIn();

      expect(getViewState().zoom).toBe(CONSTRAINTS.ZOOM_MAX);
    });

    it('zoomOut respects min limit', () => {
      const { setZoom, zoomOut } = useUIStore.getState();

      setZoom(CONSTRAINTS.ZOOM_MIN);
      zoomOut();

      expect(getViewState().zoom).toBe(CONSTRAINTS.ZOOM_MIN);
    });
  });

  describe('panel toggles', () => {
    it('toggleShowOtherLayers toggles state', () => {
      const { toggleShowOtherLayers } = useUIStore.getState();

      expect(getViewState().showOtherLayers).toBe(true);
      toggleShowOtherLayers();
      expect(getViewState().showOtherLayers).toBe(false);
      toggleShowOtherLayers();
      expect(getViewState().showOtherLayers).toBe(true);
    });

    it('toggleLeftPanel toggles collapsed state', () => {
      const { toggleLeftPanel } = useUIStore.getState();

      expect(getViewState().leftPanelCollapsed).toBe(false);
      toggleLeftPanel();
      expect(getViewState().leftPanelCollapsed).toBe(true);
    });

    it('toggleRightPanel toggles collapsed state', () => {
      const { toggleRightPanel } = useUIStore.getState();

      expect(getViewState().rightPanelCollapsed).toBe(false);
      toggleRightPanel();
      expect(getViewState().rightPanelCollapsed).toBe(true);
    });
  });

  describe('paint mode', () => {
    it('setPaintSize sets paint size', () => {
      const { setPaintSize } = useUIStore.getState();

      setPaintSize({ width: 2, depth: 3 });

      expect(getInteractionState().paintSize).toEqual({ width: 2, depth: 3 });
    });

    it('setPaintSize with null clears paint mode', () => {
      const { setPaintSize } = useUIStore.getState();

      setPaintSize({ width: 2, depth: 3 });
      setPaintSize(null);

      expect(getInteractionState().paintSize).toBeNull();
    });

    it('togglePaintSize toggles between sizes', () => {
      const { togglePaintSize } = useUIStore.getState();

      togglePaintSize({ width: 2, depth: 2 });
      expect(getInteractionState().paintSize).toEqual({ width: 2, depth: 2 });

      togglePaintSize({ width: 2, depth: 2 }); // Same size - should toggle off
      expect(getInteractionState().paintSize).toBeNull();

      togglePaintSize({ width: 3, depth: 3 }); // Different size - should toggle on
      expect(getInteractionState().paintSize).toEqual({ width: 3, depth: 3 });
    });
  });

  describe('mobile panel', () => {
    it('setActiveMobilePanel sets active panel', () => {
      const { setActiveMobilePanel } = useUIStore.getState();

      setActiveMobilePanel('layers');
      expect(getMobileState().activeMobilePanel).toBe('layers');
    });

    it('closeMobilePanel closes panel', () => {
      const { setActiveMobilePanel, closeMobilePanel } = useUIStore.getState();

      setActiveMobilePanel('layers');
      closeMobilePanel();

      expect(getMobileState().activeMobilePanel).toBeNull();
    });

    it('toggleMobilePanel toggles panel', () => {
      const { toggleMobilePanel } = useUIStore.getState();

      toggleMobilePanel('layers');
      expect(getMobileState().activeMobilePanel).toBe('layers');

      toggleMobilePanel('layers'); // Same panel - should close
      expect(getMobileState().activeMobilePanel).toBeNull();

      toggleMobilePanel('categories'); // Different panel - should open
      expect(getMobileState().activeMobilePanel).toBe('categories');
    });
  });

  describe('context menu', () => {
    it('showContextMenu sets context menu state', () => {
      const { showContextMenu } = useUIStore.getState();

      showContextMenu('bin1', { x: 100, y: 200 });

      const menu = getViewState().contextMenu;
      expect(menu?.binIds).toEqual(['bin1']);
      expect(menu?.position).toEqual({ x: 100, y: 200 });
    });

    it('hideContextMenu clears context menu', () => {
      const { showContextMenu, hideContextMenu } = useUIStore.getState();

      showContextMenu('bin1', { x: 100, y: 200 });
      hideContextMenu();

      expect(getViewState().contextMenu).toBeNull();
    });
  });

  describe('isometric preview', () => {
    it('toggleIsometricPreview toggles visibility', () => {
      const { toggleIsometricPreview } = useUIStore.getState();

      // resetAllStores() sets this to false (InteractionStore default)
      expect(getInteractionState().showIsometricPreview).toBe(false);
      toggleIsometricPreview();
      expect(getInteractionState().showIsometricPreview).toBe(true);
    });

    it('setIsometricRotation sets rotation', () => {
      const { setIsometricRotation } = useUIStore.getState();

      setIsometricRotation(45);
      expect(getInteractionState().isometricRotation).toBe(45);
    });

    it('setIsometricRotation normalizes to 0-360', () => {
      const { setIsometricRotation } = useUIStore.getState();

      setIsometricRotation(-90);
      expect(getInteractionState().isometricRotation).toBe(270);

      setIsometricRotation(450);
      expect(getInteractionState().isometricRotation).toBe(90);
    });

    it('snapToIsometric snaps to nearest 90 degrees', () => {
      const { setIsometricRotation, snapToIsometric } = useUIStore.getState();

      setIsometricRotation(35);
      snapToIsometric();
      expect(getInteractionState().isometricRotation).toBe(0);

      setIsometricRotation(55);
      snapToIsometric();
      expect(getInteractionState().isometricRotation).toBe(90);

      setIsometricRotation(130);
      snapToIsometric();
      expect(getInteractionState().isometricRotation).toBe(90);

      setIsometricRotation(320);
      snapToIsometric();
      expect(getInteractionState().isometricRotation).toBe(0);
    });

    it('setLayerViewMode changes layer view mode', () => {
      const { setLayerViewMode } = useUIStore.getState();

      // resetAllStores() sets this to 'stack' (InteractionStore default)
      expect(getInteractionState().layerViewMode).toBe('stack');
      setLayerViewMode('focus');
      expect(getInteractionState().layerViewMode).toBe('focus');
      setLayerViewMode('all');
      expect(getInteractionState().layerViewMode).toBe('all');
      setLayerViewMode('stack');
      expect(getInteractionState().layerViewMode).toBe('stack');
    });

    it('togglePreviewExpanded toggles expanded state', () => {
      const { togglePreviewExpanded } = useUIStore.getState();

      expect(getInteractionState().isPreviewExpanded).toBe(false);
      togglePreviewExpanded();
      expect(getInteractionState().isPreviewExpanded).toBe(true);
    });

    it('setPreviewExpanded sets expanded state', () => {
      const { setPreviewExpanded } = useUIStore.getState();

      setPreviewExpanded(true);
      expect(getInteractionState().isPreviewExpanded).toBe(true);

      setPreviewExpanded(false);
      expect(getInteractionState().isPreviewExpanded).toBe(false);
    });
  });

  describe('interaction', () => {
    it('setInteraction sets interaction state', () => {
      const { setInteraction } = useUIStore.getState();

      setInteraction({
        type: 'drag',
        binIds: ['bin1'],
        startCoord: { x: 0, y: 0 },
        currentCoord: { x: 0, y: 0 },
        valid: true,
        isOverGrid: true,
      });

      const interaction = getInteractionState().interaction;
      expect(interaction?.type).toBe('drag');
    });

    it('setDropTarget sets drop target', () => {
      const { setDropTarget } = useUIStore.getState();

      setDropTarget('trash');
      expect(getInteractionState().dropTarget).toBe('trash');

      setDropTarget('staging');
      expect(getInteractionState().dropTarget).toBe('staging');

      setDropTarget(null);
      expect(getInteractionState().dropTarget).toBeNull();
    });
  });

  describe('category', () => {
    it('setActiveCategory sets active category', () => {
      const { setActiveCategory } = useUIStore.getState();

      setActiveCategory('tools');
      expect(getSelectionState().activeCategoryId).toBe('tools');
    });
  });

  describe('row/column label highlighting', () => {
    it('initial state has null highlighted row and column', () => {
      expect(getViewState().highlightedRowLabel).toBeNull();
      expect(getViewState().highlightedColLabel).toBeNull();
    });

    it('setHighlightedRowLabel sets highlighted row', () => {
      const { setHighlightedRowLabel } = useUIStore.getState();

      setHighlightedRowLabel(3);
      expect(getViewState().highlightedRowLabel).toBe(3);

      setHighlightedRowLabel(5);
      expect(getViewState().highlightedRowLabel).toBe(5);
    });

    it('setHighlightedRowLabel with null clears highlight', () => {
      const { setHighlightedRowLabel } = useUIStore.getState();

      setHighlightedRowLabel(3);
      expect(getViewState().highlightedRowLabel).toBe(3);

      setHighlightedRowLabel(null);
      expect(getViewState().highlightedRowLabel).toBeNull();
    });

    it('setHighlightedColLabel sets highlighted column', () => {
      const { setHighlightedColLabel } = useUIStore.getState();

      setHighlightedColLabel(2);
      expect(getViewState().highlightedColLabel).toBe(2);

      setHighlightedColLabel(7);
      expect(getViewState().highlightedColLabel).toBe(7);
    });

    it('setHighlightedColLabel with null clears highlight', () => {
      const { setHighlightedColLabel } = useUIStore.getState();

      setHighlightedColLabel(2);
      expect(getViewState().highlightedColLabel).toBe(2);

      setHighlightedColLabel(null);
      expect(getViewState().highlightedColLabel).toBeNull();
    });

    it('row and column highlights are independent', () => {
      const { setHighlightedRowLabel, setHighlightedColLabel } = useUIStore.getState();

      setHighlightedRowLabel(3);
      setHighlightedColLabel(5);

      expect(getViewState().highlightedRowLabel).toBe(3);
      expect(getViewState().highlightedColLabel).toBe(5);

      setHighlightedRowLabel(null);
      expect(getViewState().highlightedRowLabel).toBeNull();
      expect(getViewState().highlightedColLabel).toBe(5);
    });
  });

  describe('sharedLayoutPreview', () => {
    const mockLayout = {
      version: '1.0',
      name: 'Test Layout',
      drawer: { width: 10, depth: 8, height: 12 },
      printBedSize: 256,
      gridUnitMm: 42,
      heightUnitMm: 7,
      categories: [{ id: 'cat1', name: 'Category', color: '#ff0000' }],
      layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
      bins: [],
    };

    it('initial state is null', () => {
      expect(getSharedPreviewState().sharedLayoutPreview).toBeNull();
      expect(getSharedPreviewState().sharedLayoutOriginalName).toBeNull();
    });

    it('setSharedLayoutPreview sets layout and derives name from layout', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout);

      expect(getSharedPreviewState().sharedLayoutPreview).toEqual(mockLayout);
      expect(getSharedPreviewState().sharedLayoutOriginalName).toBe('Test Layout');
    });

    it('setSharedLayoutPreview uses explicit name when provided', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout, 'Custom Name');

      expect(getSharedPreviewState().sharedLayoutPreview).toEqual(mockLayout);
      expect(getSharedPreviewState().sharedLayoutOriginalName).toBe('Custom Name');
    });

    it('setSharedLayoutPreview with null clears both fields', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      // Set first
      setSharedLayoutPreview(mockLayout, 'Original');
      expect(getSharedPreviewState().sharedLayoutPreview).not.toBeNull();

      // Clear
      setSharedLayoutPreview(null);

      expect(getSharedPreviewState().sharedLayoutPreview).toBeNull();
      expect(getSharedPreviewState().sharedLayoutOriginalName).toBeNull();
    });

    it('clearSharedLayoutPreview clears both fields', () => {
      const { setSharedLayoutPreview, clearSharedLayoutPreview } = useUIStore.getState();

      // Set first
      setSharedLayoutPreview(mockLayout, 'Test');
      expect(getSharedPreviewState().sharedLayoutPreview).not.toBeNull();

      // Clear
      clearSharedLayoutPreview();

      expect(getSharedPreviewState().sharedLayoutPreview).toBeNull();
      expect(getSharedPreviewState().sharedLayoutOriginalName).toBeNull();
    });

    it('preserves original name when layout name changes', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout, 'Original Name');

      // Simulate layout name change (user editing)
      const modifiedLayout = { ...mockLayout, name: 'Modified Name' };
      useUIStore.setState({ sharedLayoutPreview: modifiedLayout });

      // Original name should still be preserved
      expect(getSharedPreviewState().sharedLayoutOriginalName).toBe('Original Name');
    });

    it('setSharedLayoutPreview sets author name when provided', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout, 'Custom Name', 'John Doe');

      expect(getSharedPreviewState().sharedLayoutAuthorName).toBe('John Doe');
    });

    it('clearSharedLayoutPreview also clears author name', () => {
      const { setSharedLayoutPreview, clearSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout, 'Test', 'Author');
      expect(getSharedPreviewState().sharedLayoutAuthorName).toBe('Author');

      clearSharedLayoutPreview();
      expect(getSharedPreviewState().sharedLayoutAuthorName).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    it('setFocusedBin sets focused bin', () => {
      const { setFocusedBin } = useUIStore.getState();

      setFocusedBin('bin1');
      expect(getSelectionState().focusedBinId).toBe('bin1');

      setFocusedBin(null);
      expect(getSelectionState().focusedBinId).toBeNull();
    });

    it('setKeyboardDragMode enables drag mode', () => {
      const { setKeyboardDragMode } = useUIStore.getState();

      setKeyboardDragMode(true);
      expect(getInteractionState().keyboardDragMode).toBe(true);

      setKeyboardDragMode(false);
      expect(getInteractionState().keyboardDragMode).toBe(false);
    });

    it('setKeyboardDragMode disables resize mode when entering drag mode', () => {
      const { setKeyboardResizeMode, setKeyboardDragMode } = useUIStore.getState();

      setKeyboardResizeMode(true);
      expect(getInteractionState().keyboardResizeMode).toBe(true);

      setKeyboardDragMode(true);
      expect(getInteractionState().keyboardDragMode).toBe(true);
      expect(getInteractionState().keyboardResizeMode).toBe(false);
    });

    it('setKeyboardResizeMode enables resize mode', () => {
      const { setKeyboardResizeMode } = useUIStore.getState();

      setKeyboardResizeMode(true);
      expect(getInteractionState().keyboardResizeMode).toBe(true);
    });

    it('setKeyboardResizeMode disables drag mode when entering resize mode', () => {
      const { setKeyboardDragMode, setKeyboardResizeMode } = useUIStore.getState();

      setKeyboardDragMode(true);
      expect(getInteractionState().keyboardDragMode).toBe(true);

      setKeyboardResizeMode(true);
      expect(getInteractionState().keyboardResizeMode).toBe(true);
      expect(getInteractionState().keyboardDragMode).toBe(false);
    });

    it('announceToScreenReader sets and clears live message', async () => {
      vi.useFakeTimers();
      const { announceToScreenReader } = useUIStore.getState();

      announceToScreenReader('Test announcement');
      expect(getInteractionState().liveMessage).toBe('Test announcement');

      // Message should clear after 1 second
      vi.advanceTimersByTime(1000);
      expect(getInteractionState().liveMessage).toBeNull();
    });
  });

  describe('quick label', () => {
    it('showQuickLabel sets quick label bin', () => {
      const { showQuickLabel } = useUIStore.getState();

      showQuickLabel('bin1');
      expect(getSelectionState().quickLabelBinId).toBe('bin1');
    });

    it('hideQuickLabel clears quick label bin', () => {
      const { showQuickLabel, hideQuickLabel } = useUIStore.getState();

      showQuickLabel('bin1');
      hideQuickLabel();
      expect(getSelectionState().quickLabelBinId).toBeNull();
    });
  });

  describe('category highlighting', () => {
    it('setHighlightedCategoryId sets highlighted category', () => {
      const { setHighlightedCategoryId } = useUIStore.getState();

      setHighlightedCategoryId('tools');
      expect(getViewState().highlightedCategoryId).toBe('tools');

      setHighlightedCategoryId(null);
      expect(getViewState().highlightedCategoryId).toBeNull();
    });
  });

  describe('half-bin mode', () => {
    it('toggleHalfBinMode toggles state on', () => {
      const { toggleHalfBinMode, setHalfBinMode } = useUIStore.getState();

      // Ensure off first
      setHalfBinMode(false);
      expect(getHalfBinModeState().halfBinMode).toBe(false);

      const result = toggleHalfBinMode();
      expect(result.success).toBe(true);
      expect(getHalfBinModeState().halfBinMode).toBe(true);
    });

    it('toggleHalfBinMode toggles state off when no fractional bins', () => {
      const { toggleHalfBinMode, setHalfBinMode } = useUIStore.getState();

      // Enable first
      setHalfBinMode(true);
      expect(getHalfBinModeState().halfBinMode).toBe(true);

      // Should be able to turn off since no fractional bins exist
      const result = toggleHalfBinMode();
      expect(result.success).toBe(true);
      expect(getHalfBinModeState().halfBinMode).toBe(false);
    });

    it('setHalfBinMode directly sets state', () => {
      const { setHalfBinMode } = useUIStore.getState();

      setHalfBinMode(true);
      expect(getHalfBinModeState().halfBinMode).toBe(true);

      setHalfBinMode(false);
      expect(getHalfBinModeState().halfBinMode).toBe(false);
    });
  });

  describe('toggleHalfBinModeResult', () => {
    it('returns Ok when enabling half-bin mode', () => {
      const { toggleHalfBinModeResult, setHalfBinMode } = useUIStore.getState();

      // Ensure off first
      setHalfBinMode(false);
      expect(getHalfBinModeState().halfBinMode).toBe(false);

      const result = toggleHalfBinModeResult();

      expectOk(result);
      expect(getHalfBinModeState().halfBinMode).toBe(true);
    });

    it('returns Ok when disabling half-bin mode with no fractional bins', () => {
      const { toggleHalfBinModeResult, setHalfBinMode } = useUIStore.getState();

      // Enable first
      setHalfBinMode(true);
      expect(getHalfBinModeState().halfBinMode).toBe(true);

      const result = toggleHalfBinModeResult();

      expectOk(result);
      expect(getHalfBinModeState().halfBinMode).toBe(false);
    });

    it('returns Err with LAYOUT_INVALID_OPERATION when fractional bins exist', () => {
      const { toggleHalfBinModeResult, setHalfBinMode } = useUIStore.getState();

      // Enable half-bin mode
      setHalfBinMode(true);

      // Add a fractional bin
      const layerId = useLayoutStore.getState().layout.layers[0].id;
      useLayoutStore.getState().addBin({
        x: 0.5, // Fractional position
        y: 0,
        width: 1,
        depth: 1,
        height: 3,
        layerId,
        category: useLayoutStore.getState().layout.categories[0].id,
      });

      const result = toggleHalfBinModeResult();

      const error = expectErr(result);
      expect(error.code).toBe('LAYOUT_INVALID_OPERATION');
      expect(error.kind).toBe('LayoutError');
      expect(error.operation).toBe('toggleHalfBinMode');
      expect(error.reason).toContain('fractional dimensions');
      expect(getHalfBinModeState().halfBinMode).toBe(true); // Should remain enabled
    });
  });

  describe('mobile layers tab', () => {
    it('setMobileLayersTab sets active tab', () => {
      const { setMobileLayersTab } = useUIStore.getState();

      setMobileLayersTab('tools');
      expect(getMobileState().mobileLayersTab).toBe('tools');

      setMobileLayersTab('layers');
      expect(getMobileState().mobileLayersTab).toBe('layers');
    });
  });

  describe('context menu extended', () => {
    it('showContextMenu handles array of bin IDs', () => {
      const { showContextMenu } = useUIStore.getState();

      showContextMenu(['bin1', 'bin2', 'bin3'], { x: 50, y: 100 });

      const menu = getViewState().contextMenu;
      expect(menu?.binIds).toEqual(['bin1', 'bin2', 'bin3']);
    });

    it('showContextMenu handles source parameter', () => {
      const { showContextMenu } = useUIStore.getState();

      showContextMenu('bin1', { x: 50, y: 100 }, 'staging');

      const menu = getViewState().contextMenu;
      expect(menu?.source).toBe('staging');
    });

    it('showContextMenu defaults source to grid', () => {
      const { showContextMenu } = useUIStore.getState();

      showContextMenu('bin1', { x: 50, y: 100 });

      const menu = getViewState().contextMenu;
      expect(menu?.source).toBe('grid');
    });
  });

  describe('isometric preview after reset', () => {
    it('resetAllStores sets layerViewMode to stack (default)', () => {
      // Set to different value first
      useUIStore.getState().setLayerViewMode('all');
      expect(getInteractionState().layerViewMode).toBe('all');

      // Reset should set to 'stack' (the InteractionStore default)
      resetAllStores();
      expect(getInteractionState().layerViewMode).toBe('stack');
    });

    it('resetAllStores sets showIsometricPreview to false (default)', () => {
      // Set to different value first
      useUIStore.getState().toggleIsometricPreview(); // true now
      expect(getInteractionState().showIsometricPreview).toBe(true);

      // Reset should set to false (the InteractionStore default)
      resetAllStores();
      expect(getInteractionState().showIsometricPreview).toBe(false);
    });
  });
});
