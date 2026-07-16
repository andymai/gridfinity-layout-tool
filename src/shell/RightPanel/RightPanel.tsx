import React, { Suspense, useState, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useViewStore } from '@/core/store/view';
import { useSettingsStore } from '@/core/store/settings';
import { DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { exportPrintListTSV } from '@/core/storage';
import { trackEvent } from '@/shared/analytics/posthog';
import { Button, Collapsible, IconButton } from '@/design-system';
import { ConfirmDialog } from '@/shared/components';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';

const LIST_SEPARATOR = ', ';
import { usePrintList } from '@/features/print-export/hooks/usePrintList';
import { PrintListSummary, PrintListEmpty } from '@/features/print-export/components';
import { SplitPreview } from '../Print/SplitPreview';
import { getLinkedBins } from '@/features/design-linking';
import {
  useBinInspector,
  SingleBinInspector,
  MultiBinInspector,
  EmptyState,
} from '@/features/bin-inspector';

// Lazy load SnapshotHistory — only loaded when History tab is selected
const SnapshotHistory = lazyWithRetry(() =>
  import('@/features/snapshots').then(namedExport('SnapshotHistory'))
);

const LayoutExportDialog = lazyWithRetry(() =>
  import('../layoutExport/LayoutExportDialog').then(namedExport('LayoutExportDialog'))
);

type RightPanelTab = 'inspector' | 'history';

export function RightPanel() {
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<RightPanelTab>('inspector');
  const [printListExpanded, setPrintListExpanded] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [layoutExportOpen, setLayoutExportOpen] = useState(false);
  const [expandedSplitRow, setExpandedSplitRow] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setIsScrolled(scrollRef.current.scrollTop > 0);
    }
  }, []);

  const { collapsed, toggle } = useViewStore(
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

  // Only bins linked to a saved design have printable geometry, so the layout
  // 3D export is offered only when at least one exists.
  const linkedBinCount = useMemo(() => getLinkedBins(layout.bins).length, [layout.bins]);

  // Shared nozzle size — drives both the print-time estimate and connector scaling.
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const handleNozzleChange = useCallback((value: number) => {
    const current = useSettingsStore.getState().settings.printSettings;
    useSettingsStore.getState().updateSetting('printSettings', { ...current, nozzleSizeMm: value });
  }, []);

  if (collapsed) {
    return (
      <aside
        data-inspector
        className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out bg-surface-secondary border-l border-stroke-subtle"
        style={{ width: '48px' }}
      >
        <div className="flex flex-col items-center py-2">
          <IconButton
            size="sm"
            touchTarget={false}
            onClick={toggle}
            title={t('rightPanel.expandPanel')}
            aria-label={t('rightPanel.expandRightPanel')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {ICON_PATHS.chevronDoubleLeft.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
              ))}
            </svg>
          </IconButton>
        </div>
      </aside>
    );
  }

  const collapseButton = (
    <IconButton
      size="sm"
      touchTarget={false}
      onClick={toggle}
      className="flex-shrink-0 h-8 w-8 text-content-tertiary"
      title={t('rightPanel.collapsePanel')}
      aria-label={t('rightPanel.collapseRightPanel')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {ICON_PATHS.chevronDoubleRight.map((d) => (
          <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
        ))}
      </svg>
    </IconButton>
  );

  return (
    <aside
      data-inspector
      className="flex-shrink-0 flex flex-col h-full overflow-hidden transition-all duration-200 ease-in-out bg-surface-secondary border-l border-stroke-subtle animate-fade-in"
      style={{ width: '288px' }}
    >
      {/* Header with tabs */}
      <div
        className={`flex flex-col h-[47px] border-b border-stroke-subtle transition-shadow duration-200 ${
          isScrolled ? 'shadow-elevated' : ''
        }`}
      >
        <div className="flex items-center gap-3 px-4 h-full">
          {collapseButton}
          <div className="flex gap-1" role="tablist">
            <Button
              variant="ghost"
              size="sm"
              id="tab-inspector"
              role="tab"
              aria-selected={activeTab === 'inspector'}
              aria-controls="tabpanel-inspector"
              className={`font-semibold uppercase tracking-wider rounded hover:bg-transparent ${
                activeTab === 'inspector'
                  ? 'text-accent bg-accent-muted'
                  : 'text-content-tertiary hover:text-content-secondary'
              }`}
              onClick={() => setActiveTab('inspector')}
            >
              {t('rightPanel.inspector')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              id="tab-history"
              role="tab"
              aria-selected={activeTab === 'history'}
              aria-controls="tabpanel-history"
              className={`font-semibold uppercase tracking-wider rounded hover:bg-transparent ${
                activeTab === 'history'
                  ? 'text-accent bg-accent-muted'
                  : 'text-content-tertiary hover:text-content-secondary'
              }`}
              onClick={() => setActiveTab('history')}
            >
              {t('rightPanel.historyTab')}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0"
      >
        {activeTab === 'history' && (
          <div id="tabpanel-history" role="tabpanel" aria-labelledby="tab-history">
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
                </div>
              }
            >
              <SnapshotHistory />
            </Suspense>
          </div>
        )}

        {activeTab === 'inspector' && (
          <div id="tabpanel-inspector" role="tabpanel" aria-labelledby="tab-inspector">
            {/* Selection Panel - Collapsible */}
            <div className="px-4 py-3 border-b border-stroke-subtle">
              <Collapsible
                title={
                  isMultiSelect
                    ? t('rightPanel.multiSelection')
                    : bin
                      ? t('rightPanel.binProperties')
                      : t('rightPanel.selection')
                }
                size="md"
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
              </Collapsible>
            </div>

            {/* Print List - Collapsible */}
            <div data-print-list className="px-4 py-3">
              <Collapsible
                title={t('rightPanel.binList')}
                size="md"
                expanded={printListExpanded}
                onExpandedChange={setPrintListExpanded}
                badge={
                  printList.rows.length > 0 ? (
                    <span className="badge badge-info">{printList.totalBins}</span>
                  ) : undefined
                }
                actions={
                  printList.rows.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {/* Copy button */}
                      <IconButton
                        size="sm"
                        touchTarget={false}
                        onClick={() => {
                          const tsv = exportPrintListTSV(printList.rows, {
                            gridUnitMm: layout.gridUnitMm,
                            categories: layout.categories,
                          });
                          void navigator.clipboard.writeText(tsv);
                          setCopyFeedback(true);
                          trackEvent('ui.layoutExported', { format: 'tsv' });
                          setTimeout(() => setCopyFeedback(false), 2000);
                        }}
                        title={t('rightPanel.copyTSV')}
                        aria-label={t('rightPanel.copyBinListAsTsv')}
                      >
                        {copyFeedback ? (
                          <svg
                            className="w-4 h-4 text-success"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            {ICON_PATHS.check.map((d) => (
                              <path
                                key={d}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={d}
                              />
                            ))}
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            {ICON_PATHS.duplicate.map((d) => (
                              <path
                                key={d}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={d}
                              />
                            ))}
                          </svg>
                        )}
                      </IconButton>
                      {/* Export entire layout (linked bins + baseplate) as a ZIP */}
                      {linkedBinCount > 0 && (
                        <IconButton
                          size="sm"
                          touchTarget={false}
                          onClick={() => setLayoutExportOpen(true)}
                          title={t('layoutExport.button')}
                          aria-label={t('layoutExport.button')}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            {ICON_PATHS.download.map((d) => (
                              <path
                                key={d}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={d}
                              />
                            ))}
                          </svg>
                        </IconButton>
                      )}
                    </div>
                  ) : undefined
                }
              >
                <div className="-mx-4 -mb-3 flex flex-col border-t border-stroke-subtle">
                  <div>
                    {printList.rows.length === 0 ? (
                      <PrintListEmpty />
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-surface-elevated">
                          <tr>
                            <th className="pl-4 pr-2 py-2 text-left font-medium sticky top-0 text-content-secondary bg-surface-elevated">
                              {t('common.size')}
                            </th>
                            <th
                              className="px-2 py-2 text-left font-medium sticky top-0 text-content-secondary bg-surface-elevated"
                              title={t('common.height')}
                            >
                              H
                            </th>
                            <th
                              className="px-2 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated"
                              title={t('common.quantity')}
                            >
                              {t('rightPanel.qtyAbbrev')}
                            </th>
                            {printList.hasAnySplits && (
                              <th
                                className="px-2 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated"
                                title={t('rightPanel.piecesAfterSplit')}
                              >
                                {t('rightPanel.pcsAbbrev')}
                              </th>
                            )}
                            <th
                              className="pl-2 pr-4 py-2 text-right font-medium sticky top-0 text-content-secondary bg-surface-elevated"
                              title={t('rightPanel.filamentMeters')}
                            >
                              {t('rightPanel.filamentAbbrev')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {printList.rows.map((row, index) => {
                            const isExpanded = expandedSplitRow === index;
                            const [w, d] = row.size.split('×').map(Number);

                            return (
                              <React.Fragment
                                key={`${row.size}-${row.height}-${row.labels.join(',')}-${index}`}
                              >
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
                                          title={row.categoryIds
                                            .map(
                                              (catId) =>
                                                layout.categories.find((c) => c.id === catId)
                                                  ?.name || t('common.unknown')
                                            )
                                            .join(LIST_SEPARATOR)}
                                        >
                                          {row.categoryIds.slice(0, 3).map((catId) => {
                                            const cat = layout.categories.find(
                                              (c) => c.id === catId
                                            );
                                            return (
                                              <span
                                                key={catId}
                                                role="img"
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{
                                                  backgroundColor:
                                                    cat?.color || DEFAULT_CATEGORY_COLOR,
                                                }}
                                                aria-label={
                                                  cat?.name || t('rightPanel.unknownCategory')
                                                }
                                              />
                                            );
                                          })}
                                          {row.categoryIds.length > 3 && (
                                            <span className="text-xxs text-content-disabled">
                                              {t('rightPanel.moreCategories', {
                                                count: row.categoryIds.length - 3,
                                              })}
                                            </span>
                                          )}
                                        </span>
                                        {row.size}
                                        {row.needsSplit && (
                                          <svg
                                            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform text-warning ${isExpanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            aria-label={t('grid.clickToSeeSplitPreview')}
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M19 9l-7 7-7-7"
                                            />
                                          </svg>
                                        )}
                                      </span>
                                      {(row.labels[0] ||
                                        row.notes ||
                                        (row.customProperties &&
                                          Object.keys(row.customProperties).length > 0)) && (
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
                                                aria-label={t('grid.hasNotesAriaLabel')}
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                                                />
                                              </svg>
                                            </span>
                                          )}
                                          {row.customProperties &&
                                            Object.keys(row.customProperties).length > 0 && (
                                              <span
                                                title={t('rightPanel.customPropertiesCount', {
                                                  count: Object.keys(row.customProperties).length,
                                                })}
                                              >
                                                <svg
                                                  className="w-3 h-3 flex-shrink-0 text-content-disabled"
                                                  fill="none"
                                                  viewBox="0 0 24 24"
                                                  stroke="currentColor"
                                                  aria-label={t(
                                                    'grid.hasCustomPropertiesAriaLabel'
                                                  )}
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                                                  />
                                                </svg>
                                              </span>
                                            )}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-2 py-2 text-content-tertiary">{row.height}u</td>
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
                                            {t('rightPanel.splitInto')}
                                            {row.totalPieces}
                                            {t('rightPanel.pieces')}
                                          </div>
                                          {row.pieces.map((piece) => (
                                            <div
                                              key={`${piece.width}x${piece.depth}`}
                                              className="text-content-tertiary"
                                            >
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
                    <div className="px-4 py-2 border-t border-stroke-subtle">
                      <SettingsRow
                        label={t('settings.nozzleSize')}
                        htmlFor="rightPanelNozzle"
                        tooltip={t('rightPanel.nozzleSizeTooltip')}
                        unit="mm"
                      >
                        <DeferredNumberInput
                          id="rightPanelNozzle"
                          value={nozzleSizeMm}
                          onChange={handleNozzleChange}
                          min={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN}
                          max={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX}
                          step={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP}
                          className="input w-14 py-0.5 px-1 text-xs text-right"
                          aria-label={t('settings.nozzleSize')}
                        />
                      </SettingsRow>
                    </div>
                  )}
                  {printList.rows.length > 0 && (
                    <PrintListSummary
                      totalBins={printList.totalBins}
                      totalPieces={printList.totalPieces}
                      totalFilament={printList.totalFilament}
                      totalCost={printList.totalCost}
                      totalPrintTimeHours={printList.totalPrintTimeHours}
                      spoolPercentage={printList.spoolPercentage}
                      hasAnySplits={printList.hasAnySplits}
                      nozzleSizeMm={printList.nozzleSizeMm}
                    />
                  )}
                </div>
              </Collapsible>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmState !== null}
        title={deleteConfirmState?.title || ''}
        message={deleteConfirmState?.message || ''}
        confirmText={t('common.delete')}
        destructive
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {layoutExportOpen && (
        <Suspense fallback={null}>
          <LayoutExportDialog open={layoutExportOpen} onClose={() => setLayoutExportOpen(false)} />
        </Suspense>
      )}
    </aside>
  );
}
