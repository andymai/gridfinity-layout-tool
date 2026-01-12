import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUIStore } from '../../store/ui';
import { CONSTRAINTS } from '../../constants';
import { resetAllStores } from '../testUtils';

describe('ui store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('selection', () => {
    it('setActiveLayer changes active layer and clears selection', () => {
      const { setActiveLayer, addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      addToSelection('bin2');
      expect(useUIStore.getState().selectedBinIds).toHaveLength(2);

      setActiveLayer('layer2');

      const state = useUIStore.getState();
      expect(state.activeLayerId).toBe('layer2');
      expect(state.selectedBinIds).toHaveLength(0);
    });

    it('setSelectedBin sets single selection', () => {
      const { setSelectedBin, addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      addToSelection('bin2');

      setSelectedBin('bin3');

      expect(useUIStore.getState().selectedBinIds).toEqual(['bin3']);
    });

    it('setSelectedBin with null clears selection', () => {
      const { setSelectedBin, addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      setSelectedBin(null);

      expect(useUIStore.getState().selectedBinIds).toHaveLength(0);
    });

    it('setSelectedBins sets multiple selection', () => {
      const { setSelectedBins } = useUIStore.getState();

      setSelectedBins(['bin1', 'bin2', 'bin3']);

      expect(useUIStore.getState().selectedBinIds).toEqual(['bin1', 'bin2', 'bin3']);
    });

    it('addToSelection adds without duplicates', () => {
      const { addToSelection } = useUIStore.getState();

      addToSelection('bin1');
      addToSelection('bin1'); // Duplicate
      addToSelection('bin2');

      expect(useUIStore.getState().selectedBinIds).toEqual(['bin1', 'bin2']);
    });

    it('removeFromSelection removes specific bin', () => {
      const { setSelectedBins, removeFromSelection } = useUIStore.getState();

      setSelectedBins(['bin1', 'bin2', 'bin3']);
      removeFromSelection('bin2');

      expect(useUIStore.getState().selectedBinIds).toEqual(['bin1', 'bin3']);
    });

    it('toggleSelection toggles bin in selection', () => {
      const { toggleSelection, addToSelection } = useUIStore.getState();

      addToSelection('bin1');

      toggleSelection('bin2');
      expect(useUIStore.getState().selectedBinIds).toContain('bin2');

      toggleSelection('bin1');
      expect(useUIStore.getState().selectedBinIds).not.toContain('bin1');
    });

    it('clearSelection clears selection and interaction', () => {
      const { addToSelection, setInteraction, clearSelection } = useUIStore.getState();

      addToSelection('bin1');
      setInteraction({ type: 'draw', start: { x: 0, y: 0 }, current: { x: 0, y: 0 } });

      clearSelection();

      const state = useUIStore.getState();
      expect(state.selectedBinIds).toHaveLength(0);
      expect(state.interaction).toBeNull();
    });
  });

  describe('zoom', () => {
    it('setZoom sets zoom level', () => {
      const { setZoom } = useUIStore.getState();

      setZoom(2);
      expect(useUIStore.getState().zoom).toBe(2);
    });

    it('setZoom clamps to min/max', () => {
      const { setZoom } = useUIStore.getState();

      setZoom(0.1); // Below min
      expect(useUIStore.getState().zoom).toBe(CONSTRAINTS.ZOOM_MIN);

      setZoom(10); // Above max
      expect(useUIStore.getState().zoom).toBe(CONSTRAINTS.ZOOM_MAX);
    });

    it('zoomIn increases zoom by step', () => {
      const { setZoom, zoomIn } = useUIStore.getState();

      setZoom(1);
      zoomIn();

      expect(useUIStore.getState().zoom).toBe(1 + CONSTRAINTS.ZOOM_STEP);
    });

    it('zoomOut decreases zoom by step', () => {
      const { setZoom, zoomOut } = useUIStore.getState();

      setZoom(1);
      zoomOut();

      expect(useUIStore.getState().zoom).toBe(1 - CONSTRAINTS.ZOOM_STEP);
    });

    it('zoomIn respects max limit', () => {
      const { setZoom, zoomIn } = useUIStore.getState();

      setZoom(CONSTRAINTS.ZOOM_MAX);
      zoomIn();

      expect(useUIStore.getState().zoom).toBe(CONSTRAINTS.ZOOM_MAX);
    });

    it('zoomOut respects min limit', () => {
      const { setZoom, zoomOut } = useUIStore.getState();

      setZoom(CONSTRAINTS.ZOOM_MIN);
      zoomOut();

      expect(useUIStore.getState().zoom).toBe(CONSTRAINTS.ZOOM_MIN);
    });
  });

  describe('panel toggles', () => {
    it('toggleShowOtherLayers toggles state', () => {
      const { toggleShowOtherLayers } = useUIStore.getState();

      expect(useUIStore.getState().showOtherLayers).toBe(true);
      toggleShowOtherLayers();
      expect(useUIStore.getState().showOtherLayers).toBe(false);
      toggleShowOtherLayers();
      expect(useUIStore.getState().showOtherLayers).toBe(true);
    });

    it('toggleShowLabels toggles state', () => {
      const { toggleShowLabels } = useUIStore.getState();

      expect(useUIStore.getState().showLabels).toBe(true);
      toggleShowLabels();
      expect(useUIStore.getState().showLabels).toBe(false);
    });

    it('toggleLeftPanel toggles collapsed state', () => {
      const { toggleLeftPanel } = useUIStore.getState();

      expect(useUIStore.getState().leftPanelCollapsed).toBe(false);
      toggleLeftPanel();
      expect(useUIStore.getState().leftPanelCollapsed).toBe(true);
    });

    it('toggleRightPanel toggles collapsed state', () => {
      const { toggleRightPanel } = useUIStore.getState();

      expect(useUIStore.getState().rightPanelCollapsed).toBe(false);
      toggleRightPanel();
      expect(useUIStore.getState().rightPanelCollapsed).toBe(true);
    });
  });

  describe('paint mode', () => {
    it('setPaintSize sets paint size', () => {
      const { setPaintSize } = useUIStore.getState();

      setPaintSize({ width: 2, depth: 3 });

      expect(useUIStore.getState().paintSize).toEqual({ width: 2, depth: 3 });
    });

    it('setPaintSize with null clears paint mode', () => {
      const { setPaintSize } = useUIStore.getState();

      setPaintSize({ width: 2, depth: 3 });
      setPaintSize(null);

      expect(useUIStore.getState().paintSize).toBeNull();
    });

    it('togglePaintSize toggles between sizes', () => {
      const { togglePaintSize } = useUIStore.getState();

      togglePaintSize({ width: 2, depth: 2 });
      expect(useUIStore.getState().paintSize).toEqual({ width: 2, depth: 2 });

      togglePaintSize({ width: 2, depth: 2 }); // Same size - should toggle off
      expect(useUIStore.getState().paintSize).toBeNull();

      togglePaintSize({ width: 3, depth: 3 }); // Different size - should toggle on
      expect(useUIStore.getState().paintSize).toEqual({ width: 3, depth: 3 });
    });
  });

  describe('mobile panel', () => {
    it('setActiveMobilePanel sets active panel', () => {
      const { setActiveMobilePanel } = useUIStore.getState();

      setActiveMobilePanel('layers');
      expect(useUIStore.getState().activeMobilePanel).toBe('layers');
    });

    it('closeMobilePanel closes panel', () => {
      const { setActiveMobilePanel, closeMobilePanel } = useUIStore.getState();

      setActiveMobilePanel('layers');
      closeMobilePanel();

      expect(useUIStore.getState().activeMobilePanel).toBeNull();
    });

    it('toggleMobilePanel toggles panel', () => {
      const { toggleMobilePanel } = useUIStore.getState();

      toggleMobilePanel('layers');
      expect(useUIStore.getState().activeMobilePanel).toBe('layers');

      toggleMobilePanel('layers'); // Same panel - should close
      expect(useUIStore.getState().activeMobilePanel).toBeNull();

      toggleMobilePanel('categories'); // Different panel - should open
      expect(useUIStore.getState().activeMobilePanel).toBe('categories');
    });
  });

  describe('context menu', () => {
    it('showContextMenu sets context menu state', () => {
      const { showContextMenu } = useUIStore.getState();

      showContextMenu('bin1', { x: 100, y: 200 });

      const menu = useUIStore.getState().contextMenu;
      expect(menu?.binIds).toEqual(['bin1']);
      expect(menu?.position).toEqual({ x: 100, y: 200 });
    });

    it('hideContextMenu clears context menu', () => {
      const { showContextMenu, hideContextMenu } = useUIStore.getState();

      showContextMenu('bin1', { x: 100, y: 200 });
      hideContextMenu();

      expect(useUIStore.getState().contextMenu).toBeNull();
    });
  });

  describe('isometric preview', () => {
    it('toggleIsometricPreview toggles visibility', () => {
      const { toggleIsometricPreview } = useUIStore.getState();

      expect(useUIStore.getState().showIsometricPreview).toBe(true);
      toggleIsometricPreview();
      expect(useUIStore.getState().showIsometricPreview).toBe(false);
    });

    it('setIsometricRotation sets rotation', () => {
      const { setIsometricRotation } = useUIStore.getState();

      setIsometricRotation(45);
      expect(useUIStore.getState().isometricRotation).toBe(45);
    });

    it('setIsometricRotation normalizes to 0-360', () => {
      const { setIsometricRotation } = useUIStore.getState();

      setIsometricRotation(-90);
      expect(useUIStore.getState().isometricRotation).toBe(270);

      setIsometricRotation(450);
      expect(useUIStore.getState().isometricRotation).toBe(90);
    });

    it('snapToIsometric snaps to nearest 90 degrees', () => {
      const { setIsometricRotation, snapToIsometric } = useUIStore.getState();

      setIsometricRotation(35);
      snapToIsometric();
      expect(useUIStore.getState().isometricRotation).toBe(0);

      setIsometricRotation(55);
      snapToIsometric();
      expect(useUIStore.getState().isometricRotation).toBe(90);

      setIsometricRotation(130);
      snapToIsometric();
      expect(useUIStore.getState().isometricRotation).toBe(90);

      setIsometricRotation(320);
      snapToIsometric();
      expect(useUIStore.getState().isometricRotation).toBe(0);
    });

    it('setLayerViewMode changes layer view mode', () => {
      const { setLayerViewMode } = useUIStore.getState();

      expect(useUIStore.getState().layerViewMode).toBe('focus');
      setLayerViewMode('stack');
      expect(useUIStore.getState().layerViewMode).toBe('stack');
      setLayerViewMode('all');
      expect(useUIStore.getState().layerViewMode).toBe('all');
      setLayerViewMode('focus');
      expect(useUIStore.getState().layerViewMode).toBe('focus');
    });

    it('togglePreviewExpanded toggles expanded state', () => {
      const { togglePreviewExpanded } = useUIStore.getState();

      expect(useUIStore.getState().isPreviewExpanded).toBe(false);
      togglePreviewExpanded();
      expect(useUIStore.getState().isPreviewExpanded).toBe(true);
    });

    it('setPreviewExpanded sets expanded state', () => {
      const { setPreviewExpanded } = useUIStore.getState();

      setPreviewExpanded(true);
      expect(useUIStore.getState().isPreviewExpanded).toBe(true);

      setPreviewExpanded(false);
      expect(useUIStore.getState().isPreviewExpanded).toBe(false);
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

      const interaction = useUIStore.getState().interaction;
      expect(interaction?.type).toBe('drag');
    });

    it('setDropTarget sets drop target', () => {
      const { setDropTarget } = useUIStore.getState();

      setDropTarget('trash');
      expect(useUIStore.getState().dropTarget).toBe('trash');

      setDropTarget('staging');
      expect(useUIStore.getState().dropTarget).toBe('staging');

      setDropTarget(null);
      expect(useUIStore.getState().dropTarget).toBeNull();
    });
  });

  describe('category', () => {
    it('setActiveCategory sets active category', () => {
      const { setActiveCategory } = useUIStore.getState();

      setActiveCategory('tools');
      expect(useUIStore.getState().activeCategoryId).toBe('tools');
    });
  });

  describe('row/column label highlighting', () => {
    it('initial state has null highlighted row and column', () => {
      const state = useUIStore.getState();
      expect(state.highlightedRowLabel).toBeNull();
      expect(state.highlightedColLabel).toBeNull();
    });

    it('setHighlightedRowLabel sets highlighted row', () => {
      const { setHighlightedRowLabel } = useUIStore.getState();

      setHighlightedRowLabel(3);
      expect(useUIStore.getState().highlightedRowLabel).toBe(3);

      setHighlightedRowLabel(5);
      expect(useUIStore.getState().highlightedRowLabel).toBe(5);
    });

    it('setHighlightedRowLabel with null clears highlight', () => {
      const { setHighlightedRowLabel } = useUIStore.getState();

      setHighlightedRowLabel(3);
      expect(useUIStore.getState().highlightedRowLabel).toBe(3);

      setHighlightedRowLabel(null);
      expect(useUIStore.getState().highlightedRowLabel).toBeNull();
    });

    it('setHighlightedColLabel sets highlighted column', () => {
      const { setHighlightedColLabel } = useUIStore.getState();

      setHighlightedColLabel(2);
      expect(useUIStore.getState().highlightedColLabel).toBe(2);

      setHighlightedColLabel(7);
      expect(useUIStore.getState().highlightedColLabel).toBe(7);
    });

    it('setHighlightedColLabel with null clears highlight', () => {
      const { setHighlightedColLabel } = useUIStore.getState();

      setHighlightedColLabel(2);
      expect(useUIStore.getState().highlightedColLabel).toBe(2);

      setHighlightedColLabel(null);
      expect(useUIStore.getState().highlightedColLabel).toBeNull();
    });

    it('row and column highlights are independent', () => {
      const { setHighlightedRowLabel, setHighlightedColLabel } = useUIStore.getState();

      setHighlightedRowLabel(3);
      setHighlightedColLabel(5);

      const state = useUIStore.getState();
      expect(state.highlightedRowLabel).toBe(3);
      expect(state.highlightedColLabel).toBe(5);

      setHighlightedRowLabel(null);
      expect(useUIStore.getState().highlightedRowLabel).toBeNull();
      expect(useUIStore.getState().highlightedColLabel).toBe(5);
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
      const state = useUIStore.getState();
      expect(state.sharedLayoutPreview).toBeNull();
      expect(state.sharedLayoutOriginalName).toBeNull();
    });

    it('setSharedLayoutPreview sets layout and derives name from layout', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout);

      const state = useUIStore.getState();
      expect(state.sharedLayoutPreview).toEqual(mockLayout);
      expect(state.sharedLayoutOriginalName).toBe('Test Layout');
    });

    it('setSharedLayoutPreview uses explicit name when provided', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout, 'Custom Name');

      const state = useUIStore.getState();
      expect(state.sharedLayoutPreview).toEqual(mockLayout);
      expect(state.sharedLayoutOriginalName).toBe('Custom Name');
    });

    it('setSharedLayoutPreview with null clears both fields', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      // Set first
      setSharedLayoutPreview(mockLayout, 'Original');
      expect(useUIStore.getState().sharedLayoutPreview).not.toBeNull();

      // Clear
      setSharedLayoutPreview(null);

      const state = useUIStore.getState();
      expect(state.sharedLayoutPreview).toBeNull();
      expect(state.sharedLayoutOriginalName).toBeNull();
    });

    it('clearSharedLayoutPreview clears both fields', () => {
      const { setSharedLayoutPreview, clearSharedLayoutPreview } = useUIStore.getState();

      // Set first
      setSharedLayoutPreview(mockLayout, 'Test');
      expect(useUIStore.getState().sharedLayoutPreview).not.toBeNull();

      // Clear
      clearSharedLayoutPreview();

      const state = useUIStore.getState();
      expect(state.sharedLayoutPreview).toBeNull();
      expect(state.sharedLayoutOriginalName).toBeNull();
    });

    it('preserves original name when layout name changes', () => {
      const { setSharedLayoutPreview } = useUIStore.getState();

      setSharedLayoutPreview(mockLayout, 'Original Name');

      // Simulate layout name change (user editing)
      const modifiedLayout = { ...mockLayout, name: 'Modified Name' };
      useUIStore.setState({ sharedLayoutPreview: modifiedLayout });

      // Original name should still be preserved
      expect(useUIStore.getState().sharedLayoutOriginalName).toBe('Original Name');
    });
  });
});
