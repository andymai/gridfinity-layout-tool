import React, { useState, useCallback } from 'react';
import { DEFAULT_CATEGORY_COLOR } from '../../constants';
import { exportPrintListTSV } from '../../utils/storage';
import { usePrintList } from '../../hooks/usePrintList';
import { useUIStore } from '../../store/ui';
import { SplitPreview, PrintListSummary, PrintListEmpty } from '../PrintList';
import { BinListModal } from '../modals/BinListModal';

/**
 * Mobile-optimized print list matching desktop functionality.
 * Features: expandable split previews, filament per row, notes indicator,
 * click to select bins, sort/filter controls.
 */
export function MobilePrintList() {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);

  const printList = usePrintList();
  const closeMobilePanel = useUIStore((state) => state.closeMobilePanel);

  // Close bottom sheet when expanding to full screen modal
  const handleExpand = useCallback(() => {
    closeMobilePanel();
    setIsExpandedModalOpen(true);
  }, [closeMobilePanel]);

  const handleCopy = () => {
    const tsv = exportPrintListTSV(printList.rows);
    navigator.clipboard.writeText(tsv);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  if (printList.rows.length === 0) {
    return <PrintListEmpty compact />;
  }

  return (
    <div className="pb-4">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-content-tertiary">
          {printList.totalBins} bins{printList.hasAnySplits ? `, ${printList.totalPieces} pcs` : ''}
        </span>
        <div className="flex items-center gap-2">
          {/* Expand button */}
          <button
            onClick={handleExpand}
            className="btn btn-ghost btn-sm gap-1.5"
            aria-label="Expand bin list"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
          {/* Copy button */}
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
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Print list items */}
      <div className="space-y-2">
        {printList.rows.map((row, index) => {
          const isExpanded = expandedRow === index;
          const [w, d] = row.size.split('×').map(Number);

          return (
            <React.Fragment key={`${row.size}-${row.height}-${row.labels.join(',')}-${index}`}>
              <div
                className="p-3 rounded-lg bg-surface-elevated cursor-pointer active:bg-surface-hover"
                onClick={() => {
                  // Select bins on click
                  printList.selectBinsByRow(row);
                  // Toggle split preview if needed
                  if (row.needsSplit) {
                    setExpandedRow(isExpanded ? null : index);
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Category colors */}
                  <div className="flex gap-1 pt-0.5">
                    {row.categoryIds.slice(0, 3).map((catId) => {
                      const cat = printList.categories.find(c => c.id === catId);
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
                    {/* Label and notes/properties indicators */}
                    {(row.labels[0] || row.notes || (row.customProperties && Object.keys(row.customProperties).length > 0)) && (
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
                              aria-label="Has notes"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </span>
                        )}
                        {row.customProperties && Object.keys(row.customProperties).length > 0 && (
                          <svg
                            className="w-3.5 h-3.5 flex-shrink-0 text-content-disabled"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-label="Has custom properties"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                          </svg>
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
                      <SplitPreview width={w} depth={d} pieces={row.pieces} cellSize={14} />
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
      <div className="mt-4">
        <PrintListSummary
          totalBins={printList.totalBins}
          totalPieces={printList.totalPieces}
          totalFilament={printList.totalFilament}
          totalCost={printList.totalCost}
          totalPrintTimeHours={printList.totalPrintTimeHours}
          spoolPercentage={printList.spoolPercentage}
          hasAnySplits={printList.hasAnySplits}
          compact
        />
      </div>

      {/* Expanded bin list modal */}
      <BinListModal
        isOpen={isExpandedModalOpen}
        onClose={() => setIsExpandedModalOpen(false)}
      />
    </div>
  );
}
