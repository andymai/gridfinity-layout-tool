import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';

describe('DesignerStore - cutout actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  const createTestCutout = (overrides: Partial<Cutout> = {}): Cutout => ({
    id: 'test-cutout-1',
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'Test Cutout',
    groupId: null,
    ...overrides,
  });

  describe('addCutout', () => {
    it('adds cutout to params.cutouts', () => {
      const { addCutout } = useDesignerStore.getState();
      const cutout = createTestCutout();

      addCutout(cutout);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(1);
      expect(params.cutouts[0]).toEqual(cutout);
    });

    it('adds multiple cutouts in order', () => {
      const { addCutout } = useDesignerStore.getState();
      const cutout1 = createTestCutout({ id: 'cutout-1' });
      const cutout2 = createTestCutout({ id: 'cutout-2', shape: 'circle' });

      addCutout(cutout1);
      addCutout(cutout2);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(2);
      expect(params.cutouts[0].id).toBe('cutout-1');
      expect(params.cutouts[1].id).toBe('cutout-2');
    });

    it('pushes history', () => {
      const { addCutout, history } = useDesignerStore.getState();
      expect(history.past).toHaveLength(0);

      addCutout(createTestCutout());

      const newHistory = useDesignerStore.getState().history;
      expect(newHistory.past).toHaveLength(1);
    });
  });

  describe('removeCutout', () => {
    it('removes cutout by id', () => {
      const { addCutout, removeCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'to-remove' }));

      removeCutout('to-remove');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(0);
    });

    it('removes only matching cutout', () => {
      const { addCutout, removeCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      addCutout(createTestCutout({ id: 'cutout-3' }));

      removeCutout('cutout-2');

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(2);
      expect(params.cutouts[0].id).toBe('cutout-1');
      expect(params.cutouts[1].id).toBe('cutout-3');
    });

    it('pushes history', () => {
      const { addCutout, removeCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;
      removeCutout('cutout-1');

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });
  });

  describe('updateCutout', () => {
    it('updates cutout by id', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', label: 'Original' }));

      updateCutout('cutout-1', { label: 'Updated' });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].label).toBe('Updated');
    });

    it('updates only specified fields', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', x: 10, y: 20, label: 'Test' }));

      updateCutout('cutout-1', { x: 30 });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].x).toBe(30);
      expect(params.cutouts[0].y).toBe(20);
      expect(params.cutouts[0].label).toBe('Test');
    });

    it('pushes history', () => {
      const { addCutout, updateCutout } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;
      updateCutout('cutout-1', { label: 'Updated' });

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });
  });

  describe('clearCutouts', () => {
    it('clears all cutouts', () => {
      const { addCutout, clearCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));

      clearCutouts();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toEqual([]);
    });

    it('pushes history', () => {
      const { addCutout, clearCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout());

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;
      clearCutouts();

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });
  });

  describe('duplicateCutouts', () => {
    it('duplicates selected cutouts with 5mm offset', () => {
      const { addCutout, duplicateCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', x: 10, y: 10 }));

      duplicateCutouts(['cutout-1']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(2);
      expect(params.cutouts[1].x).toBe(15);
      expect(params.cutouts[1].y).toBe(15);
      expect(params.cutouts[1].id).not.toBe('cutout-1');
    });

    it('preserves group structure on duplicated cutouts with new groupId', () => {
      const { addCutout, duplicateCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1', groupId: 'group-1' }));
      addCutout(createTestCutout({ id: 'cutout-2', groupId: 'group-1', x: 20 }));

      duplicateCutouts(['cutout-1', 'cutout-2']);

      const { params } = useDesignerStore.getState();
      // Duplicated cutouts should share a new groupId (not the original)
      const dup1 = params.cutouts[2];
      const dup2 = params.cutouts[3];
      expect(dup1.groupId).not.toBeNull();
      expect(dup1.groupId).not.toBe('group-1');
      expect(dup1.groupId).toBe(dup2.groupId);
    });

    it('does nothing for empty array', () => {
      const { duplicateCutouts } = useDesignerStore.getState();
      duplicateCutouts([]);

      const { history } = useDesignerStore.getState();
      expect(history.past).toHaveLength(0);
    });

    it('translates absolute path points alongside the 5mm offset', () => {
      const { addCutout, duplicateCutouts } = useDesignerStore.getState();
      addCutout(
        createTestCutout({
          id: 'p-1',
          shape: 'path',
          x: 10,
          y: 10,
          path: [
            { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 20, y: 10, handleIn: null, handleOut: null, symmetric: false },
          ],
        })
      );

      duplicateCutouts(['p-1']);

      const dup = useDesignerStore.getState().params.cutouts[1];
      expect(dup.x).toBe(15);
      expect(dup.y).toBe(15);
      expect(dup.path).toEqual([
        { x: 15, y: 15, handleIn: null, handleOut: null, symmetric: false },
        { x: 25, y: 15, handleIn: null, handleOut: null, symmetric: false },
      ]);
    });
  });

  describe('groupCutouts', () => {
    it('assigns shared groupId to selected cutouts', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));

      groupCutouts(['cutout-1', 'cutout-2']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].groupId).not.toBeNull();
      expect(params.cutouts[0].groupId).toBe(params.cutouts[1].groupId);
    });

    it('does not group if fewer than 2 cutouts', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));

      groupCutouts(['cutout-1']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].groupId).toBeNull();
    });

    it('does not affect unselected cutouts', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      addCutout(createTestCutout({ id: 'cutout-3' }));

      groupCutouts(['cutout-1', 'cutout-2']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[2].groupId).toBeNull();
    });

    it('reuses existing groupId when adding to an existing group', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      addCutout(createTestCutout({ id: 'cutout-3' }));

      // Group first two
      groupCutouts(['cutout-1', 'cutout-2']);
      const existingGroupId = useDesignerStore.getState().params.cutouts[0].groupId;
      expect(existingGroupId).not.toBeNull();

      // Add third cutout to the group (includes one already-grouped member)
      groupCutouts(['cutout-2', 'cutout-3']);

      const { params } = useDesignerStore.getState();
      // All three should share the same original groupId
      expect(params.cutouts[0].groupId).toBe(existingGroupId);
      expect(params.cutouts[1].groupId).toBe(existingGroupId);
      expect(params.cutouts[2].groupId).toBe(existingGroupId);
    });

    it('includes all existing group members when reusing groupId', () => {
      const { addCutout, groupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));
      addCutout(createTestCutout({ id: 'cutout-3' }));
      addCutout(createTestCutout({ id: 'cutout-4' }));

      // Group first three
      groupCutouts(['cutout-1', 'cutout-2', 'cutout-3']);
      const existingGroupId = useDesignerStore.getState().params.cutouts[0].groupId;

      // Add cutout-4 by grouping with just cutout-1 (rest of group should be auto-included)
      groupCutouts(['cutout-1', 'cutout-4']);

      const { params } = useDesignerStore.getState();
      // All four should have the same groupId
      for (const c of params.cutouts) {
        expect(c.groupId).toBe(existingGroupId);
      }
    });
  });

  describe('ungroupCutouts', () => {
    it('sets groupId to null on selected cutouts', () => {
      const { addCutout, groupCutouts, ungroupCutouts } = useDesignerStore.getState();
      addCutout(createTestCutout({ id: 'cutout-1' }));
      addCutout(createTestCutout({ id: 'cutout-2' }));

      groupCutouts(['cutout-1', 'cutout-2']);
      expect(useDesignerStore.getState().params.cutouts[0].groupId).not.toBeNull();

      ungroupCutouts(['cutout-1', 'cutout-2']);

      const { params } = useDesignerStore.getState();
      expect(params.cutouts[0].groupId).toBeNull();
      expect(params.cutouts[1].groupId).toBeNull();
    });
  });

  describe('history integration', () => {
    it('undo after addCutout reverts to empty', () => {
      const { addCutout, undo } = useDesignerStore.getState();
      addCutout(createTestCutout());
      undo();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toEqual([]);
    });

    it('redo after addCutout undo restores cutout', () => {
      const { addCutout, undo, redo } = useDesignerStore.getState();
      const cutout = createTestCutout();

      addCutout(cutout);
      undo();
      redo();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toEqual([cutout]);
    });

    it('undo after removeCutout restores cutout', () => {
      const { addCutout, removeCutout, undo } = useDesignerStore.getState();
      const cutout = createTestCutout({ id: 'cutout-1' });

      addCutout(cutout);
      removeCutout('cutout-1');
      undo();

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toEqual([cutout]);
    });
  });
});
