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

export function useShapeSection() {
  const { width, depth, cellMask, setCellMask } = useDesignerStore(
    useShallow((s) => ({
      width: s.params.width,
      depth: s.params.depth,
      cellMask: s.params.cellMask,
      setCellMask: s.setCellMask,
    }))
  );
  const t = useTranslation();

  const cols = Math.round(width * MASK_CELLS_PER_UNIT);
  const rows = Math.round(depth * MASK_CELLS_PER_UNIT);

  // A mask always exists for the UI. When the store has `undefined` (fast
  // path) — or a mask whose dimensions lag the latest width/depth because
  // it was written via setParams without reshape — we synthesize a full
  // mask so the paint grid always renders against current dimensions.
  const displayMask: CellMask = useMemo(
    () =>
      cellMask && cellMask.cols === cols && cellMask.rows === rows
        ? cellMask
        : buildFullMask(width, depth),
    [cellMask, cols, rows, width, depth]
  );

  const isCustom = cellMask !== undefined && !isAllFilled(cellMask);

  // Read latest params at call time so a dimension change between render
  // and click doesn't produce a stale-dimensions mask that setCellMask
  // would then silently reject.
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
   * Toggle a single half-cell (col, row). The store validates the resulting
   * mask and silently rejects structurally invalid shapes (disconnected /
   * empty / hole), so the generator never sees a broken shape.
   */
  const toggleCell = useCallback(
    (col: number, row: number) => {
      const { width: w, depth: d, cellMask: stored } = useDesignerStore.getState().params;
      const currentCols = Math.round(w * MASK_CELLS_PER_UNIT);
      const currentRows = Math.round(d * MASK_CELLS_PER_UNIT);
      if (col < 0 || col >= currentCols || row < 0 || row >= currentRows) return;
      const base =
        stored && stored.cols === currentCols && stored.rows === currentRows
          ? stored
          : buildFullMask(w, d);
      const idx = row * currentCols + col;
      const next: (0 | 1)[] = base.cells.slice();
      next[idx] = base.cells[idx] === 1 ? 0 : 1;
      setCellMask({ cols: currentCols, rows: currentRows, cells: next });
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
      cols,
      rows,
      mask: displayMask,
      isCustom,
      presets,
    },
    handlers: {
      applyPreset,
      toggleCell,
    },
    t,
  };
}
