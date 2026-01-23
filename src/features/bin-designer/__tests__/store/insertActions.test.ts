import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { Insert } from '@/features/bin-designer/types';

describe('DesignerStore - insert actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  const createTestInsert = (overrides: Partial<Insert> = {}): Insert => ({
    id: 'test-insert-1',
    templateId: null,
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'Test Insert',
    ...overrides,
  });

  describe('addInsert', () => {
    it('adds insert to params.inserts', () => {
      const { addInsert } = useDesignerStore.getState();
      const insert = createTestInsert();

      addInsert(insert);

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(1);
      expect(params.inserts[0]).toEqual(insert);
    });

    it('adds multiple inserts in order', () => {
      const { addInsert } = useDesignerStore.getState();
      const insert1 = createTestInsert({ id: 'insert-1' });
      const insert2 = createTestInsert({ id: 'insert-2', shape: 'circle' });

      addInsert(insert1);
      addInsert(insert2);

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(2);
      expect(params.inserts[0].id).toBe('insert-1');
      expect(params.inserts[1].id).toBe('insert-2');
    });

    it('pushes history', () => {
      const { addInsert, history } = useDesignerStore.getState();
      expect(history.past).toHaveLength(0);

      addInsert(createTestInsert());

      const newHistory = useDesignerStore.getState().history;
      expect(newHistory.past).toHaveLength(1);
    });

    it('clears future history', () => {
      const { addInsert, undo } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      addInsert(createTestInsert({ id: 'insert-2' }));
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('removeInsert', () => {
    it('removes insert by id', () => {
      const { addInsert, removeInsert } = useDesignerStore.getState();
      const insert = createTestInsert({ id: 'to-remove' });
      addInsert(insert);

      removeInsert('to-remove');

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(0);
    });

    it('removes only matching insert', () => {
      const { addInsert, removeInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));
      addInsert(createTestInsert({ id: 'insert-2' }));
      addInsert(createTestInsert({ id: 'insert-3' }));

      removeInsert('insert-2');

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(2);
      expect(params.inserts[0].id).toBe('insert-1');
      expect(params.inserts[1].id).toBe('insert-3');
    });

    it('handles removing non-existent id gracefully', () => {
      const { addInsert, removeInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));

      removeInsert('non-existent');

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(1);
      expect(params.inserts[0].id).toBe('insert-1');
    });

    it('pushes history', () => {
      const { addInsert, removeInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      removeInsert('insert-1');

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });

    it('clears future history', () => {
      const { addInsert, removeInsert, undo } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      removeInsert('insert-1');
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('updateInsert', () => {
    it('updates insert by id', () => {
      const { addInsert, updateInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1', label: 'Original' }));

      updateInsert('insert-1', { label: 'Updated' });

      const { params } = useDesignerStore.getState();
      expect(params.inserts[0].label).toBe('Updated');
    });

    it('updates only specified fields', () => {
      const { addInsert, updateInsert } = useDesignerStore.getState();
      const original = createTestInsert({ id: 'insert-1', x: 10, y: 20, label: 'Test' });
      addInsert(original);

      updateInsert('insert-1', { x: 30 });

      const { params } = useDesignerStore.getState();
      expect(params.inserts[0].x).toBe(30);
      expect(params.inserts[0].y).toBe(20);
      expect(params.inserts[0].label).toBe('Test');
    });

    it('updates only matching insert', () => {
      const { addInsert, updateInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1', label: 'First' }));
      addInsert(createTestInsert({ id: 'insert-2', label: 'Second' }));

      updateInsert('insert-1', { label: 'Updated' });

      const { params } = useDesignerStore.getState();
      expect(params.inserts[0].label).toBe('Updated');
      expect(params.inserts[1].label).toBe('Second');
    });

    it('handles updating non-existent id gracefully', () => {
      const { addInsert, updateInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1', label: 'Original' }));

      updateInsert('non-existent', { label: 'Updated' });

      const { params } = useDesignerStore.getState();
      expect(params.inserts[0].label).toBe('Original');
    });

    it('pushes history', () => {
      const { addInsert, updateInsert } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      updateInsert('insert-1', { label: 'Updated' });

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });

    it('clears future history', () => {
      const { addInsert, updateInsert, undo } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      updateInsert('insert-1', { label: 'Updated' });
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('clearInserts', () => {
    it('clears all inserts', () => {
      const { addInsert, clearInserts } = useDesignerStore.getState();
      addInsert(createTestInsert({ id: 'insert-1' }));
      addInsert(createTestInsert({ id: 'insert-2' }));
      addInsert(createTestInsert({ id: 'insert-3' }));

      clearInserts();

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toEqual([]);
    });

    it('handles clearing empty array', () => {
      const { clearInserts } = useDesignerStore.getState();

      clearInserts();

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toEqual([]);
    });

    it('pushes history', () => {
      const { addInsert, clearInserts } = useDesignerStore.getState();
      addInsert(createTestInsert());

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      clearInserts();

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });

    it('clears future history', () => {
      const { addInsert, clearInserts, undo } = useDesignerStore.getState();
      addInsert(createTestInsert());
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      clearInserts();
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });
  });

  describe('setDesignListOpen', () => {
    it('sets design list open state to true', () => {
      const { setDesignListOpen } = useDesignerStore.getState();

      setDesignListOpen(true);

      const { ui } = useDesignerStore.getState();
      expect(ui.designListOpen).toBe(true);
    });

    it('sets design list open state to false', () => {
      const { setDesignListOpen } = useDesignerStore.getState();
      setDesignListOpen(true);

      setDesignListOpen(false);

      const { ui } = useDesignerStore.getState();
      expect(ui.designListOpen).toBe(false);
    });

    it('toggles state correctly', () => {
      const { setDesignListOpen } = useDesignerStore.getState();

      setDesignListOpen(true);
      expect(useDesignerStore.getState().ui.designListOpen).toBe(true);

      setDesignListOpen(false);
      expect(useDesignerStore.getState().ui.designListOpen).toBe(false);

      setDesignListOpen(true);
      expect(useDesignerStore.getState().ui.designListOpen).toBe(true);
    });
  });

  describe('history integration', () => {
    it('undo after addInsert reverts to empty', () => {
      const { addInsert, undo } = useDesignerStore.getState();

      addInsert(createTestInsert());
      undo();

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toEqual([]);
    });

    it('redo after addInsert undo restores insert', () => {
      const { addInsert, undo, redo } = useDesignerStore.getState();
      const insert = createTestInsert();

      addInsert(insert);
      undo();
      redo();

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toEqual([insert]);
    });

    it('undo after removeInsert restores insert', () => {
      const { addInsert, removeInsert, undo } = useDesignerStore.getState();
      const insert = createTestInsert({ id: 'insert-1' });

      addInsert(insert);
      removeInsert('insert-1');
      undo();

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toEqual([insert]);
    });

    it('enforces max history limit', () => {
      const { addInsert } = useDesignerStore.getState();

      for (let i = 0; i < DESIGNER_CONSTRAINTS.MAX_HISTORY + 5; i++) {
        addInsert(createTestInsert({ id: `insert-${i}` }));
      }

      const { history } = useDesignerStore.getState();
      expect(history.past.length).toBeLessThanOrEqual(DESIGNER_CONSTRAINTS.MAX_HISTORY);
    });
  });
});
