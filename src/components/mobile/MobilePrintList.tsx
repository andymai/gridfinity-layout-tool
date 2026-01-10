import React, { useMemo, useState } from 'react';
import { useLayoutStore } from '../../store';
import { calcMaxGridUnits, DEFAULT_CATEGORY_COLOR } from '../../constants';
import { generatePrintList, getTotalBins, getTotalPieces, getTotalFilament, getSpoolEstimate } from '../../utils/split';
import { exportPrintListTSV } from '../../utils/storage';
import type { PrintPiece } from '../../types';

const STYLES = {
  splitPiece: {
    backgroundColor: 'var(--color-primary-muted)',
    border: '1px solid var(--color-primary)',
    borderRadius: '2px',
    fontSize: '9px',
    color: 'var(--text-secondary)',
  },
} as const;

/**
 * Visual preview of how a bin will be split for printing.
 * Shows a grid diagram with the split pieces.
 */
function SplitPreview({ width, depth, pieces }: { width: number; depth: number; pieces: PrintPiece[] }) {
  const grid: (PrintPiece | null)[][] = Array.from({ length: depth }, () =>
    Array.from({ length: width }, () => null)
  );

  const placedPieces: Array<{ piece: PrintPiece; x: number; y: number }> = [];
  const piecesToPlace = pieces.flatMap(p => Array(p.count).fill({ width: p.width, depth: p.depth }));

  for (const piece of piecesToPlace) {
    outer: for (let y = 0; y < depth; y++) {
      for (let x = 0; x < width; x++) {
        let fits = true;
        if (x + piece.width > width || y + piece.depth > depth) {
          fits = false;
        } else {
          for (let py = y; py < y + piece.depth && fits; py++) {
            for (let px = x; px < x + piece.width && fits; px++) {
              if (grid[py][px] !== null) fits = false;
            }
          }
        }

        if (fits) {
          for (let py = y; py < y + piece.depth; py++) {
            for (let px = x; px < x + piece.width; px++) {
              grid[py][px] = piece;
            }
          }
          placedPieces.push({ piece, x, y });
          break outer;
        }
      }
    }
  }

  const cellSize = 14;
  const gap = 2;

  return (
    <div
      className="relative"
      style={{
        width: width * cellSize + (width - 1) * gap,
        height: depth * cellSize + (depth - 1) * gap,
      }}
    >
      {placedPieces.map((placed) => (
        <div
          key={`${placed.x}-${placed.y}-${placed.piece.width}x${placed.piece.depth}`}
          className="absolute flex items-center justify-center"
          style={{
            left: placed.x * (cellSize + gap),
            bottom: placed.y * (cellSize + gap),
            width: placed.piece.width * cellSize + (placed.piece.width - 1) * gap,
            height: placed.piece.depth * cellSize + (placed.piece.depth - 1) * gap,
            ...STYLES.splitPiece,
          }}
        >
          {placed.piece.width}×{placed.piece.depth}
        </div>
      ))}
    </div>
  );
}

/**
 * Mobile-optimized print list matching desktop functionality.
 * Features: expandable split previews, filament per row, notes indicator.
 */
export function MobilePrintList() {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const layout = useLayoutStore(state => state.layout);
  const maxGridUnits = calcMaxGridUnits(layout.printBedSize, layout.gridUnitMm);

  const printRows = useMemo(
    () => generatePrintList(layout.bins, maxGridUnits),
    [layout.bins, maxGridUnits]
  );
  const totalBins = useMemo(() => getTotalBins(printRows), [printRows]);
  const totalPieces = useMemo(() => getTotalPieces(printRows), [printRows]);
  const totalFilament = useMemo(() => getTotalFilament(printRows), [printRows]);
  const spoolEstimate = useMemo(() => getSpoolEstimate(totalFilament), [totalFilament]);
  const hasAnySplits = useMemo(() => printRows.some(r => r.needsSplit), [printRows]);

  const handleCopy = () => {
    const tsv = exportPrintListTSV(printRows);
    navigator.clipboard.writeText(tsv);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  if (printRows.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-surface-elevated">
          <svg className="w-8 h-8 text-content-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-content-secondary">No bins to print</p>
        <p className="text-sm mt-1 text-content-disabled">
          Draw bins on the grid to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header with copy button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-content-tertiary">
          {totalBins} bins{hasAnySplits ? `, ${totalPieces} pieces` : ''}
        </span>
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-sm gap-1.5"
        >
          {copyFeedback ? (
            <>
              <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy TSV
            </>
          )}
        </button>
      </div>

      {/* Print list items */}
      <div className="space-y-2">
        {printRows.map((row, index) => {
          const isExpanded = expandedRow === index;
          const [w, d] = row.size.split('×').map(Number);

          return (
            <React.Fragment key={`${row.size}-${row.height}-${row.labels.join(',')}`}>
              <div
                className={`p-3 rounded-lg bg-surface-elevated ${row.needsSplit ? 'cursor-pointer active:bg-surface-hover' : ''}`}
                onClick={() => row.needsSplit && setExpandedRow(isExpanded ? null : index)}
              >
                <div className="flex items-start gap-3">
                  {/* Category colors */}
                  <div className="flex gap-1 pt-0.5">
                    {row.categoryIds.slice(0, 3).map((catId) => {
                      const cat = layout.categories.find(c => c.id === catId);
                      return (
                        <div
                          key={catId}
                          className="w-3.5 h-3.5 rounded"
                          style={{ backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR }}
                        />
                      );
                    })}
                    {row.categoryIds.length > 3 && (
                      <span className="text-xs text-content-disabled">
                        +{row.categoryIds.length - 3}
                      </span>
                    )}
                  </div>

                  {/* Size, height, labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-content">
                        {row.size}
                      </span>
                      <span className="text-sm text-content-tertiary">
                        {row.height}u
                      </span>
                      {row.needsSplit && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-[var(--color-warning-muted)] text-[var(--color-warning)]">
                          Split
                          <svg
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      )}
                    </div>
                    {/* Label and notes indicator */}
                    {(row.labels[0] || row.notes) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {row.labels[0] && (
                          <span className="text-sm truncate text-content-tertiary">
                            {row.labels[0]}
                          </span>
                        )}
                        {row.notes && (
                          <span title={row.notes}>
                            <svg
                              className="w-3.5 h-3.5 flex-shrink-0 text-content-disabled"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Count and filament */}
                  <div className="text-right flex-shrink-0">
                    <span className="font-semibold text-content">
                      ×{row.binCount}
                    </span>
                    {row.needsSplit && (
                      <div className="text-xs text-content-tertiary">
                        {row.totalPieces} pcs
                      </div>
                    )}
                    <div className="text-xs text-content-disabled mt-0.5">
                      ~{row.filament}m
                    </div>
                  </div>
                </div>

                {/* Expandable split preview */}
                {isExpanded && row.needsSplit && (
                  <div className="mt-3 pt-3 border-t border-stroke-subtle">
                    <div className="flex items-start gap-4">
                      <SplitPreview width={w} depth={d} pieces={row.pieces} />
                      <div className="text-xs text-content-secondary flex-1">
                        <div className="font-medium mb-1">
                          Split into {row.totalPieces} pieces:
                        </div>
                        {row.pieces.map((piece) => (
                          <div key={`${piece.width}x${piece.depth}`} className="text-content-tertiary">
                            {piece.count}× {piece.width}×{piece.depth}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="mt-4 p-3 rounded-lg bg-surface-elevated">
        <div className="flex justify-between text-sm">
          <span className="text-content-tertiary">Est. filament</span>
          <span className="text-content">{totalFilament}m (~{spoolEstimate}× 1kg)</span>
        </div>
      </div>
    </div>
  );
}
