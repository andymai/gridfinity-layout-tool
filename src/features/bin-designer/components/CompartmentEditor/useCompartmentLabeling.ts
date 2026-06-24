import { useCallback, useMemo, useState } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store';
import {
  getCompartmentIds,
  getCompartmentBounds,
  cellIndex,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';

export type LabelNavDirection = 'next' | 'prev';
export type GridDirection = 'up' | 'down' | 'left' | 'right';

/** Per-direction step out of the edited compartment's bounding box. Up/down are
 *  VISUAL (the grid renders flex-col-reverse, so visual-up = higher data row). */
const GRID_STEP: Record<GridDirection, { dcol: number; drow: number }> = {
  right: { dcol: 1, drow: 0 },
  left: { dcol: -1, drow: 0 },
  up: { dcol: 0, drow: 1 },
  down: { dcol: 0, drow: -1 },
};

export interface CompartmentLabeling {
  /** Whether the grid is in label-editing mode. */
  readonly labelMode: boolean;
  /** True when labeling is offered at all (grid dividers + >1 compartment). */
  readonly canLabel: boolean;
  setLabelMode: (on: boolean) => void;
  /** Compartment id whose label is being edited, or null. */
  readonly editingId: number | null;
  selectCompartment: (id: number) => void;
  /** Unique compartment ids in display order (matches the bulk list). */
  readonly orderedIds: readonly number[];
  /** 1-based display number for a compartment id ("Comp. N"). */
  displayNumberOf: (id: number) => number;
  /** Committed label text for a compartment id (empty string if none). */
  textOf: (id: number) => string;
  commitText: (id: number, text: string) => void;
  /** Move editing to the next/previous compartment in display order. */
  advance: (dir: LabelNavDirection) => void;
  /** Move editing to the compartment adjacent in the given grid direction. */
  moveByGrid: (dir: GridDirection) => void;
}

export function useCompartmentLabeling(
  compartments: CompartmentConfig,
  style: string,
  compartmentCount: number
): CompartmentLabeling {
  const setCompartmentText = useDesignerStore((s) => s.setCompartmentText);

  const [labelModeRaw, setLabelModeRaw] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const canLabel = style === 'standard' && compartmentCount > 1;

  const orderedIds = useMemo(() => getCompartmentIds(compartments), [compartments]);

  const displayNumbers = useMemo(() => {
    const map = new Map<number, number>();
    orderedIds.forEach((id, idx) => map.set(id, idx + 1));
    return map;
  }, [orderedIds]);

  // Derived, not corrected in effects (avoids cascading-render setState-in-effect):
  // mode collapses off when labeling is unavailable, and editingId falls back to
  // the first compartment when the selection is empty or was renumbered by a merge/split.
  const labelMode = labelModeRaw && canLabel;
  const firstId = orderedIds.length > 0 ? orderedIds[0] : null;
  const editingId = !labelMode
    ? null
    : selectedId !== null && displayNumbers.has(selectedId)
      ? selectedId
      : firstId;

  const setLabelMode = useCallback((on: boolean) => setLabelModeRaw(on), []);

  const selectCompartment = useCallback((id: number) => setSelectedId(id), []);

  const displayNumberOf = useCallback(
    (id: number) => displayNumbers.get(id) ?? 0,
    [displayNumbers]
  );

  const textOf = useCallback(
    (id: number) => compartments.compartmentTexts?.[id] ?? '',
    [compartments.compartmentTexts]
  );

  const advance = useCallback(
    (dir: LabelNavDirection) => {
      if (editingId === null) return;
      const cur = orderedIds.indexOf(editingId);
      if (cur === -1) return;
      const delta = dir === 'next' ? 1 : -1;
      // Clamp at the ends rather than wrapping — wrapping past the last
      // compartment back to the first reads as a glitch when ripping through
      // a long list with Enter.
      const next = Math.min(orderedIds.length - 1, Math.max(0, cur + delta));
      setSelectedId(orderedIds[next]);
    },
    [editingId, orderedIds]
  );

  const moveByGrid = useCallback(
    (dir: GridDirection) => {
      if (editingId === null) return;
      const bounds = getCompartmentBounds(compartments, editingId);
      if (!bounds) return;
      const { cols, rows } = compartments;
      const { dcol, drow } = GRID_STEP[dir];
      // Step out of the compartment's bounding box on the leading edge.
      const col = (dcol > 0 ? bounds.maxCol : bounds.minCol) + dcol;
      const row = (drow > 0 ? bounds.maxRow : bounds.minRow) + drow;
      if (col < 0 || col >= cols || row < 0 || row >= rows) return;
      const target = compartments.cells[cellIndex(cols, col, row)];
      if (target !== editingId) setSelectedId(target);
    },
    [editingId, compartments]
  );

  return {
    labelMode,
    canLabel,
    setLabelMode,
    editingId,
    selectCompartment,
    orderedIds,
    displayNumberOf,
    textOf,
    commitText: setCompartmentText,
    advance,
    moveByGrid,
  };
}
