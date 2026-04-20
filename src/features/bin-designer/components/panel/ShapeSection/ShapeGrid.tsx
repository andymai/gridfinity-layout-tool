import { useRef, useCallback } from 'react';
import type { CellMask } from '@/shared/utils/cellMask';

interface ShapeGridProps {
  readonly mask: CellMask;
  readonly onToggleCell: (col: number, row: number) => void;
  readonly ariaLabel: string;
  /** Template `Cell {col}, {row} — {state}`, with `{state}` replaced by filled/empty. */
  readonly cellLabel: (col: number, row: number, filled: boolean) => string;
}

/**
 * Paint-style grid editor for a half-bin-resolution CellMask.
 *
 * Origin is bottom-left to match the generator's coordinate system; the
 * DOM flips the y-axis so row 0 renders at the visual bottom.
 *
 * Interaction:
 *   - Click a cell to toggle filled/empty.
 *   - Click-drag to paint continuously: the drag direction locks to
 *     the first toggle (fill → empty or empty → fill) so running over a
 *     mix of cells during the drag doesn't ping-pong.
 */
export function ShapeGrid({ mask, onToggleCell, ariaLabel, cellLabel }: ShapeGridProps) {
  const dragModeRef = useRef<'fill' | 'clear' | null>(null);
  const draggedRef = useRef(new Set<number>());

  const { cols, rows, cells } = mask;

  const handlePointerDown = useCallback(
    (col: number, row: number) => {
      const idx = row * cols + col;
      const current = cells[idx];
      dragModeRef.current = current === 1 ? 'clear' : 'fill';
      draggedRef.current.clear();
      draggedRef.current.add(idx);
      onToggleCell(col, row);
    },
    [cells, cols, onToggleCell]
  );

  const handlePointerEnter = useCallback(
    (col: number, row: number) => {
      if (!dragModeRef.current) return;
      const idx = row * cols + col;
      if (draggedRef.current.has(idx)) return;
      const current = cells[idx];
      const wantFill = dragModeRef.current === 'fill';
      if ((wantFill && current === 1) || (!wantFill && current === 0)) {
        // Already in target state; no toggle needed but mark so we don't
        // revisit and accidentally flip on re-enter.
        draggedRef.current.add(idx);
        return;
      }
      draggedRef.current.add(idx);
      onToggleCell(col, row);
    },
    [cells, cols, onToggleCell]
  );

  const handlePointerUp = useCallback(() => {
    dragModeRef.current = null;
    draggedRef.current.clear();
  }, []);

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows}
      aria-colcount={cols}
      className="inline-grid select-none gap-px rounded border border-stroke-subtle bg-stroke-subtle p-px"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        direction: 'ltr',
      }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {Array.from({ length: rows * cols }, (_, i) => {
        // Render rows top-to-bottom visually but store row 0 is at bottom,
        // so invert: visualRow 0 = top = mask row (rows - 1).
        const visualRow = Math.floor(i / cols);
        const col = i % cols;
        const row = rows - 1 - visualRow;
        const filled = cells[row * cols + col] === 1;
        return (
          <button
            key={`${col}-${row}`}
            type="button"
            role="gridcell"
            aria-rowindex={visualRow + 1}
            aria-colindex={col + 1}
            aria-selected={filled}
            aria-label={cellLabel(col + 1, visualRow + 1, filled)}
            onPointerDown={() => handlePointerDown(col, row)}
            onPointerEnter={() => handlePointerEnter(col, row)}
            className={`aspect-square transition-colors ${
              filled ? 'bg-accent-subtle hover:bg-accent' : 'bg-surface hover:bg-surface-hover'
            }`}
          />
        );
      })}
    </div>
  );
}
