import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  MASK_CELLS_PER_UNIT,
  buildFullMask,
  isAllFilled,
  type CellMask,
} from '@/shared/utils/cellMask';
import { useTranslation } from '@/i18n';
import { SHAPE_PRESETS, type ShapePresetId } from './shapePresets';

function masksMatch(a: CellMask | undefined, b: CellMask | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.cols !== b.cols || a.rows !== b.rows) return false;
  for (let i = 0; i < a.cells.length; i++) {
    if (a.cells[i] !== b.cells[i]) return false;
  }
  return true;
}

/** Indices of the four half-bin sub-cells that compose one 1u grid square. */
function subCellIndices(
  col1u: number,
  row1u: number,
  hbCols: number
): [number, number, number, number] {
  const c = col1u * 2;
  const r = row1u * 2;
  return [r * hbCols + c, r * hbCols + c + 1, (r + 1) * hbCols + c, (r + 1) * hbCols + c + 1];
}

/**
 * Coarsen a half-bin mask to 1u display resolution. A 1u cell displays as
 * filled only when all four sub-cells are filled; any sub-cell empty → 1u
 * cell appears empty. Stored data is not modified.
 */
function coarsenToGridUnits(hb: CellMask): CellMask {
  const cols = hb.cols / 2;
  const rows = hb.rows / 2;
  // `new Array(n)` returns `any[]`; we pre-size the typed slot for in-place fill.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const cells: (0 | 1)[] = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [a, b, d, e] = subCellIndices(c, r, hb.cols);
      cells[r * cols + c] =
        hb.cells[a] === 1 && hb.cells[b] === 1 && hb.cells[d] === 1 && hb.cells[e] === 1 ? 1 : 0;
    }
  }
  return { cols, rows, cells };
}

export function useShapeSection() {
  const { width, depth, cellMask, halfGridMode, shapeEditorOpen, setCellMask, setShapeEditorOpen } =
    useDesignerStore(
      useShallow((s) => ({
        width: s.params.width,
        depth: s.params.depth,
        cellMask: s.params.cellMask,
        halfGridMode: s.ui.halfGridMode,
        shapeEditorOpen: s.ui.shapeEditorOpen,
        setCellMask: s.setCellMask,
        setShapeEditorOpen: s.setShapeEditorOpen,
      }))
    );
  const t = useTranslation();

  // Stored masks are always at half-bin resolution. UI resolution depends on
  // halfGridMode: 0.5u when on, 1u when off. Stored data is never coarsened.
  const hbCols = Math.round(width * MASK_CELLS_PER_UNIT);
  const hbRows = Math.round(depth * MASK_CELLS_PER_UNIT);

  const storedMask =
    cellMask && cellMask.cols === hbCols && cellMask.rows === hbRows ? cellMask : undefined;

  const displayMask: CellMask = useMemo(() => {
    const source = storedMask ?? buildFullMask(width, depth);
    // Coarsening requires even mask dimensions (half-bin cells group into
    // 1u squares). Fractional-width bins like 1.5×1.5 have odd dims; fall
    // through to the raw half-bin source — the editor will still render,
    // just at 0.5u granularity regardless of halfGridMode.
    if (!halfGridMode && source.cols % 2 === 0 && source.rows % 2 === 0) {
      return coarsenToGridUnits(source);
    }
    return source;
  }, [storedMask, halfGridMode, width, depth]);

  // "Editing" (toggle on) = editor is open. A painted mask implies editing,
  // but the editor can also be open with no mask yet (user just toggled on).
  // "Custom" (hint text) = the mask has been carved into a non-rectangle.
  const isCustom = cellMask !== undefined && !isAllFilled(cellMask);
  const editingEnabled = shapeEditorOpen || isCustom;

  const applyPreset = useCallback(
    (id: ShapePresetId) => {
      const preset = SHAPE_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      const { width: w, depth: d, cellMask: current } = useDesignerStore.getState().params;
      const next = preset.build(w, d);
      if (masksMatch(current, next)) return;
      setCellMask(next);
    },
    [setCellMask]
  );

  /**
   * Toggle the Custom-shape editor. Turning on opens the grid with a
   * fully-filled display mask (still fast-path until the user paints
   * something); turning off clears both the mask and the editor flag.
   */
  const toggleEditingEnabled = useCallback(() => {
    const store = useDesignerStore.getState();
    const isOpen = store.ui.shapeEditorOpen || store.params.cellMask !== undefined;
    if (isOpen) {
      setCellMask(undefined);
      setShapeEditorOpen(false);
    } else {
      setShapeEditorOpen(true);
    }
  }, [setCellMask, setShapeEditorOpen]);

  /**
   * Reset the current shape back to a full rectangle while keeping the
   * editor open — clears any painted carving but leaves the grid visible
   * so the user can paint again without reopening the section.
   */
  const resetShape = useCallback(() => {
    setCellMask(undefined);
    setShapeEditorOpen(true);
  }, [setCellMask, setShapeEditorOpen]);

  /**
   * Toggle a cell at the current UI resolution. In 0.5u (halfGridMode on) a
   * toggle flips one sub-cell. In 1u a toggle flips all four sub-cells of
   * the grid square together, so the coarse display always stays in sync
   * with the underlying half-bin store. Store rejects masks that would
   * create holes / disconnects / empty shapes.
   */
  const toggleCell = useCallback(
    (col: number, row: number) => {
      const store = useDesignerStore.getState();
      const w = store.params.width;
      const d = store.params.depth;
      const hbm = store.ui.halfGridMode;
      const currentHbCols = Math.round(w * MASK_CELLS_PER_UNIT);
      const currentHbRows = Math.round(d * MASK_CELLS_PER_UNIT);
      const currentStored = store.params.cellMask;
      const base =
        currentStored &&
        currentStored.cols === currentHbCols &&
        currentStored.rows === currentHbRows
          ? currentStored
          : buildFullMask(w, d);

      const next = base.cells.slice();

      // Coarse 1u toggle needs even mask dims to group 2×2 sub-cells cleanly.
      // If halfGridMode is off but the bin has fractional sides (odd dims),
      // the UI renders at 0.5u anyway — fall through to the half-bin branch.
      const isCoarseMode = !hbm && currentHbCols % 2 === 0 && currentHbRows % 2 === 0;
      if (isCoarseMode) {
        const coarseCols = currentHbCols / 2;
        const coarseRows = currentHbRows / 2;
        if (col < 0 || col >= coarseCols || row < 0 || row >= coarseRows) return;
        const subs = subCellIndices(col, row, currentHbCols);
        const allFilled = subs.every((i) => base.cells[i] === 1);
        const target: 0 | 1 = allFilled ? 0 : 1;
        for (const i of subs) next[i] = target;
      } else {
        if (col < 0 || col >= currentHbCols || row < 0 || row >= currentHbRows) return;
        const idx = row * currentHbCols + col;
        next[idx] = next[idx] === 1 ? 0 : 1;
      }

      setCellMask({ cols: currentHbCols, rows: currentHbRows, cells: next });
    },
    [setCellMask]
  );

  const presets = useMemo(
    () =>
      SHAPE_PRESETS.map((p) => ({
        id: p.id,
        available: p.isAvailable(width, depth),
        label: t(`binDesigner.shape.preset.${p.id}`),
      })),
    [width, depth, t]
  );

  return {
    state: {
      cols: displayMask.cols,
      rows: displayMask.rows,
      mask: displayMask,
      editingEnabled,
      isCustom,
      presets,
    },
    handlers: {
      applyPreset,
      toggleCell,
      toggleEditingEnabled,
      resetShape,
    },
    t,
  };
}
