import { useRef, useCallback, useEffect, useMemo } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { Button } from '@/design-system';
import { MASK_CELLS_PER_UNIT, type CellMask } from '@/shared/utils/cellMask';
import {
  getPreviewBorderColor,
  usePreviewColor,
} from '@/features/bin-designer/hooks/usePreviewColor';

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
 * Visually mirrors the compartment-grid UI: one rounded card, aspect ratio
 * derived from the bin footprint, inset box-shadow borders (so merged cells
 * read as one region), and dots at the 1u internal intersections.
 *
 * Origin is bottom-left to match the generator's coordinate system;
 * `flex-col-reverse` flips the y-axis so row 0 renders at the visual bottom.
 *
 * Interaction:
 *   - Click a cell to toggle filled/empty.
 *   - Click-drag to paint continuously: the drag direction locks to
 *     the first toggle (fill → empty or empty → fill) so running over a
 *     mix of cells during the drag doesn't ping-pong.
 *   - Enter/Space on a focused cell toggles that cell for keyboard users.
 */
export function ShapeGrid({ mask, onToggleCell, ariaLabel, cellLabel }: ShapeGridProps) {
  const dragModeRef = useRef<'fill' | 'clear' | null>(null);
  const draggedRef = useRef(new Set<number>());

  const { cols, rows, cells } = mask;
  const previewColor = usePreviewColor();
  const borderColor = useMemo(() => getPreviewBorderColor(previewColor), [previewColor]);

  const endDrag = useCallback(() => {
    dragModeRef.current = null;
    draggedRef.current.clear();
  }, []);

  // Safety net: pointerleave on the container won't fire if the pointer is
  // released inside an overlapping scrollable/overflow region, leaving drag
  // state stuck. A window-level release listener guarantees we always clear.
  useEffect(() => {
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [endDrag]);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLButtonElement>, col: number, row: number) => {
      // Capture the pointer on the cell that started the drag so the
      // container still receives `pointerup` even if the cursor flies off
      // the grid (scrollable region, iframe, window edge) before
      // `pointerleave` fires. Without this, a fast off-edge drag leaves
      // `dragModeRef` active until the next click. The browser releases
      // capture automatically on pointerup, so `endDrag` doesn't need to.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Older WebViews without pointer-capture support — drag still
        // works via the window-level endDrag listener below.
      }
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
      draggedRef.current.add(idx);
      // Skip the toggle when the cell is already in the drag's target state
      // so running over a mixed strip during a drag doesn't ping-pong. Marking
      // `dragged` above prevents a re-enter from flipping it either way.
      const isFilled = cells[idx] === 1;
      const wantFill = dragModeRef.current === 'fill';
      if (isFilled === wantFill) return;
      onToggleCell(col, row);
    },
    [cells, cols, onToggleCell]
  );

  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, col: number, row: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleCell(col, row);
      }
    },
    [onToggleCell]
  );

  // Dots at internal 1u intersections (every MASK_CELLS_PER_UNIT cells),
  // matching the compartment grid's divider-junction affordance.
  const gridDots = useMemo(() => {
    const dots: Array<{ x: number; y: number }> = [];
    for (let iu = 1; iu * MASK_CELLS_PER_UNIT < cols; iu++) {
      for (let iv = 1; iv * MASK_CELLS_PER_UNIT < rows; iv++) {
        dots.push({
          x: (iu * MASK_CELLS_PER_UNIT) / cols,
          y: (iv * MASK_CELLS_PER_UNIT) / rows,
        });
      }
    }
    return dots;
  }, [cols, rows]);

  return (
    <div
      role="grid"
      aria-label={ariaLabel}
      aria-rowcount={rows}
      aria-colcount={cols}
      className="relative mx-auto max-w-[320px] select-none rounded-lg border-2 border-stroke-subtle bg-surface-elevated p-2"
      style={{
        width: '100%',
        aspectRatio: `${cols} / ${rows}`,
        // Prevent the browser from hijacking the drag for panning/scrolling,
        // which would cancel the paint stroke mid-gesture on touch devices.
        touchAction: 'none',
      }}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      {gridDots.length > 0 && (
        <div className="pointer-events-none absolute inset-2">
          {gridDots.map(({ x, y }, i) => (
            <div
              key={i}
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-content-tertiary/40"
              style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
            />
          ))}
        </div>
      )}
      {/* flex-col-reverse puts row 0 at the visual bottom, matching the
          bin generator's bottom-left origin. No row gaps — borders (via
          inset box-shadow) define cell edges and merged-filled runs read
          as one region. */}
      <div className="relative flex h-full w-full flex-col-reverse">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid flex-1"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }, (_, col) => {
              const idx = row * cols + col;
              const filled = cells[idx] === 1;
              const visualRow = rows - 1 - row;
              return (
                <ShapeCell
                  key={col}
                  col={col}
                  row={row}
                  cols={cols}
                  rows={rows}
                  filled={filled}
                  fillColor={previewColor}
                  borderColor={borderColor}
                  ariaRowIndex={visualRow + 1}
                  ariaColIndex={col + 1}
                  ariaLabel={cellLabel(col + 1, visualRow + 1, filled)}
                  onPointerDown={handlePointerDown}
                  onPointerEnter={handlePointerEnter}
                  onKeyDown={handleCellKeyDown}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ShapeCellProps {
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
  readonly filled: boolean;
  readonly fillColor: string;
  readonly borderColor: string;
  readonly ariaRowIndex: number;
  readonly ariaColIndex: number;
  readonly ariaLabel: string;
  readonly onPointerDown: (e: PointerEvent<HTMLButtonElement>, col: number, row: number) => void;
  readonly onPointerEnter: (col: number, row: number) => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, col: number, row: number) => void;
}

function ShapeCell({
  col,
  row,
  cols,
  rows,
  filled,
  fillColor,
  borderColor,
  ariaRowIndex,
  ariaColIndex,
  ariaLabel,
  onPointerDown,
  onPointerEnter,
  onKeyDown,
}: ShapeCellProps) {
  // Outer grid corners only — interior cells draw no rounding, so merged
  // filled runs appear as one continuous shape.
  const CR = 4;
  const isAtTop = row === rows - 1;
  const isAtBottom = row === 0;
  const isAtLeft = col === 0;
  const isAtRight = col === cols - 1;
  const tl = isAtTop && isAtLeft ? CR : 0;
  const tr = isAtTop && isAtRight ? CR : 0;
  const br = isAtBottom && isAtRight ? CR : 0;
  const bl = isAtBottom && isAtLeft ? CR : 0;

  // Shared compartment-grid pattern: directional inset box-shadow draws
  // only the right and bottom edge of each cell, plus the top edge at the
  // grid's outer top and the left edge at the grid's outer left. This way
  // adjacent filled cells share one seamless boundary.
  const W = 2;
  const stroke = filled ? borderColor : 'var(--color-stroke-subtle)';
  const shadowParts: string[] = [`inset -${W}px 0 0 0 ${stroke}`, `inset 0 -${W}px 0 0 ${stroke}`];
  if (isAtTop) shadowParts.push(`inset 0 ${W}px 0 0 ${stroke}`);
  if (isAtLeft) shadowParts.push(`inset ${W}px 0 0 0 ${stroke}`);

  return (
    <Button
      type="button"
      variant="ghost"
      role="gridcell"
      aria-rowindex={ariaRowIndex}
      aria-colindex={ariaColIndex}
      aria-selected={filled}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        onPointerDown(e, col, row);
      }}
      onPointerEnter={() => onPointerEnter(col, row)}
      onKeyDown={(e) => onKeyDown(e, col, row)}
      className="relative transition-colors"
      style={{
        backgroundColor: filled ? fillColor : 'var(--color-surface)',
        borderRadius: `${tl}px ${tr}px ${br}px ${bl}px`,
        boxShadow: shadowParts.join(', '),
        cursor: 'crosshair',
      }}
    />
  );
}
