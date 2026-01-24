import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { DEFAULT_BIN_PARAMS, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';

describe('DesignerStore - compartment actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('setCompartmentGrid', () => {
    it('creates correct cells array for uniform grid', () => {
      const { setCompartmentGrid } = useDesignerStore.getState();
      setCompartmentGrid(3, 2);

      const { params } = useDesignerStore.getState();
      expect(params.compartments.cols).toBe(3);
      expect(params.compartments.rows).toBe(2);
      expect(params.compartments.cells).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('creates single cell for 1x1 grid', () => {
      const { setCompartmentGrid } = useDesignerStore.getState();
      setCompartmentGrid(1, 1);

      const { params } = useDesignerStore.getState();
      expect(params.compartments.cells).toEqual([0]);
    });

    it('creates correct cells array for non-square grid', () => {
      const { setCompartmentGrid } = useDesignerStore.getState();
      setCompartmentGrid(4, 2);

      const { params } = useDesignerStore.getState();
      expect(params.compartments.cells).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('pushes current params to history', () => {
      const { setCompartmentGrid, history } = useDesignerStore.getState();
      expect(history.past).toHaveLength(0);

      setCompartmentGrid(2, 2);

      const newHistory = useDesignerStore.getState().history;
      expect(newHistory.past).toHaveLength(1);
      expect(newHistory.past[0].params).toEqual(DEFAULT_BIN_PARAMS);
    });

    it('clears future history', () => {
      const { setCompartmentGrid, undo } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      undo();

      // After undo, future should have one entry
      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      // New action should clear future
      setCompartmentGrid(3, 3);
      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });

    it('preserves thickness when changing grid', () => {
      const { setParam, setCompartmentGrid } = useDesignerStore.getState();
      setParam('compartments', { cols: 1, rows: 1, thickness: 2.0, cells: [0] });

      setCompartmentGrid(2, 2);

      const { params } = useDesignerStore.getState();
      expect(params.compartments.thickness).toBe(2.0);
    });

    it('enforces max history limit', () => {
      const { setCompartmentGrid } = useDesignerStore.getState();

      // Create more than MAX_HISTORY entries
      for (let i = 0; i < DESIGNER_CONSTRAINTS.MAX_HISTORY + 5; i++) {
        setCompartmentGrid(2, 2);
      }

      const { history } = useDesignerStore.getState();
      expect(history.past.length).toBeLessThanOrEqual(DESIGNER_CONSTRAINTS.MAX_HISTORY);
    });
  });

  describe('mergeCells', () => {
    beforeEach(() => {
      // Set up a 3x3 grid for merge tests
      const { setCompartmentGrid } = useDesignerStore.getState();
      setCompartmentGrid(3, 3);
    });

    it('merges valid rectangular selection', () => {
      const { mergeCells } = useDesignerStore.getState();
      // Merge top-left 2x2 block (indices 0,1,3,4)
      mergeCells([0, 1, 3, 4]);

      const { params } = useDesignerStore.getState();
      // After normalization, merged cells should have same ID
      const mergedId = params.compartments.cells[0];
      expect(params.compartments.cells[1]).toBe(mergedId);
      expect(params.compartments.cells[3]).toBe(mergedId);
      expect(params.compartments.cells[4]).toBe(mergedId);
      // Other cells should be different
      expect(params.compartments.cells[2]).not.toBe(mergedId);
    });

    it('normalizes IDs after merge', () => {
      const { mergeCells } = useDesignerStore.getState();
      mergeCells([0, 1, 3, 4]);

      const { params } = useDesignerStore.getState();
      const uniqueIds = [...new Set(params.compartments.cells)];
      // Should have contiguous IDs starting from 0
      expect(uniqueIds.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('uses lowest existing ID as target', () => {
      const { mergeCells } = useDesignerStore.getState();
      // Initial grid is [0,1,2,3,4,5,6,7,8]
      // Merge indices 0,1 (IDs 0,1) should result in target ID 0
      mergeCells([0, 1]);

      const { params } = useDesignerStore.getState();
      const mergedId = params.compartments.cells[0];
      expect(params.compartments.cells[1]).toBe(mergedId);
      // After normalization, should still be 0 (lowest)
      expect(mergedId).toBe(0);
    });

    it('rejects non-rectangular selection (L-shape)', () => {
      const { mergeCells } = useDesignerStore.getState();
      const beforeCells = [...useDesignerStore.getState().params.compartments.cells];

      // L-shaped selection: indices 0,1,3 (not rectangular)
      mergeCells([0, 1, 3]);

      const afterCells = useDesignerStore.getState().params.compartments.cells;
      expect(afterCells).toEqual(beforeCells);
    });

    it('rejects non-rectangular selection (diagonal)', () => {
      const { mergeCells } = useDesignerStore.getState();
      const beforeCells = [...useDesignerStore.getState().params.compartments.cells];

      // Diagonal selection: indices 0,4,8 (not rectangular)
      mergeCells([0, 4, 8]);

      const afterCells = useDesignerStore.getState().params.compartments.cells;
      expect(afterCells).toEqual(beforeCells);
    });

    it('rejects selection with < 2 cells', () => {
      const { mergeCells } = useDesignerStore.getState();
      const beforeCells = [...useDesignerStore.getState().params.compartments.cells];

      mergeCells([0]);

      const afterCells = useDesignerStore.getState().params.compartments.cells;
      expect(afterCells).toEqual(beforeCells);
    });

    it('rejects empty selection', () => {
      const { mergeCells } = useDesignerStore.getState();
      const beforeCells = [...useDesignerStore.getState().params.compartments.cells];

      mergeCells([]);

      const afterCells = useDesignerStore.getState().params.compartments.cells;
      expect(afterCells).toEqual(beforeCells);
    });

    it('handles full row merge', () => {
      const { mergeCells } = useDesignerStore.getState();
      // Merge entire top row: indices 0,1,2
      mergeCells([0, 1, 2]);

      const { params } = useDesignerStore.getState();
      const mergedId = params.compartments.cells[0];
      expect(params.compartments.cells[1]).toBe(mergedId);
      expect(params.compartments.cells[2]).toBe(mergedId);
      expect(params.compartments.cells[3]).not.toBe(mergedId);
    });

    it('handles full column merge', () => {
      const { mergeCells } = useDesignerStore.getState();
      // Merge entire left column: indices 0,3,6
      mergeCells([0, 3, 6]);

      const { params } = useDesignerStore.getState();
      const mergedId = params.compartments.cells[0];
      expect(params.compartments.cells[3]).toBe(mergedId);
      expect(params.compartments.cells[6]).toBe(mergedId);
      expect(params.compartments.cells[1]).not.toBe(mergedId);
    });

    it('pushes history on successful merge', () => {
      const { mergeCells, history } = useDesignerStore.getState();
      const beforeHistoryLength = history.past.length;

      mergeCells([0, 1, 3, 4]);

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });

    it('does not push history on rejected merge', () => {
      const { mergeCells, history } = useDesignerStore.getState();
      const beforeHistoryLength = history.past.length;

      mergeCells([0]); // Invalid: < 2 cells

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength);
    });

    it('clears future history on successful merge', () => {
      const { setCompartmentGrid, undo, mergeCells } = useDesignerStore.getState();
      setCompartmentGrid(3, 3);
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      mergeCells([0, 1, 3, 4]);

      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });

    it('handles merging already-merged cells', () => {
      const { mergeCells } = useDesignerStore.getState();
      // First merge: top-left 2x2
      mergeCells([0, 1, 3, 4]);

      const afterFirst = [...useDesignerStore.getState().params.compartments.cells];

      // Second merge: try to merge same cells again
      mergeCells([0, 1, 3, 4]);

      const afterSecond = useDesignerStore.getState().params.compartments.cells;
      // Should still work (idempotent)
      expect(afterSecond).toEqual(afterFirst);
    });
  });

  describe('splitCompartment', () => {
    it('splits multi-cell compartment into individuals', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);

      // Merge all 4 cells
      mergeCells([0, 1, 2, 3]);

      const mergedCells = useDesignerStore.getState().params.compartments.cells;
      const mergedId = mergedCells[0];

      // All cells should have same ID after merge
      expect(mergedCells.every((id) => id === mergedId)).toBe(true);

      // Split the merged compartment
      splitCompartment(mergedId);

      const splitCells = useDesignerStore.getState().params.compartments.cells;
      // After split, all cells should have unique IDs
      const uniqueIds = new Set(splitCells);
      expect(uniqueIds.size).toBe(4);
    });

    it('normalizes IDs after split', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      mergeCells([0, 1, 2, 3]);

      const mergedId = useDesignerStore.getState().params.compartments.cells[0];
      splitCompartment(mergedId);

      const { params } = useDesignerStore.getState();
      const uniqueIds = [...new Set(params.compartments.cells)].sort((a, b) => a - b);
      // Should have contiguous IDs starting from 0
      expect(uniqueIds).toEqual([0, 1, 2, 3]);
    });

    it('keeps first cell with original ID', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      mergeCells([0, 1, 2, 3]);

      const mergedId = useDesignerStore.getState().params.compartments.cells[0];
      splitCompartment(mergedId);

      const splitCells = useDesignerStore.getState().params.compartments.cells;
      // After normalization, first cell should still be ID 0
      expect(splitCells[0]).toBe(0);
      // Other cells should have different IDs
      expect(splitCells[1]).not.toBe(splitCells[0]);
      expect(splitCells[2]).not.toBe(splitCells[0]);
      expect(splitCells[3]).not.toBe(splitCells[0]);
    });

    it('handles splitting non-existent compartment gracefully', () => {
      const { setCompartmentGrid, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);

      const beforeCells = [...useDesignerStore.getState().params.compartments.cells];

      // Split compartment ID that doesn't exist
      splitCompartment(999);

      const afterCells = useDesignerStore.getState().params.compartments.cells;
      // Cells should be normalized but structure unchanged
      expect(afterCells).toEqual(beforeCells);
    });

    it('handles splitting already-individual cells', () => {
      const { setCompartmentGrid, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);

      // Grid starts as [0,1,2,3] - all individual
      splitCompartment(0);

      const { params } = useDesignerStore.getState();
      // Should remain individual (no change except normalization)
      expect(params.compartments.cells).toEqual([0, 1, 2, 3]);
    });

    it('pushes history', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      mergeCells([0, 1, 2, 3]);

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;
      const mergedId = useDesignerStore.getState().params.compartments.cells[0];

      splitCompartment(mergedId);

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });

    it('clears future history', () => {
      const { setCompartmentGrid, mergeCells, undo, splitCompartment } =
        useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      mergeCells([0, 1, 2, 3]);
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      const mergedId = useDesignerStore.getState().params.compartments.cells[0];
      splitCompartment(mergedId);

      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });

    it('splits partial compartment correctly', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment } = useDesignerStore.getState();
      setCompartmentGrid(3, 3);

      // Merge only top-left 2x2 (indices 0,1,3,4)
      mergeCells([0, 1, 3, 4]);

      const mergedId = useDesignerStore.getState().params.compartments.cells[0];
      splitCompartment(mergedId);

      const { params } = useDesignerStore.getState();
      // The 4 merged cells should now be separate
      expect(params.compartments.cells[0]).not.toBe(params.compartments.cells[1]);
      expect(params.compartments.cells[0]).not.toBe(params.compartments.cells[3]);
      expect(params.compartments.cells[0]).not.toBe(params.compartments.cells[4]);
      // Other cells should remain unchanged (relative to each other)
      const allUnique = new Set(params.compartments.cells);
      expect(allUnique.size).toBe(9); // All 9 cells should be individual
    });
  });

  describe('resetCompartments', () => {
    it('resets to default compartments', () => {
      const { setCompartmentGrid, resetCompartments } = useDesignerStore.getState();
      setCompartmentGrid(4, 4);

      resetCompartments();

      const { params } = useDesignerStore.getState();
      expect(params.compartments).toEqual(DEFAULT_BIN_PARAMS.compartments);
    });

    it('resets to 1x1 grid with single cell', () => {
      const { setCompartmentGrid, resetCompartments } = useDesignerStore.getState();
      setCompartmentGrid(3, 3);

      resetCompartments();

      const { params } = useDesignerStore.getState();
      expect(params.compartments.cols).toBe(1);
      expect(params.compartments.rows).toBe(1);
      expect(params.compartments.cells).toEqual([0]);
    });

    it('resets thickness to default', () => {
      const { setParam, resetCompartments } = useDesignerStore.getState();
      setParam('compartments', { cols: 2, rows: 2, thickness: 2.0, cells: [0, 1, 2, 3] });

      resetCompartments();

      const { params } = useDesignerStore.getState();
      expect(params.compartments.thickness).toBe(DEFAULT_BIN_PARAMS.compartments.thickness);
    });

    it('pushes history', () => {
      const { setCompartmentGrid, resetCompartments } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);

      const beforeHistoryLength = useDesignerStore.getState().history.past.length;

      resetCompartments();

      const afterHistory = useDesignerStore.getState().history;
      expect(afterHistory.past.length).toBe(beforeHistoryLength + 1);
    });

    it('clears future history', () => {
      const { setCompartmentGrid, undo, resetCompartments } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      undo();

      expect(useDesignerStore.getState().history.future).toHaveLength(1);

      resetCompartments();

      expect(useDesignerStore.getState().history.future).toHaveLength(0);
    });

    it('resets after complex merge operations', () => {
      const { setCompartmentGrid, mergeCells, resetCompartments } = useDesignerStore.getState();
      setCompartmentGrid(4, 4);
      mergeCells([0, 1, 4, 5]);
      mergeCells([2, 3, 6, 7]);

      resetCompartments();

      const { params } = useDesignerStore.getState();
      expect(params.compartments).toEqual(DEFAULT_BIN_PARAMS.compartments);
    });
  });

  describe('history integration', () => {
    it('undo after merge reverts to previous state', () => {
      const { setCompartmentGrid, mergeCells, undo } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);

      const beforeMerge = [...useDesignerStore.getState().params.compartments.cells];

      mergeCells([0, 1, 2, 3]);
      undo();

      const afterUndo = useDesignerStore.getState().params.compartments.cells;
      expect(afterUndo).toEqual(beforeMerge);
    });

    it('redo after merge undo restores merged state', () => {
      const { setCompartmentGrid, mergeCells, undo, redo } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      mergeCells([0, 1, 2, 3]);

      const afterMerge = [...useDesignerStore.getState().params.compartments.cells];

      undo();
      redo();

      const afterRedo = useDesignerStore.getState().params.compartments.cells;
      expect(afterRedo).toEqual(afterMerge);
    });

    it('undo after split reverts to merged state', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment, undo } =
        useDesignerStore.getState();
      setCompartmentGrid(2, 2);
      mergeCells([0, 1, 2, 3]);

      const afterMerge = [...useDesignerStore.getState().params.compartments.cells];
      const mergedId = afterMerge[0];

      splitCompartment(mergedId);
      undo();

      const afterUndo = useDesignerStore.getState().params.compartments.cells;
      expect(afterUndo).toEqual(afterMerge);
    });

    it('undo after setCompartmentGrid reverts to previous grid', () => {
      const { setCompartmentGrid, undo } = useDesignerStore.getState();
      setCompartmentGrid(2, 2);

      const after2x2 = { ...useDesignerStore.getState().params.compartments };

      setCompartmentGrid(3, 3);
      undo();

      const afterUndo = useDesignerStore.getState().params.compartments;
      expect(afterUndo).toEqual(after2x2);
    });

    it('undo after resetCompartments reverts to previous state', () => {
      const { setCompartmentGrid, resetCompartments, undo } = useDesignerStore.getState();
      setCompartmentGrid(3, 3);

      const after3x3 = { ...useDesignerStore.getState().params.compartments };

      resetCompartments();
      undo();

      const afterUndo = useDesignerStore.getState().params.compartments;
      expect(afterUndo).toEqual(after3x3);
    });

    it('multiple undo/redo operations maintain consistency', () => {
      const { setCompartmentGrid, mergeCells, splitCompartment, undo, redo } =
        useDesignerStore.getState();

      setCompartmentGrid(2, 2);
      const state1 = { ...useDesignerStore.getState().params.compartments };

      mergeCells([0, 1, 2, 3]);
      const state2 = { ...useDesignerStore.getState().params.compartments };

      const mergedId = state2.cells[0];
      splitCompartment(mergedId);
      const state3 = { ...useDesignerStore.getState().params.compartments };

      // Undo twice
      undo();
      expect(useDesignerStore.getState().params.compartments).toEqual(state2);

      undo();
      expect(useDesignerStore.getState().params.compartments).toEqual(state1);

      // Redo twice
      redo();
      expect(useDesignerStore.getState().params.compartments).toEqual(state2);

      redo();
      expect(useDesignerStore.getState().params.compartments).toEqual(state3);
    });

    it('history limit is enforced across compartment operations', () => {
      const { setCompartmentGrid } = useDesignerStore.getState();

      // Perform more than MAX_HISTORY operations
      for (let i = 1; i <= DESIGNER_CONSTRAINTS.MAX_HISTORY + 10; i++) {
        setCompartmentGrid(2, 2);
      }

      const { history } = useDesignerStore.getState();
      expect(history.past.length).toBeLessThanOrEqual(DESIGNER_CONSTRAINTS.MAX_HISTORY);
    });
  });
});
