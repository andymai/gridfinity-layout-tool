import { describe, it, expect, beforeEach } from 'vitest';
import { useViewStore } from '@/core/store/view';
import { CONSTRAINTS } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';

const getState = () => useViewStore.getState();

describe('view store', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('initial state', () => {
    it('starts with default zoom of 1', () => {
      expect(getState().zoom).toBe(1);
    });

    it('starts with other layers visible', () => {
      expect(getState().showOtherLayers).toBe(true);
    });

    it('starts with panels expanded', () => {
      expect(getState().leftPanelCollapsed).toBe(false);
      expect(getState().rightPanelCollapsed).toBe(false);
    });

    it('starts with no context menu', () => {
      expect(getState().contextMenu).toBeNull();
    });

    it('starts with no highlighting', () => {
      expect(getState().highlightedCategoryId).toBeNull();
      expect(getState().highlightedRowLabel).toBeNull();
      expect(getState().highlightedColLabel).toBeNull();
    });

    it('starts with print modal closed', () => {
      expect(getState().printModalOpen).toBe(false);
    });

    it('starts with layout manager hidden', () => {
      expect(getState().showLayoutManager).toBe(false);
    });

    it('starts with isometric preview hidden and default settings', () => {
      expect(getState().showIsometricPreview).toBe(false);
      expect(getState().isometricRotation).toBe(0);
      expect(getState().layerViewMode).toBe('stack');
      expect(getState().isPreviewExpanded).toBe(false);
    });
  });

  describe('zoom', () => {
    it('setZoom updates zoom level', () => {
      getState().setZoom(2);
      expect(getState().zoom).toBe(2);
    });

    it('setZoom clamps to minimum', () => {
      getState().setZoom(0);
      expect(getState().zoom).toBe(CONSTRAINTS.ZOOM_MIN);
    });

    it('setZoom clamps to maximum', () => {
      getState().setZoom(100);
      expect(getState().zoom).toBe(CONSTRAINTS.ZOOM_MAX);
    });

    it('zoomIn increases zoom by step', () => {
      const initial = getState().zoom;
      getState().zoomIn();
      expect(getState().zoom).toBeCloseTo(initial + CONSTRAINTS.ZOOM_STEP);
    });

    it('zoomOut decreases zoom by step', () => {
      const initial = getState().zoom;
      getState().zoomOut();
      expect(getState().zoom).toBeCloseTo(initial - CONSTRAINTS.ZOOM_STEP);
    });

    it('zoomIn does not exceed maximum', () => {
      getState().setZoom(CONSTRAINTS.ZOOM_MAX);
      getState().zoomIn();
      expect(getState().zoom).toBe(CONSTRAINTS.ZOOM_MAX);
    });

    it('zoomOut does not go below minimum', () => {
      getState().setZoom(CONSTRAINTS.ZOOM_MIN);
      getState().zoomOut();
      expect(getState().zoom).toBe(CONSTRAINTS.ZOOM_MIN);
    });
  });

  describe('visibility', () => {
    it('toggleShowOtherLayers toggles visibility', () => {
      expect(getState().showOtherLayers).toBe(true);
      getState().toggleShowOtherLayers();
      expect(getState().showOtherLayers).toBe(false);
      getState().toggleShowOtherLayers();
      expect(getState().showOtherLayers).toBe(true);
    });
  });

  describe('panels', () => {
    it('toggleLeftPanel toggles collapsed state', () => {
      expect(getState().leftPanelCollapsed).toBe(false);
      getState().toggleLeftPanel();
      expect(getState().leftPanelCollapsed).toBe(true);
      getState().toggleLeftPanel();
      expect(getState().leftPanelCollapsed).toBe(false);
    });

    it('toggleRightPanel toggles collapsed state', () => {
      expect(getState().rightPanelCollapsed).toBe(false);
      getState().toggleRightPanel();
      expect(getState().rightPanelCollapsed).toBe(true);
    });

    it('left and right panels toggle independently', () => {
      getState().toggleLeftPanel();
      expect(getState().leftPanelCollapsed).toBe(true);
      expect(getState().rightPanelCollapsed).toBe(false);

      getState().toggleRightPanel();
      expect(getState().leftPanelCollapsed).toBe(true);
      expect(getState().rightPanelCollapsed).toBe(true);
    });
  });

  describe('context menu', () => {
    it('showContextMenu with single ID opens menu', () => {
      getState().showContextMenu('bin1', { x: 100, y: 200 });
      const menu = getState().contextMenu;
      expect(menu).not.toBeNull();
      expect(menu?.binIds).toEqual(['bin1']);
      expect(menu?.position).toEqual({ x: 100, y: 200 });
      expect(menu?.source).toBe('grid');
    });

    it('showContextMenu with array of IDs opens menu', () => {
      getState().showContextMenu(['bin1', 'bin2'], { x: 50, y: 75 });
      const menu = getState().contextMenu;
      expect(menu?.binIds).toEqual(['bin1', 'bin2']);
    });

    it('showContextMenu with staging source sets source', () => {
      getState().showContextMenu('bin1', { x: 0, y: 0 }, 'staging');
      expect(getState().contextMenu?.source).toBe('staging');
    });

    it('hideContextMenu closes the menu', () => {
      getState().showContextMenu('bin1', { x: 0, y: 0 });
      expect(getState().contextMenu).not.toBeNull();

      getState().hideContextMenu();
      expect(getState().contextMenu).toBeNull();
    });
  });

  describe('highlighting', () => {
    it('setHighlightedCategoryId sets and clears category highlight', () => {
      getState().setHighlightedCategoryId('cat1');
      expect(getState().highlightedCategoryId).toBe('cat1');

      getState().setHighlightedCategoryId(null);
      expect(getState().highlightedCategoryId).toBeNull();
    });

    it('setHighlightedRowLabel sets and clears row highlight', () => {
      getState().setHighlightedRowLabel(3);
      expect(getState().highlightedRowLabel).toBe(3);

      getState().setHighlightedRowLabel(null);
      expect(getState().highlightedRowLabel).toBeNull();
    });

    it('setHighlightedColLabel sets and clears column highlight', () => {
      getState().setHighlightedColLabel(5);
      expect(getState().highlightedColLabel).toBe(5);

      getState().setHighlightedColLabel(null);
      expect(getState().highlightedColLabel).toBeNull();
    });
  });

  describe('modals', () => {
    it('setPrintModalOpen opens and closes print modal', () => {
      getState().setPrintModalOpen(true);
      expect(getState().printModalOpen).toBe(true);

      getState().setPrintModalOpen(false);
      expect(getState().printModalOpen).toBe(false);
    });
  });

  describe('setShowLayoutManager', () => {
    it('sets showLayoutManager to true', () => {
      getState().setShowLayoutManager(true);

      expect(getState().showLayoutManager).toBe(true);
    });

    it('sets showLayoutManager to false', () => {
      useViewStore.setState({ showLayoutManager: true });

      getState().setShowLayoutManager(false);

      expect(getState().showLayoutManager).toBe(false);
    });
  });

  describe('3D preview', () => {
    it('toggleIsometricPreview toggles visibility', () => {
      getState().toggleIsometricPreview();
      expect(getState().showIsometricPreview).toBe(true);

      getState().toggleIsometricPreview();
      expect(getState().showIsometricPreview).toBe(false);
    });

    it('setIsometricRotation sets rotation', () => {
      getState().setIsometricRotation(45);
      expect(getState().isometricRotation).toBe(45);
    });

    it('setIsometricRotation normalizes to 0-360', () => {
      getState().setIsometricRotation(400);
      expect(getState().isometricRotation).toBe(40);

      getState().setIsometricRotation(-90);
      expect(getState().isometricRotation).toBe(270);
    });

    it('setLayerViewMode changes the mode', () => {
      getState().setLayerViewMode('focus');
      expect(getState().layerViewMode).toBe('focus');

      getState().setLayerViewMode('all');
      expect(getState().layerViewMode).toBe('all');
    });

    it('snapToIsometric snaps to nearest 90°', () => {
      getState().setIsometricRotation(44);
      getState().snapToIsometric();
      expect(getState().isometricRotation).toBe(0);

      getState().setIsometricRotation(46);
      getState().snapToIsometric();
      expect(getState().isometricRotation).toBe(90);

      getState().setIsometricRotation(315);
      getState().snapToIsometric();
      expect(getState().isometricRotation).toBe(0);
    });

    it('togglePreviewExpanded toggles expanded state', () => {
      getState().togglePreviewExpanded();
      expect(getState().isPreviewExpanded).toBe(true);

      getState().togglePreviewExpanded();
      expect(getState().isPreviewExpanded).toBe(false);
    });

    it('setPreviewExpanded sets expanded state directly', () => {
      getState().setPreviewExpanded(true);
      expect(getState().isPreviewExpanded).toBe(true);

      getState().setPreviewExpanded(false);
      expect(getState().isPreviewExpanded).toBe(false);
    });
  });
});
