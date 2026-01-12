import React, { useState, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '../store';
import { DEFAULT_CATEGORY_COLOR } from '../constants';
import { exportPrintListTSV } from '../utils/storage';
import { trackLayoutSnapshot } from '../utils/analytics';
import { ConfirmDialog } from './modals/ConfirmDialog';
import { BinListModal } from './modals/BinListModal';
import { usePrintList } from '../hooks/usePrintList';
import { SplitPreview, PrintListSummary, PrintListEmpty } from './PrintList';
import { CollapsibleSection } from './CollapsibleSection';
import {
  useBinInspector,
  SingleBinInspector,
  MultiBinInspector,
  EmptyState,
} from './inspector';

export function RightPanel() {
  const [printListExpanded, setPrintListExpanded] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [expandedSplitRow, setExpandedSplitRow] = useState<number | null>(null);
  const [binListModalOpen, setBinListModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollTop > 0);
    }
  }, []);

  const { collapsed, toggle } = useUIStore(
    useShallow((state) => ({
      collapsed: state.rightPanelCollapsed,
      toggle: state.toggleRightPanel,
    }))
  );

  // Use shared inspector hook
  const inspector = useBinInspector();
  const {
    isMultiSelect,
    bin,
    layout,
    deleteConfirmState,
    confirmDelete,
    cancelDelete,
    clearSelection,
  } = inspector;

  // Use the print list hook
  const printList = usePrintList();

  if (collapsed) {
    return (
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out bg-surface-secondary border-l border-stroke-subtle"
        style={{ width: '40px' }}
      >
        <div className="flex flex-col items-center py-3">
          <button
            onClick={toggle}
            className="p-1 rounded transition-colors text-content-secondary hover:bg-surface-hover hover:text-content"
            title="Expand panel"
            aria-label="Expand right panel"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>
    );
  }

  const collapseButton = (
    <button
      onClick={toggle}
      className="flex-shrink-0 p-1 rounded transition-colors text-content-tertiary hover:bg-surface-hover hover:text-content"
      title="Collapse panel"
      aria-label="Collapse right panel"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    </button>
  );

  return (
    <aside
      className="flex-shrink-0 flex flex-col h-full overflow-hidden transition-all duration-200 ease-in-out bg-surface-secondary border-l border-stroke-subtle"
      style={{ width: '288px' }}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-stroke-subtle transition-shadow duration-200 ${
        isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.5)]' : ''
      }`}>
        {collapseButton}
        <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
          Inspector
        </h2>
      </div>

      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0"
      >
        {/* Selection Panel - Collapsible */}
        <div className="px-4 py-3 border-b border-stroke-subtle">
        <CollapsibleSection
          title={isMultiSelect ? "Multi-Selection" : bin ? "Bin Properties" : "Selection"}
          variant="default"
        >
          {isMultiSelect ? (
            <MultiBinInspector
              inspector={inspector}
              variant="desktop"
              onClose={clearSelection}
            />
          ) : bin ? (
            <SingleBinInspector
              inspector={inspector}
              variant="desktop"
              onClose={clearSelection}
            />
          ) : (
            <EmptyState variant="desktop" />
          )}
        </CollapsibleSection>
      </div>

      {/* Print List - Collapsible */}
      <div className="flex flex-col">
        <div className={`flex items-center justify-between px-4 py-3 ${printListExpanded ? 'border-b border-stroke-subtle' : ''}`}>
          <button
            className="flex items-center gap-2 transition-colors bg-transparent"
            onClick={() => setPrintListExpanded(!printListExpanded)}
            aria-expanded={printListExpanded}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 text-content-tertiary ${printListExpanded ? 'rotate-0' : '-rotate-90'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <h2 className="section-header m-0">Bin List</h2>
            {printList.rows.length > 0 && (
              <span className="badge badge-info">{printList.totalBins}</span>
            )}
          </button>
          {printList.rows.length > 0 && (
            <div className="flex items-center gap-1">
              {/* Expand button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBinListModalOpen(true);
                }}
                className="btn btn-ghost p-1.5 min-w-0 min-h-0"
                title="Expand bin list"
                aria-label="Expand bin list to full view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              {/* Copy button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const tsv = exportPrintListTSV(printList.rows);
                  navigator.clipboard.writeText(tsv);
                  setCopyFeedback(true);
                  trackLayoutSnapshot(useLayoutStore.getState().layout, 'export_tsv');
                  setTimeout(() => setCopyFeedback(false), 2000);
                }}
                className="btn btn-ghost p-1.5 min-w-0 min-h-0"
                title="Copy as TSV for spreadsheets"
                aria-label="Copy bin list as TSV"
              >
                {copyFeedback ? (
                  <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        <div
          className={`flex flex-col transition-all duration-200 ${printListExpanded ? 'opacity-100' : 'opacity-0 max-h-0 overflow-hidden'}`}
        >
          <div>
            {printList.rows.length === 0 ? (
              <PrintListEmpty />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-elevated">
                  <tr>
                    <th className="pl-4 pr-2 py-2 text-left font-medium sticky top-0 text-content-secondary bg-surface-elevated">
                      Size
                    </th>
                    <th className="px-2 py-2 text-left font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Height">
                      H
                    </th>
                    <th className="px-2 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Quantity">
                      Qty
                    </th>
                    {printList.hasAnySplits && (
                      <th className="px-2 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Pieces after split">
                        Pcs
                      </th>
                    )}
                    <th className="pl-2 pr-4 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated" title="Estimated filament (meters)">
                      ~m
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printList.rows.map((row, index) => {
                    const isExpanded = expandedSplitRow === index;
                    const [w, d] = row.size.split('×').map(Number);

                    return (
                      <React.Fragment key={`${row.size}-${row.height}-${row.labels.join(',')}-${index}`}>
                        <tr
                          className={`transition-colors hover:bg-surface-hover cursor-pointer ${isExpanded ? '' : 'border-b border-stroke-subtle'}`}
                          onClick={() => {
                            printList.selectBinsByRow(row);
                            if (row.needsSplit) {
                              setExpandedSplitRow(isExpanded ? null : index);
                            }
                          }}
                        >
                          <td className="pl-4 pr-2 py-2 text-content">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="inline-flex gap-0.5"
                                  title={row.categoryIds.map(catId => layout.categories.find(c => c.id === catId)?.name || 'Unknown').join(', ')}
                                >
                                  {row.categoryIds.slice(0, 3).map((catId) => {
                                    const cat = layout.categories.find(c => c.id === catId);
                                    return (
                                      <span
                                        key={catId}
                                        role="img"
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR }}
                                        aria-label={cat?.name || 'Unknown category'}
                                      />
                                    );
                                  })}
                                  {row.categoryIds.length > 3 && (
                                    <span className="text-[9px] text-content-disabled">+{row.categoryIds.length - 3}</span>
                                  )}
                                </span>
                                {row.size}
                                {row.needsSplit && (
                                  <svg
                                    className={`w-3.5 h-3.5 flex-shrink-0 transition-transform text-[var(--color-warning)] ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    aria-label="Click to see split preview"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )}
                              </span>
                              {(row.labels[0] || row.notes) && (
                                <span className="flex items-center gap-1">
                                  {row.labels[0] && (
                                    <span
                                      className="text-xs truncate text-content-tertiary max-w-[80px]"
                                      title={row.labels[0]}
                                    >
                                      {row.labels[0]}
                                    </span>
                                  )}
                                  {row.notes && (
                                    <span title={row.notes}>
                                      <svg
                                        className="w-3 h-3 flex-shrink-0 text-content-disabled"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                      </svg>
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-content-tertiary">
                            {row.height}u
                          </td>
                          <td className="px-2 py-2 text-right text-content">
                            {row.binCount}
                          </td>
                          {printList.hasAnySplits && (
                            <td className="px-2 py-2 text-right text-content">
                              {row.totalPieces}
                            </td>
                          )}
                          <td className="pl-2 pr-4 py-2 text-right text-content-tertiary">
                            {row.filament}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-surface-elevated">
                            <td
                              colSpan={printList.hasAnySplits ? 5 : 4}
                              className="px-4 py-3 border-b border-stroke-subtle"
                            >
                              <div className="flex items-start gap-4">
                                <SplitPreview width={w} depth={d} pieces={row.pieces} />
                                <div className="text-xs text-content-secondary">
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {printList.rows.length > 0 && (
            <PrintListSummary
              totalBins={printList.totalBins}
              totalPieces={printList.totalPieces}
              totalFilament={printList.totalFilament}
              totalCost={printList.totalCost}
              totalPrintTimeHours={printList.totalPrintTimeHours}
              spoolPercentage={printList.spoolPercentage}
              hasAnySplits={printList.hasAnySplits}
            />
          )}
        </div>
      </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmState !== null}
        title={deleteConfirmState?.title || ''}
        message={deleteConfirmState?.message || ''}
        confirmText="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Expanded Bin List Modal */}
      <BinListModal
        isOpen={binListModalOpen}
        onClose={() => setBinListModalOpen(false)}
      />
    </aside>
  );
}
