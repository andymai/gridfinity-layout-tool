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
  // path) we synthesize a full mask so the paint grid always has something
  // to render against current dimensions.
  const displayMask: CellMask = useMemo(
    () =>
      cellMask && cellMask.cols === cols && cellMask.rows === rows
        ? cellMask
        : buildFullMask(width, depth),
    [cellMask, cols, rows, width, depth]
  );

  const isCustom = cellMask !== undefined && !isAllFilled(cellMask);

  const applyPreset = useCallback(
    (id: ShapePresetId) => {
      const preset = SHAPE_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      setCellMask(preset.build(width, depth));
    },
    [setCellMask, width, depth]
  );

  /**
   * Toggle a single half-cell (col, row). The store validates the resulting
   * mask and silently rejects structurally invalid shapes (disconnected /
   * empty / hole), so the generator never sees a broken shape.
   */
  const toggleCell = useCallback(
    (col: number, row: number) => {
      if (col < 0 || col >= cols || row < 0 || row >= rows) return;
      const idx = row * cols + col;
      const current = displayMask.cells[idx];
      const next: (0 | 1)[] = displayMask.cells.slice();
      next[idx] = current === 1 ? 0 : 1;
      setCellMask({ cols, rows, cells: next });
    },
    [cols, rows, displayMask, setCellMask]
  );

  const resetToRectangle = useCallback(() => setCellMask(undefined), [setCellMask]);

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
      resetToRectangle,
    },
    t,
  };
}
