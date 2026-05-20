import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import {
  MASK_CELLS_PER_UNIT,
  buildFullMask,
  isAllFilled,
  isPartialMask,
} from '@/shared/utils/cellMask';
import type { CellMask } from '@/shared/utils/cellMask';

/** Build a 2D mask from rows where row 0 is the visual top. */
function maskFromRows(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

// 2×2 bin L-shape: 4×4 half-cell mask, bottom-right 2×2 empty
const L_2X2: CellMask = maskFromRows([
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [1, 1, 0, 0],
  [1, 1, 0, 0],
]);

// 3×3 bin O-shape: 6×6 mask with center 2×2 empty
const O_3X3: CellMask = maskFromRows([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
]);

describe('DesignerStore - custom shape (cellMask) actions', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  describe('setCellMask basic', () => {
    it('starts with no cellMask (rectangle bin)', () => {
      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });

    it('sets a valid partial mask matching dimensions', () => {
      const { setCellMask } = useDesignerStore.getState();
      // Default bin is 2×2 — L_2X2 mask matches (cols=4, rows=4)
      setCellMask(L_2X2);

      const { cellMask } = useDesignerStore.getState().params;
      expect(cellMask).toBeDefined();
      expect(isPartialMask(cellMask)).toBe(true);
    });

    it('clears the mask when setCellMask(undefined)', () => {
      const { setCellMask } = useDesignerStore.getState();
      setCellMask(L_2X2);
      expect(useDesignerStore.getState().params.cellMask).toBeDefined();

      setCellMask(undefined);
      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });

    it('normalizes a fully-filled mask to undefined', () => {
      const { setCellMask } = useDesignerStore.getState();
      const fullMask = buildFullMask(2, 2);
      expect(isAllFilled(fullMask)).toBe(true);

      setCellMask(fullMask);
      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });

    it('pushes history on setCellMask', () => {
      const { setCellMask } = useDesignerStore.getState();
      const before = useDesignerStore.getState().history.past.length;

      setCellMask(L_2X2);
      expect(useDesignerStore.getState().history.past.length).toBe(before + 1);
    });
  });

  describe('setCellMask validation', () => {
    it('rejects mask whose cols mismatch width', () => {
      const { setCellMask } = useDesignerStore.getState();
      // Default width=2 → expects cols = 4. Provide cols = 6 (3×3).
      setCellMask(O_3X3);

      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });

    it('rejects mask whose rows mismatch depth', () => {
      const { setCellMask } = useDesignerStore.getState();
      // 2×2 bin expects 4×4. Provide 4×6 (cols match, rows mismatch).
      const bad: CellMask = {
        cols: 2 * MASK_CELLS_PER_UNIT,
        rows: 3 * MASK_CELLS_PER_UNIT,
        cells: new Array(2 * MASK_CELLS_PER_UNIT * 3 * MASK_CELLS_PER_UNIT).fill(1),
      };
      setCellMask(bad);

      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });

    it('rejects an empty mask (no filled cells)', () => {
      const { setCellMask } = useDesignerStore.getState();
      const empty: CellMask = {
        cols: 4,
        rows: 4,
        cells: new Array(16).fill(0),
      };
      setCellMask(empty);

      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });
  });

  describe('undo/redo for cellMask', () => {
    it('undo restores the previous mask state', () => {
      const { setCellMask, undo } = useDesignerStore.getState();
      setCellMask(L_2X2);
      expect(useDesignerStore.getState().params.cellMask).toBeDefined();

      undo();
      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });

    it('redo re-applies the mask', () => {
      const { setCellMask, undo, redo } = useDesignerStore.getState();
      setCellMask(L_2X2);
      undo();
      redo();

      expect(useDesignerStore.getState().params.cellMask).toBeDefined();
      expect(isPartialMask(useDesignerStore.getState().params.cellMask)).toBe(true);
    });

    it('undoes through a clear → set → clear sequence', () => {
      const { setCellMask, undo } = useDesignerStore.getState();
      setCellMask(L_2X2);
      setCellMask(undefined);

      // Currently undefined → undo → L_2X2 → undo → undefined
      undo();
      expect(useDesignerStore.getState().params.cellMask).toBeDefined();
      undo();
      expect(useDesignerStore.getState().params.cellMask).toBeUndefined();
    });
  });

  describe('cellMask + dimension changes', () => {
    it('clears mask when dimensions change such that it would not match', () => {
      const { setCellMask, setParam } = useDesignerStore.getState();
      setCellMask(L_2X2);
      expect(useDesignerStore.getState().params.cellMask).toBeDefined();

      // Changing width to 3 reshapes the mask via reshapeOrClearMask
      setParam('width', 3);
      const { cellMask } = useDesignerStore.getState().params;
      // Either reshaped to a new valid mask or cleared — but not stale 4×4.
      if (cellMask) {
        expect(cellMask.cols).toBe(3 * MASK_CELLS_PER_UNIT);
      }
    });

    it('setParams() with new dimensions also reshapes mask', () => {
      const { setCellMask, setParams } = useDesignerStore.getState();
      setCellMask(L_2X2);
      setParams({ width: 3, depth: 3 });

      const { cellMask } = useDesignerStore.getState().params;
      if (cellMask) {
        expect(cellMask.cols).toBe(3 * MASK_CELLS_PER_UNIT);
        expect(cellMask.rows).toBe(3 * MASK_CELLS_PER_UNIT);
      }
    });
  });

  describe('cellMask + other params', () => {
    it('setting cellMask preserves unrelated params', () => {
      const { setCellMask, updateBase } = useDesignerStore.getState();
      updateBase({ stackingLip: false });
      setCellMask(L_2X2);

      const { params } = useDesignerStore.getState();
      expect(params.cellMask).toBeDefined();
      expect(params.base.stackingLip).toBe(false);
    });

    it('clearing cellMask preserves unrelated params', () => {
      const { setCellMask, updateBase } = useDesignerStore.getState();
      setCellMask(L_2X2);
      updateBase({ stackingLip: false });
      setCellMask(undefined);

      const { params } = useDesignerStore.getState();
      expect(params.cellMask).toBeUndefined();
      expect(params.base.stackingLip).toBe(false);
    });
  });
});
