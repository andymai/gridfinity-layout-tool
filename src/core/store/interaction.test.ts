import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useInteractionStore } from '@/core/store/interaction';
import { resetAllStores } from '@/test/testUtils';
import type { Interaction } from '@/core/types';

const getState = () => useInteractionStore.getState();

describe('interaction store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('starts with no active interaction', () => {
      expect(getState().interaction).toBeNull();
    });

    it('starts with no drop target', () => {
      expect(getState().dropTarget).toBeNull();
    });

    it('starts with no paint size', () => {
      expect(getState().paintSize).toBeNull();
    });

    it('starts with keyboard modes disabled', () => {
      expect(getState().keyboardDragMode).toBe(false);
      expect(getState().keyboardResizeMode).toBe(false);
    });

    it('starts with no live message', () => {
      expect(getState().liveMessage).toBeNull();
    });

    it('starts with isometric preview hidden and default settings', () => {
      expect(getState().showIsometricPreview).toBe(false);
      expect(getState().isometricRotation).toBe(0);
      expect(getState().layerViewMode).toBe('stack');
      expect(getState().isPreviewExpanded).toBe(false);
    });
  });

  describe('interaction', () => {
    it('setInteraction sets the active interaction', () => {
      const interaction: Interaction = {
        type: 'draw',
        start: { x: 0, y: 0 },
        current: { x: 2, y: 2 },
      };
      getState().setInteraction(interaction);
      expect(getState().interaction).toEqual(interaction);
    });

    it('setInteraction with null clears the interaction', () => {
      getState().setInteraction({
        type: 'draw',
        start: { x: 0, y: 0 },
        current: { x: 1, y: 1 },
      });
      getState().setInteraction(null);
      expect(getState().interaction).toBeNull();
    });
  });

  describe('drop target', () => {
    it('setDropTarget sets trash target', () => {
      getState().setDropTarget('trash');
      expect(getState().dropTarget).toBe('trash');
    });

    it('setDropTarget sets staging target', () => {
      getState().setDropTarget('staging');
      expect(getState().dropTarget).toBe('staging');
    });

    it('setDropTarget clears with null', () => {
      getState().setDropTarget('trash');
      getState().setDropTarget(null);
      expect(getState().dropTarget).toBeNull();
    });
  });

  describe('paint mode', () => {
    it('setPaintSize sets the brush size', () => {
      getState().setPaintSize({ width: 2, depth: 3 });
      expect(getState().paintSize).toEqual({ width: 2, depth: 3 });
    });

    it('setPaintSize clears with null', () => {
      getState().setPaintSize({ width: 1, depth: 1 });
      getState().setPaintSize(null);
      expect(getState().paintSize).toBeNull();
    });

    it('togglePaintSize activates a size when none is set', () => {
      getState().togglePaintSize({ width: 2, depth: 2 });
      expect(getState().paintSize).toEqual({ width: 2, depth: 2 });
    });

    it('togglePaintSize deactivates matching size', () => {
      getState().setPaintSize({ width: 2, depth: 2 });
      getState().togglePaintSize({ width: 2, depth: 2 });
      expect(getState().paintSize).toBeNull();
    });

    it('togglePaintSize switches to different size', () => {
      getState().setPaintSize({ width: 1, depth: 1 });
      getState().togglePaintSize({ width: 2, depth: 3 });
      expect(getState().paintSize).toEqual({ width: 2, depth: 3 });
    });
  });

  describe('keyboard modes', () => {
    it('setKeyboardDragMode enables drag mode', () => {
      getState().setKeyboardDragMode(true);
      expect(getState().keyboardDragMode).toBe(true);
    });

    it('enabling drag mode disables resize mode', () => {
      getState().setKeyboardResizeMode(true);
      expect(getState().keyboardResizeMode).toBe(true);

      getState().setKeyboardDragMode(true);
      expect(getState().keyboardDragMode).toBe(true);
      expect(getState().keyboardResizeMode).toBe(false);
    });

    it('enabling resize mode disables drag mode', () => {
      getState().setKeyboardDragMode(true);
      expect(getState().keyboardDragMode).toBe(true);

      getState().setKeyboardResizeMode(true);
      expect(getState().keyboardResizeMode).toBe(true);
      expect(getState().keyboardDragMode).toBe(false);
    });

    it('disabling drag mode does not affect resize mode', () => {
      getState().setKeyboardResizeMode(true);
      getState().setKeyboardDragMode(false);
      expect(getState().keyboardResizeMode).toBe(true);
      expect(getState().keyboardDragMode).toBe(false);
    });
  });

  describe('accessibility', () => {
    it('announceToScreenReader sets a live message', () => {
      getState().announceToScreenReader('Bin moved to row 2');
      expect(getState().liveMessage).toBe('Bin moved to row 2');
    });

    it('live message clears after timeout', () => {
      getState().announceToScreenReader('Bin deleted');
      expect(getState().liveMessage).toBe('Bin deleted');

      vi.advanceTimersByTime(1000);
      expect(getState().liveMessage).toBeNull();
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
