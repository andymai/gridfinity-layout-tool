import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrawerSettings } from '@/shared/hooks/useDrawerSettings';
import { useLayoutStore } from '@/core/store/layout';
import { useSelectionStore, useToastStore, useHalfGridModeStore } from '@/core/store';
import { useSettingsStore } from '@/core/store/settings';
import { resetAllStores } from '@/test/testUtils';
import { CONSTRAINTS, STAGING_ID } from '@/core/constants';

describe('useDrawerSettings', () => {
  beforeEach(() => {
    resetAllStores();
    // Set up a valid active layer for tests
    const layout = useLayoutStore.getState().layout;
    if (layout.layers.length > 0) {
      useSelectionStore.getState().setActiveLayer(layout.layers[0].id);
    }
  });

  describe('drawer dimensions', () => {
    it('returns current drawer dimensions', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.drawer.width).toBe(10);
      expect(result.current.drawer.depth).toBe(8);
      expect(result.current.drawer.height).toBe(12);
    });

    it('handleDrawerWidthChange increases width by step', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthChange(1);
      });

      expect(result.current.drawer.width).toBe(11);
    });

    it('handleDrawerWidthChange decreases width by step', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthChange(-1);
      });

      expect(result.current.drawer.width).toBe(9);
    });

    it('handleDrawerDepthChange increases depth by step', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerDepthChange(1);
      });

      expect(result.current.drawer.depth).toBe(9);
    });

    it('handleDrawerHeightChange increases height', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerHeightChange(1);
      });

      expect(result.current.drawer.height).toBe(13);
    });

    it('handleDrawerHeightChange decreases height', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerHeightChange(-1);
      });

      expect(result.current.drawer.height).toBe(11);
    });

    it('handleDrawerWidthInput sets width directly', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthInput(15);
      });

      expect(result.current.drawer.width).toBe(15);
    });

    it('handleDrawerWidthInput clamps to constraints', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthInput(100);
      });

      expect(result.current.drawer.width).toBe(CONSTRAINTS.GRID_MAX);
    });

    it('handleDrawerDepthInput sets depth directly', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerDepthInput(20);
      });

      expect(result.current.drawer.depth).toBe(20);
    });
  });

  describe('half-bin mode', () => {
    it('returns halfGridMode state', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.halfGridMode).toBe(false);
    });

    it('uses 0.5 step when halfGridMode is enabled', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.widthStep).toBe(0.5);
      expect(result.current.depthStep).toBe(0.5);
    });

    it('uses 1 step when halfGridMode is disabled', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.widthStep).toBe(1);
      expect(result.current.depthStep).toBe(1);
    });

    it('uses 0.5 step when drawer has fractional width', () => {
      useLayoutStore.getState().updateDrawer({ width: 10.5 });
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.widthStep).toBe(0.5);
      expect(result.current.hasFractionalWidth).toBe(true);
    });

    it('uses 0.5 step when drawer has fractional depth', () => {
      useLayoutStore.getState().updateDrawer({ depth: 8.5 });
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.depthStep).toBe(0.5);
      expect(result.current.hasFractionalDepth).toBe(true);
    });

    it('handleHalfBinToggle toggles half-bin mode when no violations', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleHalfBinToggle();
      });

      expect(result.current.halfGridMode).toBe(true);
    });

    it('handleHalfBinToggle shows modal when violations exist', () => {
      // Enable half-bin mode first
      useHalfGridModeStore.getState().setHalfGridMode(true);

      // Add a bin with fractional dimensions
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.getState().addBin({
        layerId: layout.layers[0].id,
        x: 0,
        y: 0,
        width: 1.5,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
      });

      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleHalfBinToggle();
      });

      // Modal should be shown when trying to disable with fractional bins
      expect(result.current.showHalfBinBlockedModal).toBe(true);
      expect(result.current.halfBinViolation).not.toBeNull();
    });

    it('handleRemediate continues moving remaining bins when one was deleted', () => {
      // Enable half-bin mode and add two fractional bins
      useHalfGridModeStore.getState().setHalfGridMode(true);

      const layout = useLayoutStore.getState().layout;
      useLayoutStore.getState().addBin({
        layerId: layout.layers[0].id,
        x: 0,
        y: 0,
        width: 1.5,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
      });
      useLayoutStore.getState().addBin({
        layerId: layout.layers[0].id,
        x: 3,
        y: 0,
        width: 2.5,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
      });

      const { result } = renderHook(() => useDrawerSettings());

      // Trigger toggle to set up violation state (captures bin IDs)
      act(() => {
        result.current.handleHalfBinToggle();
      });

      // Delete one fractional bin before remediation
      const bins = useLayoutStore.getState().layout.bins;
      const fractionalBin = bins.find((b) => b.width === 1.5);
      expect(fractionalBin).toBeDefined();
      act(() => {
        useLayoutStore.getState().deleteBin(fractionalBin!.id);
      });

      // Now remediate - the deleted bin should be skipped, remaining bins still moved
      act(() => {
        result.current.handleRemediate();
      });

      // The remaining fractional bin (2.5 wide) should still be moved to staging
      const updatedBins = useLayoutStore.getState().layout.bins;
      const remainingFractional = updatedBins.find((b) => b.width === 2.5);
      expect(remainingFractional?.layerId).toBe(STAGING_ID);

      // Toast should reflect actual count moved (1), not original violation count (2)
      const toasts = useToastStore.getState().toasts;
      const lastToast = toasts[toasts.length - 1];
      expect(lastToast.message).toBe('Moved 1 bin to staging');
    });

    it('handleRemediate moves fractional bins to staging', () => {
      // Enable half-bin mode
      useHalfGridModeStore.getState().setHalfGridMode(true);

      // Add a bin with fractional dimensions
      const layout = useLayoutStore.getState().layout;
      useLayoutStore.getState().addBin({
        layerId: layout.layers[0].id,
        x: 0,
        y: 0,
        width: 1.5,
        depth: 1,
        height: 3,
        category: layout.categories[0].id,
      });

      const { result } = renderHook(() => useDrawerSettings());

      // Trigger toggle to set up violation state
      act(() => {
        result.current.handleHalfBinToggle();
      });

      // Now remediate
      act(() => {
        result.current.handleRemediate();
      });

      // Check bins were moved to staging
      const bins = useLayoutStore.getState().layout.bins;
      const fractionalBin = bins.find((b) => b.width === 1.5);
      expect(fractionalBin?.layerId).toBe(STAGING_ID);
      expect(result.current.halfGridMode).toBe(false);
      expect(result.current.showHalfBinBlockedModal).toBe(false);
    });

    it('handleDrawerWidthInput auto-enables half-bin mode for fractional value', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.halfGridMode).toBe(false);

      act(() => {
        result.current.handleDrawerWidthInput(5.5);
      });

      expect(result.current.drawer.width).toBe(5.5);
      expect(result.current.halfGridMode).toBe(true);
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('handleDrawerDepthInput auto-enables half-bin mode for fractional value', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.halfGridMode).toBe(false);

      act(() => {
        result.current.handleDrawerDepthInput(4.5);
      });

      expect(result.current.drawer.depth).toBe(4.5);
      expect(result.current.halfGridMode).toBe(true);
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('handleDrawerWidthInput snaps non-half fractional to nearest 0.5', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthInput(5.3);
      });

      expect(result.current.drawer.width).toBe(5.5);

      // Reset for next assertion
      act(() => {
        result.current.handleDrawerWidthInput(5.8);
      });

      expect(result.current.drawer.width).toBe(6);
    });

    it('handleDrawerWidthInput does not show toast if half-bin mode already enabled', () => {
      useHalfGridModeStore.getState().setHalfGridMode(true);
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthInput(5.5);
      });

      expect(result.current.drawer.width).toBe(5.5);
      expect(result.current.halfGridMode).toBe(true);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('handleDrawerWidthInput does not enable half-bin mode for whole number', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleDrawerWidthInput(5);
      });

      expect(result.current.drawer.width).toBe(5);
      expect(result.current.halfGridMode).toBe(false);
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('fractional edges', () => {
    it('returns default fractional edges', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.fractionalEdges.x).toBe('end');
      expect(result.current.fractionalEdges.y).toBe('end');
    });

    it('handleFractionalEdgeChange updates x edge', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleFractionalEdgeChange('x', 'start');
      });

      expect(result.current.fractionalEdges.x).toBe('start');
    });

    it('handleFractionalEdgeChange updates y edge', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.handleFractionalEdgeChange('y', 'start');
      });

      expect(result.current.fractionalEdges.y).toBe('start');
    });
  });

  describe('physical units', () => {
    it('returns current physical units', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.gridUnitMm).toBe(42);
      expect(result.current.heightUnitMm).toBe(7);
      expect(result.current.printBedSize).toBe(256);
    });

    it('setGridUnitMm updates grid unit', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.setGridUnitMm(50);
      });

      expect(result.current.gridUnitMm).toBe(50);
    });

    it('setHeightUnitMm updates height unit', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.setHeightUnitMm(10);
      });

      expect(result.current.heightUnitMm).toBe(10);
    });

    it('setPrintBedSize updates print bed size', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.setPrintBedSize(300);
      });

      expect(result.current.printBedSize).toBe(300);
    });
  });

  describe('computed values', () => {
    it('computes real world dimensions correctly', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.realWorldDimensions.width).toBe(10 * 42); // 420mm
      expect(result.current.realWorldDimensions.depth).toBe(8 * 42); // 336mm
      expect(result.current.realWorldDimensions.height).toBe(12 * 7); // 84mm
    });

    it('computes maxGridUnits based on print bed size', () => {
      const { result } = renderHook(() => useDrawerSettings());

      // Default: printBedSize=256, gridUnitMm=42
      // maxGridUnits = floor(256 / 42) = 6
      expect(result.current.maxGridUnits).toEqual({ width: 6, depth: 6 });
    });
  });

  describe('save defaults', () => {
    it('modal state is initially false', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.showSaveDefaultsConfirm).toBe(false);
    });

    it('setShowSaveDefaultsConfirm updates modal state', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.setShowSaveDefaultsConfirm(true);
      });

      expect(result.current.showSaveDefaultsConfirm).toBe(true);
    });

    it('handleSaveDefaults saves current settings', () => {
      const { result } = renderHook(() => useDrawerSettings());

      act(() => {
        result.current.setShowSaveDefaultsConfirm(true);
      });

      act(() => {
        result.current.handleSaveDefaults();
      });

      // Modal should close
      expect(result.current.showSaveDefaultsConfirm).toBe(false);

      // Check settings store was updated
      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(10);
      expect(settings.defaultDrawerDepth).toBe(8);
      expect(settings.defaultDrawerHeight).toBe(12);
    });
  });

  describe('STL site toggle', () => {
    it('toggleSTLSite toggles site enabled state', () => {
      const { result } = renderHook(() => useDrawerSettings());

      const initialSites = result.current.settings.stlSearchSites;
      const firstSite = initialSites[0];
      const initialEnabled = firstSite.enabled;

      act(() => {
        result.current.toggleSTLSite(firstSite.id);
      });

      const updatedSites = result.current.settings.stlSearchSites;
      const updatedSite = updatedSites.find((s) => s.id === firstSite.id);
      expect(updatedSite?.enabled).toBe(!initialEnabled);
    });
  });

  describe('settings', () => {
    it('returns settings from store', () => {
      const { result } = renderHook(() => useDrawerSettings());

      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.stlSearchSites).toBeDefined();
    });

    it('returns active layer height', () => {
      const { result } = renderHook(() => useDrawerSettings());

      // Default layer height is 3
      expect(result.current.activeLayerHeight).toBe(3);
    });
  });
});
