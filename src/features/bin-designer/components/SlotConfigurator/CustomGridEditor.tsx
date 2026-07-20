/**
 * Authored-layout editor for custom removable dividers.
 *
 * A self-contained cols×rows grid: click cells to select a rectangle, then
 * Merge them into one compartment (or Split a merged one back). An SVG overlay
 * draws the derived divider walls colored by seat retention — amber for
 * friction-only pieces that aren't anchored to a wall or a crossing.
 *
 * Deliberately does NOT reuse CompartmentEditor: that component is wired to the
 * standard compartment store and carries labels / angled dividers / tilt
 * previews that don't apply to removable pieces. Grid mutations go through the
 * generic setParam('slotConfig', …) with the pure merge/split utils.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { Button, Stepper } from '@/design-system';
import { mergeCells, normalizeIds, isRectangularSelection } from '@/features/bin-designer/utils';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { computeAuthoredDividers } from '@/shared/utils/authoredDividerMath';
import { getEffectiveSlotDimensions } from '@/shared/utils/slotMath';
import { resolveOverhang, overhangExpansion } from '@/shared/utils/overhang';
import { useTranslation } from '@/i18n';
import type { CompartmentGrid } from '@/shared/utils/compartmentGeometry';

const MIN_DIM = 1;
const MAX_DIM = 8;

function uniformGrid(cols: number, rows: number): CompartmentGrid {
  return { cols, rows, cells: Array.from({ length: cols * rows }, (_, i) => i) };
}

// Seat-hint stroke colors: amber = friction-only (not anchored), green = held.
const SEAT_FRICTION = '#f59e0b';
const SEAT_ANCHORED = '#22c55e';

/** A grid is usable only if its dimensions are >= 1 and cells match cols×rows.
 *  Slot configs aren't deep-validated server-side, so a corrupted persisted
 *  customGrid must not reach the renderer / Math.max(...cells). */
function isWellFormed(g: CompartmentGrid): boolean {
  return g.cols >= 1 && g.rows >= 1 && g.cells.length === g.cols * g.rows;
}

const CELL_COLORS = [
  '#60a5fa',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#22d3ee',
  '#fb923c',
  '#a3e635',
];

export function CustomGridEditor() {
  const { params, setParam } = useDesignerStore(
    useShallow((s) => ({ params: s.params, setParam: s.setParam }))
  );
  const t = useTranslation();
  const { slotConfig, dividerPieces } = params;
  const stored = slotConfig.customGrid;
  const grid = stored && isWellFormed(stored) ? stored : uniformGrid(2, 2);
  const { cols, rows, cells } = grid;

  const [selection, setSelection] = useState<Set<number>>(new Set());

  // The interior grows into the overhang in lockstep with the body, so map the
  // grid over the expanded interior (matching the generated slots/pieces).
  const nominal = binDimensions(params);
  const ovh = overhangExpansion(resolveOverhang(params.overhang));
  const innerW = nominal.innerW + ovh.addW;
  const innerD = nominal.innerD + ovh.addD;
  const { slotDepth } = getEffectiveSlotDimensions(
    params.wallThickness,
    dividerPieces.thickness,
    dividerPieces.clearance
  );

  const pieces = useMemo(
    () =>
      computeAuthoredDividers(
        deriveWallSegments(grid, innerW, innerD),
        innerW,
        innerD,
        dividerPieces.thickness,
        slotDepth,
        dividerPieces.clearance
      ),
    [grid, innerW, innerD, dividerPieces.thickness, dividerPieces.clearance, slotDepth]
  );
  const frictionCount = pieces.filter((p) => p.retention === 'friction').length;

  const commitGrid = useCallback(
    (next: CompartmentGrid) => {
      setParam('slotConfig', { ...slotConfig, customGrid: next });
      setSelection(new Set());
    },
    [slotConfig, setParam]
  );

  const setDims = useCallback(
    (nextCols: number, nextRows: number) => {
      commitGrid(uniformGrid(nextCols, nextRows));
    },
    [commitGrid]
  );

  const toggleCell = useCallback((index: number) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectionIndices = useMemo(() => [...selection], [selection]);
  const canMerge = selectionIndices.length >= 2 && isRectangularSelection(cols, selectionIndices);
  const canSplit = selectionIndices.length > 0;

  const doMerge = useCallback(() => {
    const merged = mergeCells({ ...grid, thickness: dividerPieces.thickness }, selectionIndices);
    if (merged) commitGrid({ cols: merged.cols, rows: merged.rows, cells: merged.cells });
  }, [grid, dividerPieces.thickness, selectionIndices, commitGrid]);

  const doSplit = useCallback(() => {
    // Give every cell of each selected compartment its own id in one pass, then
    // normalize once. Splitting compartment-by-compartment would be unstable —
    // each split renumbers ids, invalidating the remaining targets.
    const targets = new Set(selectionIndices.map((i) => cells[i]));
    let nextId = Math.max(...cells) + 1;
    const split = cells.map((id) => (targets.has(id) ? nextId++ : id));
    commitGrid({ cols, rows, cells: normalizeIds(split) });
  }, [cells, cols, rows, selectionIndices, commitGrid]);

  // Grid preview sizing: keep the interior aspect ratio, cap the long edge.
  const maxEdge = 168;
  const aspect = innerW / Math.max(innerD, 1);
  const boxW = aspect >= 1 ? maxEdge : maxEdge * aspect;
  const boxH = aspect >= 1 ? maxEdge / aspect : maxEdge;

  return (
    <div className="space-y-2">
      {/* Grid dimensions */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.customCols')}
          </span>
          <Stepper
            value={cols}
            onChange={(v) => setDims(Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(v))), rows)}
            onStep={(d) => setDims(Math.min(MAX_DIM, Math.max(MIN_DIM, cols + d)), rows)}
            min={MIN_DIM}
            max={MAX_DIM}
            step={1}
            size="md"
            aria-label={t('binDesigner.customCols')}
          />
        </div>
        <div className="flex-1">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.customRows')}
          </span>
          <Stepper
            value={rows}
            onChange={(v) => setDims(cols, Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(v))))}
            onStep={(d) => setDims(cols, Math.min(MAX_DIM, Math.max(MIN_DIM, rows + d)))}
            min={MIN_DIM}
            max={MAX_DIM}
            step={1}
            size="md"
            aria-label={t('binDesigner.customRows')}
          />
        </div>
      </div>

      {/* Grid + seat-hint overlay */}
      <div className="flex justify-center py-1">
        <div className="relative" style={{ width: boxW, height: boxH }}>
          <div
            className="grid h-full w-full gap-px rounded border border-stroke-subtle bg-stroke-subtle"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols * rows }, (_, i) => {
              // Render row 0 at the top; flip so front (y=0) is at the bottom.
              const col = i % cols;
              const rowFromTop = Math.floor(i / cols);
              const row = rows - 1 - rowFromTop;
              const index = row * cols + col;
              const compartmentId = cells[index];
              const selected = selection.has(index);
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => toggleCell(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleCell(index);
                    }
                  }}
                  aria-label={`cell ${col},${row}`}
                  className={`cursor-pointer transition-opacity ${selected ? 'ring-2 ring-accent ring-inset' : ''}`}
                  style={{
                    backgroundColor: CELL_COLORS[compartmentId % CELL_COLORS.length],
                    opacity: selected ? 1 : 0.55,
                  }}
                />
              );
            })}
          </div>
          <svg
            className="pointer-events-none absolute inset-0"
            width={boxW}
            height={boxH}
            viewBox={`0 0 ${innerW} ${innerD}`}
            preserveAspectRatio="none"
          >
            {pieces.map((p) => {
              // Segment endpoints back from the piece (interior coords, y flipped
              // so front is at the bottom of the SVG like the grid).
              const color = p.retention === 'friction' ? SEAT_FRICTION : SEAT_ANCHORED;
              const isV = p.orientation === 'vertical';
              const a0 = Math.max(0, p.start);
              const a1 = Math.min(isV ? innerD : innerW, p.end);
              const x1 = isV ? p.pos : a0;
              const x2 = isV ? p.pos : a1;
              const y1 = isV ? a0 : p.pos;
              const y2 = isV ? a1 : p.pos;
              return (
                <line
                  key={p.index}
                  x1={x1}
                  y1={innerD - y1}
                  x2={x2}
                  y2={innerD - y2}
                  stroke={color}
                  strokeWidth={Math.max(1.5, dividerPieces.thickness)}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Merge / Split */}
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canMerge}
          onClick={doMerge}
          className="flex-1"
        >
          {t('binDesigner.customMerge')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canSplit}
          onClick={doSplit}
          className="flex-1"
        >
          {t('binDesigner.customSplit')}
        </Button>
      </div>

      <p className="text-[11px] text-content-tertiary">
        {t('binDesigner.customPieceCount', { count: pieces.length })}
        {frictionCount > 0 && (
          <span className="text-warning">
            {' · '}
            {t('binDesigner.customFriction', { count: frictionCount })}
          </span>
        )}
      </p>
    </div>
  );
}
