import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBinList } from '@/hooks/useBinList';
import { useUIStore } from '@/core/store/ui';
import { useResponsive } from '@/shared/hooks';
import { BinListTable } from './BinListTable';
import { BinListFilters } from './BinListFilters';
import { BinListDashboard } from './BinListDashboard';
import { BulkActions } from './BulkActions';
import { MobileBinList } from './MobileBinList';

interface BinListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen modal for the expanded bin list.
 * On mobile: Uses MobileBinList with card layout and bottom action bar.
 * On desktop: Shows statistics dashboard, filters, and sortable table with bulk actions.
 */
export function BinListModal({ isOpen, onClose }: BinListModalProps) {
  const { isMobile } = useResponsive();

  if (!isOpen) return null;

  // Use dedicated mobile component for better UX on small screens
  if (isMobile) {
    return <MobileBinList isOpen={isOpen} onClose={onClose} />;
  }

  return <BinListModalContent onClose={onClose} />;
}

function BinListModalContent({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { isMobile } = useResponsive();
  const [showDashboard, setShowDashboard] = useState(!isMobile); // Collapsed by default on mobile

  const {
    // Data
    rows,
    unfilteredRows,
    hasAnySplits,
    categoryBreakdown,

    // Aggregates
    totalBins,
    totalPieces,
    totalFilament,
    totalCost,
    totalPrintTimeHours,
    spoolEstimate,
    spoolPercentage,

    // Filter/sort state
    searchQuery,
    setSearchQuery,
    filters,
    setSort,
    toggleCategoryVisibility,
    toggleGroupByCategory,
    resetFilters,

    // Selection
    selectedIndices,
    toggleRowSelection,
    selectAllRows,
    clearSelection,
    isAllSelected,
    selectionCount,

    // Bulk actions
    deleteBulkSelection,
    changeBulkCategory,
    updateBulkLabel,
    updateBulkNotes,

    // Inline editing
    updateBinLabel,
    updateBinNotes,

    // Export
    downloadExport,
    copyToClipboard,

    // Actions
    selectBinsByRow,

    // Categories
    categories,
  } = useBinList();

  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  // Announce modal opened
  useEffect(() => {
    announceToScreenReader(`Bin list expanded. ${rows.length} bin types, ${totalBins} total bins.`);
  }, [announceToScreenReader, rows.length, totalBins]);

  // Handle escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectionCount > 0) {
          clearSelection();
          e.preventDefault();
        } else {
          onClose();
        }
        return;
      }

      // Focus trap - Tab key
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }

      // Select all with Ctrl+A (but not when inside text inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && rows.length > 0) {
        const target = e.target as HTMLElement;
        const isInTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInTextInput) {
          e.preventDefault();
          selectAllRows();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, selectionCount, clearSelection, rows.length, selectAllRows]);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Handler for inline label editing (updates specific bins in the row)
  const handleEditLabel = useCallback(
    (binIds: string[], label: string) => {
      updateBinLabel(binIds, label);
    },
    [updateBinLabel]
  );

  // Handler for inline notes editing (updates specific bins in the row)
  const handleEditNotes = useCallback(
    (binIds: string[], notes: string) => {
      updateBinNotes(binIds, notes);
    },
    [updateBinNotes]
  );

  // Clear filters including search
  const handleResetFilters = useCallback(() => {
    resetFilters();
    setSearchQuery('');
  }, [resetFilters, setSearchQuery]);

  // Toggle dashboard visibility
  const toggleDashboard = useCallback(() => {
    setShowDashboard((s) => !s);
  }, []);

  // Use portal to escape any parent containing blocks (like BottomSheet with transform)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bin-list-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full h-full md:max-w-6xl md:max-h-[90vh] md:m-4 flex flex-col bg-surface-secondary md:rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-stroke bg-surface-elevated">
          <div className="flex items-center gap-2 md:gap-4">
            <h2 id="bin-list-modal-title" className="text-base md:text-lg font-semibold text-content">
              Bin List
            </h2>
            <span className="text-xs md:text-sm text-content-tertiary hidden sm:inline">
              {totalBins} bins · {totalFilament}m filament
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle dashboard */}
            <button
              onClick={toggleDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content bg-surface hover:bg-surface-hover rounded-lg transition-colors"
              aria-pressed={showDashboard}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {showDashboard ? 'Hide Stats' : 'Show Stats'}
            </button>

            {/* Export dropdown */}
            <ExportDropdown
              onDownload={downloadExport}
              onCopy={copyToClipboard}
            />

            {/* Close button */}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 text-content-secondary hover:text-content hover:bg-surface-hover rounded-lg transition-colors"
              aria-label="Close bin list"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Dashboard - collapsible on mobile, toggleable via showDashboard */}
        {showDashboard && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-stroke">
            <BinListDashboard
              totalBinTypes={rows.length}
              totalBins={totalBins}
              totalPieces={totalPieces}
              totalFilament={totalFilament}
              totalCost={totalCost}
              totalPrintTimeHours={totalPrintTimeHours}
              spoolEstimate={spoolEstimate}
              spoolPercentage={spoolPercentage}
              hasAnySplits={hasAnySplits}
              categoryBreakdown={categoryBreakdown}
              collapsible={isMobile}
              defaultCollapsed={isMobile}
            />
          </div>
        )}

        {/* Filters */}
        <div className="px-4 md:px-6 py-3 border-b border-stroke bg-surface-elevated">
          <BinListFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categories={categories}
            filters={filters}
            onToggleCategoryVisibility={toggleCategoryVisibility}
            onToggleGroupByCategory={toggleGroupByCategory}
            onResetFilters={handleResetFilters}
            visibleCount={rows.length}
            totalCount={unfilteredRows.length}
          />
        </div>

        {/* Bulk actions toolbar (shown when selection active) */}
        <BulkActions
          selectionCount={selectionCount}
          categories={categories}
          onDelete={deleteBulkSelection}
          onChangeCategory={changeBulkCategory}
          onClearSelection={clearSelection}
          onUpdateLabel={updateBulkLabel}
          onUpdateNotes={updateBulkNotes}
        />

        {/* Table */}
        <div className="flex-1 overflow-hidden">
          <BinListTable
            rows={rows}
            categories={categories}
            selectedIndices={selectedIndices}
            onToggleSelection={toggleRowSelection}
            onSelectAll={selectAllRows}
            isAllSelected={isAllSelected}
            sortKey={filters.sortKey}
            sortOrder={filters.sortOrder}
            onSort={setSort}
            onRowClick={selectBinsByRow}
            hasAnySplits={hasAnySplits}
            onEditLabel={handleEditLabel}
            onEditNotes={handleEditNotes}
          />
        </div>

        {/* Footer */}
        <footer className="px-4 md:px-6 py-3 border-t border-stroke bg-surface-elevated">
          <div className="flex items-center justify-between">
            <div className="text-xs text-content-tertiary hidden md:block">
              Double-click label or notes to edit inline. Shift+click for range selection.
            </div>
            <div className="text-xs text-content-tertiary md:hidden">
              Tap to select · Long-press for options
            </div>
            <div className="hidden md:flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 text-xs bg-surface border border-stroke rounded">⌘A</kbd>
              <span className="text-xs text-content-tertiary">Select all</span>
              <kbd className="px-1.5 py-0.5 text-xs bg-surface border border-stroke rounded ml-3">Esc</kbd>
              <span className="text-xs text-content-tertiary">Clear / Close</span>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

// Export dropdown component
function ExportDropdown({
  onDownload,
  onCopy,
}: {
  onDownload: (format: 'tsv' | 'csv' | 'json') => void;
  onCopy: (format: 'tsv' | 'csv' | 'json') => Promise<boolean>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleDownload = (format: 'tsv' | 'csv' | 'json') => {
    onDownload(format);
    setIsOpen(false);
  };

  const handleCopy = async (format: 'tsv' | 'csv' | 'json') => {
    await onCopy(format);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-content-secondary hover:text-content bg-surface hover:bg-surface-hover rounded-lg transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 py-1 bg-surface-elevated border border-stroke rounded-lg shadow-lg z-50">
          <div className="px-3 py-1.5 text-xs text-content-tertiary border-b border-stroke-subtle">
            Download
          </div>
          <button
            onClick={() => handleDownload('tsv')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-content hover:bg-surface-hover"
          >
            <span className="w-8 text-xs text-content-tertiary">TSV</span>
            Tab-separated
          </button>
          <button
            onClick={() => handleDownload('csv')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-content hover:bg-surface-hover"
          >
            <span className="w-8 text-xs text-content-tertiary">CSV</span>
            Comma-separated
          </button>
          <button
            onClick={() => handleDownload('json')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-content hover:bg-surface-hover"
          >
            <span className="w-8 text-xs text-content-tertiary">JSON</span>
            Full data
          </button>

          <div className="px-3 py-1.5 text-xs text-content-tertiary border-y border-stroke-subtle mt-1">
            Copy to clipboard
          </div>
          <button
            onClick={() => handleCopy('tsv')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-content hover:bg-surface-hover"
          >
            <span className="w-8 text-xs text-content-tertiary">TSV</span>
            Copy as TSV
          </button>
          <button
            onClick={() => handleCopy('csv')}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-content hover:bg-surface-hover"
          >
            <span className="w-8 text-xs text-content-tertiary">CSV</span>
            Copy as CSV
          </button>
        </div>
      )}
    </div>
  );
}

export { BinListTable } from './BinListTable';
export { BinListFilters } from './BinListFilters';
export { BinListDashboard } from './BinListDashboard';
export { BulkActions } from './BulkActions';
