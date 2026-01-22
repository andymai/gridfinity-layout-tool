import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridNavigation } from '@/features/grid-editor/hooks/useGridNavigation';
import { useLayoutStore } from '@/core/store/layout';
import { useUIStore } from '@/core/store/ui';
import { resetAllStores } from '@/test/testUtils';
import type { Bin } from '@/core/types';

describe('useGridNavigation', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create bins at specific positions
  const createBin = (id: string, x: number, y: number, width = 1, depth = 1): Bin => ({
    id,
    layerId: 'layer1',
    x,
    y,
    width,
    depth,
    height: 3,
    category: 'coral',
    label: '',
    notes: '',
  });

  describe('handleNavigationKey', () => {
    it('does nothing when no bin is focused', () => {
      const setFocusedBinSpy = vi.spyOn(useUIStore.getState(), 'setFocusedBin');

      // No focused bin
      useUIStore.setState({ focusedBinId: null });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowRight');
      });

      expect(setFocusedBinSpy).not.toHaveBeenCalled();
    });

    it('does nothing when focused bin does not exist', () => {
      const setFocusedBinSpy = vi.spyOn(useUIStore.getState(), 'setFocusedBin');

      // Focused bin ID that doesn't exist in layout
      useUIStore.setState({ focusedBinId: 'nonexistent', activeLayerId: 'layer1' });
      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins: [],
        },
      });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowRight');
      });

      expect(setFocusedBinSpy).not.toHaveBeenCalled();
    });

    it('navigates right to nearest bin', () => {
      const bins = [createBin('bin1', 0, 0), createBin('bin2', 2, 0), createBin('bin3', 5, 0)];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ focusedBinId: 'bin1', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowRight');
      });

      expect(useUIStore.getState().focusedBinId).toBe('bin2');
    });

    it('navigates left to nearest bin', () => {
      const bins = [createBin('bin1', 0, 0), createBin('bin2', 2, 0), createBin('bin3', 5, 0)];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ focusedBinId: 'bin3', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowLeft');
      });

      expect(useUIStore.getState().focusedBinId).toBe('bin2');
    });

    it('navigates down to nearest bin', () => {
      // Grid Y=0 is at bottom, Y increases upward
      // "Down" means lower Y values (toward bottom)
      const bins = [
        createBin('bin1', 0, 0), // Bottom
        createBin('bin2', 0, 2), // Middle
        createBin('bin3', 0, 5), // Top
      ];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      // Start from top bin, navigate down
      useUIStore.setState({ focusedBinId: 'bin3', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowDown');
      });

      // Should move to bin2 (lower Y value)
      expect(useUIStore.getState().focusedBinId).toBe('bin2');
    });

    it('navigates up to nearest bin', () => {
      // Grid Y=0 is at bottom, Y increases upward
      // "Up" means higher Y values (toward top)
      const bins = [
        createBin('bin1', 0, 0), // Bottom
        createBin('bin2', 0, 2), // Middle
        createBin('bin3', 0, 5), // Top
      ];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      // Start from bottom bin, navigate up
      useUIStore.setState({ focusedBinId: 'bin1', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowUp');
      });

      // Should move to bin2 (higher Y value)
      expect(useUIStore.getState().focusedBinId).toBe('bin2');
    });

    it('ignores non-arrow keys', () => {
      const bins = [createBin('bin1', 0, 0), createBin('bin2', 2, 0)];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ focusedBinId: 'bin1', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('Tab');
        result.current.handleNavigationKey('Enter');
        result.current.handleNavigationKey('Space');
      });

      // Should still be on bin1
      expect(useUIStore.getState().focusedBinId).toBe('bin1');
    });

    it('does nothing when no bin in direction', () => {
      const bins = [createBin('bin1', 0, 0)];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ focusedBinId: 'bin1', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowRight');
      });

      // Should still be on bin1 (no bin to the right)
      expect(useUIStore.getState().focusedBinId).toBe('bin1');
    });

    it('announces navigation to screen reader', () => {
      const bins = [createBin('bin1', 0, 0), { ...createBin('bin2', 2, 0), label: 'Screws' }];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });
      useUIStore.setState({ focusedBinId: 'bin1', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowRight');
      });

      // Check that announcement was made (liveMessage is set)
      expect(useUIStore.getState().liveMessage).toContain('Screws');
    });

    it('navigates only within active layer', () => {
      const bins = [
        { ...createBin('bin1', 0, 0), layerId: 'layer1' },
        { ...createBin('bin2', 2, 0), layerId: 'layer2' }, // Different layer
        { ...createBin('bin3', 5, 0), layerId: 'layer1' },
      ];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [
            { id: 'layer1', name: 'Layer 1', height: 3 },
            { id: 'layer2', name: 'Layer 2', height: 6 },
          ],
        },
      });
      useUIStore.setState({ focusedBinId: 'bin1', activeLayerId: 'layer1' });

      const { result } = renderHook(() => useGridNavigation());

      act(() => {
        result.current.handleNavigationKey('ArrowRight');
      });

      // Should skip bin2 (different layer) and go to bin3
      expect(useUIStore.getState().focusedBinId).toBe('bin3');
    });
  });

  describe('DOM focus synchronization', () => {
    it('focuses DOM element when focusedBinId changes', () => {
      // Create a mock element
      const mockElement = document.createElement('div');
      mockElement.setAttribute('data-bin-id', 'bin1');
      mockElement.focus = vi.fn();
      document.body.appendChild(mockElement);

      const bins = [createBin('bin1', 0, 0)];

      useLayoutStore.setState({
        layout: {
          ...useLayoutStore.getState().layout,
          bins,
          layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
        },
      });

      // Initially no focus
      useUIStore.setState({ focusedBinId: null, activeLayerId: 'layer1' });

      renderHook(() => useGridNavigation());

      // Set focused bin
      act(() => {
        useUIStore.getState().setFocusedBin('bin1');
      });

      // Element should be focused
      expect(mockElement.focus).toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(mockElement);
    });

    it('does nothing when no focusedBinId', () => {
      useUIStore.setState({ focusedBinId: null });

      // Should not throw
      expect(() => renderHook(() => useGridNavigation())).not.toThrow();
    });

    it('does nothing when element not found', () => {
      useUIStore.setState({ focusedBinId: 'nonexistent', activeLayerId: 'layer1' });

      // Should not throw even if element doesn't exist
      expect(() => renderHook(() => useGridNavigation())).not.toThrow();
    });
  });
});
