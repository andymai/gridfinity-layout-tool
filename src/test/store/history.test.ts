import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useHistoryStore } from '@/core/store/history';
import { useLayoutStore } from '@/core/store/layout';
import { createDefaultLayout, CONSTRAINTS } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';

describe('history store', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('push', () => {
    it('adds layout to history', () => {
      const { push } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      push(JSON.parse(JSON.stringify(layout)));

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.canUndo).toBe(true);
    });

    it('clears future on new push', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      // Push twice, then undo
      push(JSON.parse(JSON.stringify(layout)));
      useLayoutStore.getState().setName('State 2');
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)));

      undo();
      expect(useHistoryStore.getState().canRedo).toBe(true);

      // Push new state - should clear future
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)));
      expect(useHistoryStore.getState().canRedo).toBe(false);
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('limits history to UNDO_LIMIT', () => {
      const { push } = useHistoryStore.getState();

      // Push more than the limit
      for (let i = 0; i < CONSTRAINTS.UNDO_LIMIT + 10; i++) {
        const layout = { ...createDefaultLayout(), name: `State ${i}` };
        push(layout);
      }

      const state = useHistoryStore.getState();
      expect(state.past.length).toBeLessThanOrEqual(CONSTRAINTS.UNDO_LIMIT);
    });
  });

  describe('undo', () => {
    it('restores previous layout state', () => {
      const { push, undo } = useHistoryStore.getState();
      const originalLayout = useLayoutStore.getState().layout;

      // Save original state
      push(JSON.parse(JSON.stringify(originalLayout)));

      // Modify layout
      useLayoutStore.getState().setName('Modified Name');
      expect(useLayoutStore.getState().layout.name).toBe('Modified Name');

      // Undo
      undo();
      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');
    });

    it('moves current state to future', () => {
      const { push, undo } = useHistoryStore.getState();
      const layout = useLayoutStore.getState().layout;

      push(JSON.parse(JSON.stringify(layout)));
      useLayoutStore.getState().setName('Modified');

      undo();

      const state = useHistoryStore.getState();
      expect(state.future).toHaveLength(1);
      expect(state.future[0].name).toBe('Modified');
      expect(state.canRedo).toBe(true);
    });

    it('does nothing when past is empty', () => {
      const { undo } = useHistoryStore.getState();

      useLayoutStore.getState().setName('Current State');
      undo();

      // Should still be the current state
      expect(useLayoutStore.getState().layout.name).toBe('Current State');
    });

    it('updates canUndo correctly after undo', () => {
      const { push, undo } = useHistoryStore.getState();

      // Push two states
      push(JSON.parse(JSON.stringify(createDefaultLayout())));
      push(JSON.parse(JSON.stringify({ ...createDefaultLayout(), name: 'Second' })));

      expect(useHistoryStore.getState().canUndo).toBe(true);

      undo();
      expect(useHistoryStore.getState().canUndo).toBe(true); // Still one in past

      undo();
      expect(useHistoryStore.getState().canUndo).toBe(false); // Past is empty now
    });
  });

  describe('redo', () => {
    it('restores next layout state', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())));
      useLayoutStore.getState().setName('Modified');

      undo();
      expect(useLayoutStore.getState().layout.name).toBe('Untitled layout');

      redo();
      expect(useLayoutStore.getState().layout.name).toBe('Modified');
    });

    it('moves current state to past', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())));
      useLayoutStore.getState().setName('Modified');

      undo();

      const pastLengthBefore = useHistoryStore.getState().past.length;
      redo();

      expect(useHistoryStore.getState().past.length).toBe(pastLengthBefore + 1);
    });

    it('does nothing when future is empty', () => {
      const { redo } = useHistoryStore.getState();

      useLayoutStore.getState().setName('Current State');
      redo();

      expect(useLayoutStore.getState().layout.name).toBe('Current State');
    });

    it('updates canRedo correctly after redo', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())));
      useLayoutStore.getState().setName('State 2');
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)));
      useLayoutStore.getState().setName('State 3');

      undo();
      undo();

      expect(useHistoryStore.getState().canRedo).toBe(true);
      expect(useHistoryStore.getState().future).toHaveLength(2);

      redo();
      expect(useHistoryStore.getState().canRedo).toBe(true); // Still one in future

      redo();
      expect(useHistoryStore.getState().canRedo).toBe(false); // Future is empty
    });
  });

  describe('clear', () => {
    it('clears all history', () => {
      const { push, undo, clear } = useHistoryStore.getState();

      push(JSON.parse(JSON.stringify(createDefaultLayout())));
      push(JSON.parse(JSON.stringify({ ...createDefaultLayout(), name: 'Second' })));
      undo();

      expect(useHistoryStore.getState().past.length).toBeGreaterThan(0);
      expect(useHistoryStore.getState().future.length).toBeGreaterThan(0);

      clear();

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
    });
  });

  describe('performance', () => {
    it('handles large layouts with 2500 bins efficiently', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      // Create a layout with 2500 bins (the fill limit)
      const layout = createDefaultLayout();
      layout.drawer = { width: 50, depth: 50, height: 12 };

      // Generate 2500 bins (50x50 grid of 1x1 bins)
      const bins = [];
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          bins.push({
            id: `bin-${x}-${y}`,
            layerId: layout.layers[0].id,
            x,
            y,
            width: 1,
            depth: 1,
            height: 3,
            category: layout.categories[0].id,
            label: `Bin ${x},${y}`,
            notes: '',
          });
        }
      }
      layout.bins = bins;
      expect(layout.bins).toHaveLength(2500);

      // Set the layout
      useLayoutStore.setState({ layout });

      // Measure time for 10 push operations (simulating 10 undoable actions)
      const startPush = performance.now();
      for (let i = 0; i < 10; i++) {
        push(structuredClone ? structuredClone(layout) : JSON.parse(JSON.stringify(layout)));
      }
      const pushDuration = performance.now() - startPush;

      // Should complete in reasonable time (<2000ms for 10 pushes).
      // Threshold is generous to avoid flakiness across environments
      // (CI containers, low-power machines) while still catching O(n²) regressions.
      expect(pushDuration).toBeLessThan(2000);

      // Measure undo/redo performance
      const startUndoRedo = performance.now();
      for (let i = 0; i < 5; i++) {
        undo();
        redo();
      }
      const undoRedoDuration = performance.now() - startUndoRedo;

      // Should complete in reasonable time. Generous threshold avoids flakiness
      // while still catching algorithmic regressions (previous threshold of 500ms
      // was flaky on resource-constrained environments).
      expect(undoRedoDuration).toBeLessThan(2000);
    });
  });

  describe('undo/redo workflow', () => {
    it('handles complex undo/redo sequence', () => {
      const { push, undo, redo } = useHistoryStore.getState();

      // Initial state
      const initial = useLayoutStore.getState().layout;
      push(JSON.parse(JSON.stringify(initial)));

      // State 1: Add a bin
      useLayoutStore.getState().addBin({
        layerId: initial.layers[0].id,
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: initial.categories[0].id,
        label: 'Bin 1',
        notes: '',
      });
      push(JSON.parse(JSON.stringify(useLayoutStore.getState().layout)));

      // State 2: Add another bin
      useLayoutStore.getState().addBin({
        layerId: initial.layers[0].id,
        x: 2,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: initial.categories[0].id,
        label: 'Bin 2',
        notes: '',
      });

      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);

      // Undo back to 1 bin
      undo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);
      expect(useLayoutStore.getState().layout.bins[0].label).toBe('Bin 1');

      // Undo back to 0 bins
      undo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(0);

      // Redo to 1 bin
      redo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(1);

      // Redo to 2 bins
      redo();
      expect(useLayoutStore.getState().layout.bins).toHaveLength(2);
    });
  });
});
