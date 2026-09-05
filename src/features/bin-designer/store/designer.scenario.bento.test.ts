import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import {
  getCompartmentRect,
  getDrawnCompartmentIds,
} from '@/features/bin-designer/utils/bentoDraw';
import { getCellsForCompartment } from '@/features/bin-designer/utils/compartments';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { labelTabFootprints } from '@/shared/utils/labelTabPlan';

describe('DesignerStore - bento draw actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().setCompartmentGrid(4, 3);
    // The grid setup above is scaffolding, not part of the scenario under test.
    useDesignerStore.setState((s) => ({ history: { ...s.history, past: [] } }));
  });

  const params = () => useDesignerStore.getState().params;
  const epoch = () => useDesignerStore.getState().generation.epoch;

  describe('drawBentoCompartment', () => {
    it('draws over background and returns the normalized id', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      expect(id).not.toBeNull();
      if (id === null) throw new Error('unreachable');
      expect(getCompartmentRect(params().compartments, id)).toEqual({ col: 0, row: 0, w: 2, h: 2 });
      expect(useDesignerStore.getState().history.past).toHaveLength(1);
    });

    it('refuses a blocked draw without pushing history or bumping the epoch', () => {
      useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      const before = epoch();
      const historyLen = useDesignerStore.getState().history.past.length;
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 1, row: 1, w: 2, h: 2 });
      expect(id).toBeNull();
      expect(epoch()).toBe(before);
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen);
    });
  });

  describe('moveBentoCompartment', () => {
    it('moves and carries the label to the new id', () => {
      const store = useDesignerStore.getState();
      const id = store.drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      useDesignerStore.getState().setCompartmentText(id, 'bits');
      const moved = useDesignerStore.getState().moveBentoCompartment(id, 2, 1);
      expect(moved).not.toBeNull();
      if (moved === null) throw new Error('unreachable');
      expect(getCompartmentRect(params().compartments, moved)).toEqual({
        col: 2,
        row: 1,
        w: 2,
        h: 2,
      });
      expect(params().compartments.compartmentTexts?.[moved]).toBe('bits');
    });

    it('a zero-delta move is a true no-op', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      const before = epoch();
      const historyLen = useDesignerStore.getState().history.past.length;
      expect(useDesignerStore.getState().moveBentoCompartment(id, 0, 0)).toBe(id);
      expect(epoch()).toBe(before);
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen);
    });
  });

  describe('resize + duplicate + remove', () => {
    it('resizeBentoCompartment applies the new footprint', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 1 });
      if (id === null) throw new Error('unreachable');
      const resized = useDesignerStore
        .getState()
        .resizeBentoCompartment(id, { col: 0, row: 0, w: 3, h: 2 });
      expect(resized).not.toBeNull();
      if (resized === null) throw new Error('unreachable');
      expect(getCompartmentRect(params().compartments, resized)).toEqual({
        col: 0,
        row: 0,
        w: 3,
        h: 2,
      });
    });

    it('duplicateBentoCompartment stamps a labeled copy', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 1 });
      if (id === null) throw new Error('unreachable');
      useDesignerStore.getState().setCompartmentText(id, 'washers');
      const copy = useDesignerStore
        .getState()
        .duplicateBentoCompartment(id, { col: 2, row: 1, w: 2, h: 1 });
      expect(copy).not.toBeNull();
      if (copy === null) throw new Error('unreachable');
      expect(params().compartments.compartmentTexts?.[copy]).toBe('washers');
      expect(getDrawnCompartmentIds(params().compartments).size).toBe(2);
    });

    it('removeBentoCompartment reverts to background and drops the label', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      useDesignerStore.getState().setCompartmentText(id, 'gone');
      expect(useDesignerStore.getState().removeBentoCompartment(id)).toBe(true);
      expect(getDrawnCompartmentIds(params().compartments).size).toBe(0);
      expect(params().compartments.compartmentTexts).toBeUndefined();
    });
  });

  describe('stash', () => {
    it('stash → place round-trips the footprint and label', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      useDesignerStore.getState().setCompartmentText(id, 'bits');
      expect(useDesignerStore.getState().stashBentoCompartment(id)).toBe(true);
      expect(params().compartments.stash).toEqual([{ w: 2, h: 2, label: 'bits' }]);
      expect(getDrawnCompartmentIds(params().compartments).size).toBe(0);

      const placed = useDesignerStore
        .getState()
        .placeBentoStashEntry(0, { col: 2, row: 1, w: 2, h: 2 });
      expect(placed).not.toBeNull();
      if (placed === null) throw new Error('unreachable');
      expect(params().compartments.stash).toBeUndefined();
      expect(params().compartments.compartmentTexts?.[placed]).toBe('bits');
    });

    it('removeBentoStashEntry is undoable but does not bump the epoch', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      useDesignerStore.getState().stashBentoCompartment(id);
      const before = epoch();
      const historyLen = useDesignerStore.getState().history.past.length;
      expect(useDesignerStore.getState().removeBentoStashEntry(0)).toBe(true);
      expect(params().compartments.stash).toBeUndefined();
      expect(epoch()).toBe(before);
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen + 1);
      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params.compartments.stash).toEqual([{ w: 2, h: 2 }]);
    });
  });

  describe('setBentoGridPreserving', () => {
    it('keeps fitting compartments and stashes displaced ones with a count', () => {
      const store = useDesignerStore.getState();
      const a = store.drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (a === null) throw new Error('unreachable');
      const b = useDesignerStore.getState().drawBentoCompartment({ col: 3, row: 0, w: 1, h: 2 });
      expect(b).not.toBeNull();

      const result = useDesignerStore.getState().setBentoGridPreserving(2, 3);
      expect(result).toEqual({ stashedCount: 1, droppedCount: 0 });
      expect(params().compartments.cols).toBe(2);
      expect(params().compartments.stash).toEqual([{ w: 1, h: 2 }]);
      expect(getDrawnCompartmentIds(params().compartments).size).toBe(1);
    });

    it('same dimensions is a no-op returning zero counts', () => {
      const historyLen = useDesignerStore.getState().history.past.length;
      expect(useDesignerStore.getState().setBentoGridPreserving(4, 3)).toEqual({
        stashedCount: 0,
        droppedCount: 0,
      });
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen);
    });

    it('rejects a fractional dimension rather than sizing a cell array by it', () => {
      expect(useDesignerStore.getState().setBentoGridPreserving(2.5, 3)).toBeNull();
      expect(params().compartments.cols).toBe(4);
      expect(params().compartments.cells).toHaveLength(12);
    });

    it('rejects dimensions that fail the min-compartment-size pre-flight', () => {
      useDesignerStore.getState().setParam('width', 1);
      useDesignerStore.getState().setParam('depth', 1);
      expect(
        useDesignerStore
          .getState()
          .setBentoGridPreserving(
            DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID,
            DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
          )
      ).toBeNull();
    });
  });

  describe('clearBentoCompartments', () => {
    it('clears drawn compartments but keeps the stash', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      useDesignerStore.getState().stashBentoCompartment(id);
      const second = useDesignerStore
        .getState()
        .drawBentoCompartment({ col: 0, row: 0, w: 2, h: 1 });
      expect(second).not.toBeNull();

      useDesignerStore.getState().clearBentoCompartments();
      expect(getDrawnCompartmentIds(params().compartments).size).toBe(0);
      expect(params().compartments.stash).toEqual([{ w: 2, h: 2 }]);
    });

    it('is a no-op on a background-only grid', () => {
      const historyLen = useDesignerStore.getState().history.past.length;
      useDesignerStore.getState().clearBentoCompartments();
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen);
    });
  });

  describe('undo across a draw', () => {
    it('restores the pre-draw grid', () => {
      const before = params().compartments.cells;
      useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      useDesignerStore.getState().undo();
      expect(useDesignerStore.getState().params.compartments.cells).toEqual(before);
    });
  });

  /**
   * A caption only ever prints via a label tab, and label tabs default to off —
   * so typing one used to store text that could never become geometry, which is
   * exactly what "nothing happens in the 3D preview" looked like. These assert
   * through the real plan rather than the `label.enabled` flag: the flag is the
   * mechanism, a tab footprint carrying the text is the outcome.
   */
  describe('engraved captions reach the model', () => {
    const footprints = () => {
      const p = params();
      const dims = binDimensions(p);
      return labelTabFootprints(p, dims.innerW, dims.innerD, dims.wallHeight, p.wallThickness);
    };

    const drawOne = (): number => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 2 });
      if (id === null) throw new Error('unreachable');
      return id;
    };

    it('a first caption turns label tabs on and plans a tab', () => {
      const id = drawOne();
      expect(params().label.enabled).toBe(false);
      expect(footprints()).toEqual([]);

      useDesignerStore.getState().setCompartmentText(id, 'screws');

      expect(params().label.enabled).toBe(true);
      expect(footprints().length).toBeGreaterThan(0);
    });

    it('enabling costs one undo, not two', () => {
      const id = drawOne();
      const before = useDesignerStore.getState().history.past.length;

      useDesignerStore.getState().setCompartmentText(id, 'screws');
      expect(useDesignerStore.getState().history.past).toHaveLength(before + 1);

      useDesignerStore.getState().undo();
      expect(params().label.enabled).toBe(false);
      expect(params().compartments.compartmentTexts?.[id] ?? '').toBe('');
    });

    it('clearing a caption never turns tabs on', () => {
      const id = drawOne();
      useDesignerStore.getState().setCompartmentText(id, '');
      expect(params().label.enabled).toBe(false);
    });

    it('leaves tabs alone where the constraint engine rules them out', () => {
      const id = drawOne();
      // A spacer is floorless, so it has nothing to hang a label tab from and
      // the panel refuses to show the control at all.
      useDesignerStore.getState().setParam('base', { ...params().base, spacer: true });

      useDesignerStore.getState().setCompartmentText(id, 'screws');

      expect(params().label.enabled).toBe(false);
      expect(params().compartments.compartmentTexts?.[id]).toBe('screws');
    });
  });

  describe('mergeBentoCompartments', () => {
    it('fuses two neighbours into one non-rectangular compartment', () => {
      const a = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 1 });
      const b = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 1, w: 1, h: 1 });
      if (a === null || b === null) throw new Error('unreachable');

      const merged = useDesignerStore.getState().mergeBentoCompartments([a, b]);
      expect(merged).not.toBeNull();
      if (merged === null) throw new Error('unreachable');

      const cells = params().compartments.cells;
      expect(cells.filter((id) => id === merged)).toHaveLength(3);
      // The L fills three of the four cells its bounding box covers.
      expect(getCompartmentRect(params().compartments, merged)).toEqual({
        col: 0,
        row: 0,
        w: 2,
        h: 2,
      });
    });

    it('carries the L through a move, a stash and a placement', () => {
      const a = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 2, h: 1 });
      const b = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 1, w: 1, h: 1 });
      if (a === null || b === null) throw new Error('unreachable');
      const merged = useDesignerStore.getState().mergeBentoCompartments([a, b]);
      if (merged === null) throw new Error('unreachable');

      const moved = useDesignerStore.getState().moveBentoCompartment(merged, 2, 1);
      if (moved === null) throw new Error('unreachable');
      expect(getCellsForCompartment(params().compartments, moved)).toEqual([6, 7, 10]);

      expect(useDesignerStore.getState().stashBentoCompartment(moved)).toBe(true);
      expect(params().compartments.stash).toEqual([
        { w: 2, h: 2, cells: [true, true, true, false] },
      ]);

      const placed = useDesignerStore
        .getState()
        .placeBentoStashEntry(0, { col: 0, row: 0, w: 2, h: 2 });
      if (placed === null) throw new Error('unreachable');
      expect(getCellsForCompartment(params().compartments, placed)).toEqual([0, 1, 4]);
    });

    it('refuses compartments that do not touch, without touching history', () => {
      const a = useDesignerStore.getState().drawBentoCompartment({ col: 0, row: 0, w: 1, h: 1 });
      const b = useDesignerStore.getState().drawBentoCompartment({ col: 3, row: 2, w: 1, h: 1 });
      if (a === null || b === null) throw new Error('unreachable');
      const historyLen = useDesignerStore.getState().history.past.length;

      expect(useDesignerStore.getState().mergeBentoCompartments([a, b])).toBeNull();
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen);
    });
  });

  describe('setBentoMergeBackground', () => {
    it('collapses leftover cells into one pocket per open area', () => {
      const id = useDesignerStore.getState().drawBentoCompartment({ col: 1, row: 1, w: 1, h: 1 });
      if (id === null) throw new Error('unreachable');

      useDesignerStore.getState().setBentoMergeBackground(true);

      const compartments = params().compartments;
      expect(compartments.mergeBackground).toBe(true);
      // One leftover region wrapping the drawn cell, plus the cell itself.
      expect(compartments.backgroundIds).toHaveLength(1);
      expect(new Set(compartments.cells).size).toBe(2);
      expect(getDrawnCompartmentIds(compartments).size).toBe(1);
    });

    it('hands the leftover back as unit pockets when turned off', () => {
      useDesignerStore.getState().drawBentoCompartment({ col: 1, row: 1, w: 1, h: 1 });
      useDesignerStore.getState().setBentoMergeBackground(true);

      useDesignerStore.getState().setBentoMergeBackground(false);

      const compartments = params().compartments;
      expect(compartments.mergeBackground).toBeUndefined();
      expect(compartments.backgroundIds).toBeUndefined();
      // 4x3 grid, all cells their own pocket again.
      expect(new Set(compartments.cells).size).toBe(12);
    });

    it('is a no-op when already in that mode', () => {
      const historyLen = useDesignerStore.getState().history.past.length;
      useDesignerStore.getState().setBentoMergeBackground(false);
      expect(useDesignerStore.getState().history.past).toHaveLength(historyLen);
    });
  });
});
