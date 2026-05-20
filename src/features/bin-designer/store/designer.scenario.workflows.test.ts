/**
 * Multi-action workflow scenarios.
 *
 * Verifies state coherence under realistic user sequences:
 * create → group → modify → undo across multiple resource types.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, Insert } from '@/features/bin-designer/types';

const cutout = (overrides: Partial<Cutout> = {}): Cutout => ({
  id: 'c1',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 15,
  depth: 15,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

const insert = (overrides: Partial<Insert> = {}): Insert => ({
  id: 'i1',
  templateId: null,
  shape: 'circle',
  x: 0,
  y: 0,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  ...overrides,
});

describe('DesignerStore - multi-action workflows', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('cutout lifecycle', () => {
    it('add → update → remove → undo trail walks back through each step', () => {
      const { addCutout, updateCutout, removeCutout, undo } = useDesignerStore.getState();

      addCutout(cutout({ id: 'c1', width: 10 }));
      updateCutout('c1', { width: 25 });
      removeCutout('c1');

      expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
      undo();
      expect(useDesignerStore.getState().params.cutouts).toHaveLength(1);
      expect(useDesignerStore.getState().params.cutouts[0].width).toBe(25);
      undo();
      expect(useDesignerStore.getState().params.cutouts[0].width).toBe(10);
      undo();
      expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
    });

    it('add → group two → ungroup keeps both cutouts', () => {
      const { addCutout, groupCutouts, ungroupCutouts } = useDesignerStore.getState();

      addCutout(cutout({ id: 'a', x: -10 }));
      addCutout(cutout({ id: 'b', x: 10 }));
      groupCutouts(['a', 'b']);

      let cuts = useDesignerStore.getState().params.cutouts;
      expect(cuts).toHaveLength(2);
      expect(cuts[0].groupId).not.toBeNull();
      expect(cuts[0].groupId).toBe(cuts[1].groupId);

      ungroupCutouts(['a', 'b']);
      cuts = useDesignerStore.getState().params.cutouts;
      expect(cuts).toHaveLength(2);
      expect(cuts[0].groupId).toBeNull();
      expect(cuts[1].groupId).toBeNull();
    });

    it('group → remove member → group dissolves to singleton (null groupId)', () => {
      const { addCutout, groupCutouts, removeCutout } = useDesignerStore.getState();

      addCutout(cutout({ id: 'a', x: -10 }));
      addCutout(cutout({ id: 'b', x: 10 }));
      groupCutouts(['a', 'b']);
      removeCutout('b');

      const remaining = useDesignerStore.getState().params.cutouts;
      expect(remaining).toHaveLength(1);
      // dissolveSingletonGroups clears groupId when only one member left
      expect(remaining[0].groupId).toBeNull();
    });
  });

  describe('cross-feature workflows', () => {
    it('create insert → enable scoop → toggle solid mode → all state coherent', () => {
      const { addInsert, updateScoop, updateBase } = useDesignerStore.getState();

      addInsert(insert({ id: 'i1' }));
      updateScoop({ enabled: true });
      updateBase({ solid: true });

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(1);
      expect(params.scoop.enabled).toBe(true);
      expect(params.base.solid).toBe(true);
    });

    it('add cutout → group with another → enable lid → state coherent', () => {
      const { addCutout, groupCutouts, updateLid } = useDesignerStore.getState();

      addCutout(cutout({ id: 'a' }));
      addCutout(cutout({ id: 'b', x: 20 }));
      groupCutouts(['a', 'b']);
      updateLid({ enabled: true });

      const { params } = useDesignerStore.getState();
      expect(params.cutouts).toHaveLength(2);
      expect(params.cutouts[0].groupId).not.toBeNull();
      expect(params.lid.enabled).toBe(true);
    });

    it('add insert + add cutout coexist independently', () => {
      const { addInsert, addCutout } = useDesignerStore.getState();
      addInsert(insert({ id: 'i1' }));
      addCutout(cutout({ id: 'c1' }));

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(1);
      expect(params.cutouts).toHaveLength(1);
    });
  });

  describe('undo across feature boundaries', () => {
    it('undo walks back across insert/cutout/lid/scoop changes', () => {
      const { addInsert, addCutout, updateLid, updateScoop, undo } = useDesignerStore.getState();

      addInsert(insert({ id: 'i1' })); // [1]
      addCutout(cutout({ id: 'c1' })); // [2]
      updateLid({ enabled: true }); // [3]
      updateScoop({ enabled: true }); // [4]

      // Latest first
      undo(); // undoes scoop
      expect(useDesignerStore.getState().params.scoop.enabled).toBe(false);
      expect(useDesignerStore.getState().params.lid.enabled).toBe(true);

      undo(); // undoes lid
      expect(useDesignerStore.getState().params.lid.enabled).toBe(false);
      expect(useDesignerStore.getState().params.cutouts).toHaveLength(1);

      undo(); // undoes cutout
      expect(useDesignerStore.getState().params.cutouts).toHaveLength(0);
      expect(useDesignerStore.getState().params.inserts).toHaveLength(1);

      undo(); // undoes insert
      expect(useDesignerStore.getState().params.inserts).toHaveLength(0);
    });
  });

  describe('compartments + bin style transitions', () => {
    it('split compartments work after style switches', () => {
      const { setCompartmentGrid, setParam } = useDesignerStore.getState();

      setCompartmentGrid(2, 2);
      setParam('style', 'slotted');
      setParam('style', 'standard');

      const { params } = useDesignerStore.getState();
      expect(params.compartments.cols).toBe(2);
      expect(params.compartments.rows).toBe(2);
      expect(params.style).toBe('standard');
    });

    it('enabling base.solid keeps inserts but ignores compartments in geometry', () => {
      const { addInsert, setCompartmentGrid, updateBase } = useDesignerStore.getState();

      setCompartmentGrid(2, 2);
      addInsert(insert({ id: 'i1' }));
      updateBase({ solid: true });

      const { params } = useDesignerStore.getState();
      expect(params.base.solid).toBe(true);
      expect(params.inserts).toHaveLength(1);
      // compartments data persists even though solid-mode generator ignores it
      expect(params.compartments.cols).toBe(2);
    });
  });

  describe('redo invariants', () => {
    it('redo after partial undo restores latest state', () => {
      const { addInsert, updateLid, undo, redo } = useDesignerStore.getState();

      addInsert(insert({ id: 'i1' }));
      updateLid({ enabled: true });
      undo(); // undo lid
      redo(); // redo lid

      const { params } = useDesignerStore.getState();
      expect(params.inserts).toHaveLength(1);
      expect(params.lid.enabled).toBe(true);
    });

    it('new action after undo clears redo stack', () => {
      const { addInsert, addCutout, undo } = useDesignerStore.getState();

      addInsert(insert({ id: 'i1' }));
      undo();
      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      addCutout(cutout({ id: 'c1' }));
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });
  });
});
