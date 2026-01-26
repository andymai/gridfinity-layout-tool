import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useLayoutSwitcher } from '@/hooks';
import { useUIStore } from '@/core/store/ui';
import { useLibraryStore } from '@/core/store/library';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { LayoutList } from './LayoutList';
import { ImportView } from './ImportView';
import { SharedWithMeList } from './SharedWithMeList';
import { ViewModeToggle } from './ViewModeToggle';
import type { ViewMode } from './ViewModeToggle';
import type { Layout } from '@/core/types';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';

export type SortOption = 'recent' | 'name' | 'size' | 'binCount';

type Tab = 'layouts' | 'shared' | 'import';

export interface ShareModalRenderProps {
  isOpen: boolean;
  onClose: () => void;
  layoutId?: string;
}

interface LayoutManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Render prop for ShareModal - allows dependency injection to avoid cross-feature imports */
  renderShareModal?: (props: ShareModalRenderProps) => ReactNode;
}

/**
 * Layout Manager Modal - main entry point.
 * Provides tabbed interface for managing layouts (list view) and importing layouts.
 */
export function LayoutManagerModal({ isOpen, onClose, renderShareModal }: LayoutManagerModalProps) {
  if (!isOpen) return null;
  return <LayoutManagerModalContent onClose={onClose} renderShareModal={renderShareModal} />;
}

function LayoutManagerModalContent({
  onClose,
  renderShareModal,
}: {
  onClose: () => void;
  renderShareModal?: (props: ShareModalRenderProps) => ReactNode;
}) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const [shareModalLayoutId, setShareModalLayoutId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('layouts');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // View mode from persisted settings (default: grid)
  const viewModePreference = useSettingsStore((state) => state.settings.layoutManagerViewMode);
  const updateSetting = useSettingsStore((state) => state.updateSetting);

  // Force list view on mobile, respect preference on desktop
  const viewMode: ViewMode = isMobile ? 'list' : viewModePreference;

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      updateSetting('layoutManagerViewMode', mode);
    },
    [updateSetting]
  );

  const {
    activeLayoutId,
    library,
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
    importLayoutFromJSON,
  } = useLayoutSwitcher();

  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);
  const sharedWithMeCount = useLibraryStore((state) => state.sharedWithMe.length);

  // Announce modal opened
  useEffect(() => {
    const count = library.entries.length;
    announceToScreenReader(`Layouts dialog opened. ${count} layouts available.`);
  }, [announceToScreenReader, library.entries.length]);

  // Handle escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus close button on mount
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleSwitch = useCallback(
    async (id: string) => {
      const entry = library.entries.find((e) => e.id === id);
      const result = await switchLayout(id);
      if (isOk(result)) {
        announceToScreenReader(`Switched to ${entry?.name || 'layout'}`);
        onClose();
      }
    },
    [library.entries, switchLayout, announceToScreenReader, onClose]
  );

  const handleCreate = useCallback(async () => {
    const result = await createNewLayout();
    if (isOk(result)) {
      announceToScreenReader('New layout created');
      onClose();
    }
  }, [createNewLayout, announceToScreenReader, onClose]);

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await deleteLayout(id);
      // Result error is already shown via toast internally
      return isOk(result);
    },
    [deleteLayout]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const result = await duplicateLayout(id);
      // Result error is already shown via toast internally
      return isOk(result);
    },
    [duplicateLayout]
  );

  const handleRename = useCallback(
    (id: string, newName: string) => {
      renameLayout(id, newName);
    },
    [renameLayout]
  );

  const handleImport = useCallback(
    async (layout: Layout) => {
      const result = await importLayoutFromJSON({
        ...layout,
        name: `${layout.name} (imported)`,
      });

      if (isOk(result)) {
        // Switch to the imported layout
        await switchLayout(result.value);
        announceToScreenReader(`Imported ${layout.name}`);
        onClose();
      }
    },
    [importLayoutFromJSON, switchLayout, announceToScreenReader, onClose]
  );

  const handleImportCancel = useCallback(() => {
    setActiveTab('layouts');
  }, []);

  const handleShare = useCallback((layoutId: string) => {
    setShareModalLayoutId(layoutId);
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-manager-title"
        className="bg-surface-elevated rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] grid grid-rows-[auto_auto_1fr] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 id="layout-manager-title" className="text-2xl font-bold text-content">{t('layouts.layouts')}</h2>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle + Sort (desktop only, layouts tab only) */}
            {!isMobile && activeTab === 'layouts' && (
              <>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-sm bg-surface border border-stroke rounded-lg pl-3 pr-8 py-1.5 text-content focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent appearance-none bg-no-repeat bg-[length:16px] bg-[right_8px_center] cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  }}
                  aria-label={t('layouts.sortBy')}
                >
                  <option value="recent">{t('layouts.sortRecent')}</option>
                  <option value="name">{t('layouts.sortName')}</option>
                  <option value="size">{t('layouts.sortSize')}</option>
                  <option value="binCount">{t('layouts.sortBinCount')}</option>
                </select>
                <ViewModeToggle value={viewMode} onChange={handleViewModeChange} />
              </>
            )}
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-1 text-content-secondary hover:text-content transition-colors rounded hover:bg-surface"
              aria-label={t('layouts.closeLayoutsDialog')}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1" role="tablist">
          <button
            id="layouts-tab"
            role="tab"
            aria-selected={activeTab === 'layouts'}
            aria-controls="layouts-panel"
            onClick={() => setActiveTab('layouts')}
            className={`
              flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${
                activeTab === 'layouts'
                  ? 'bg-accent text-on-dark'
                  : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>{t('layouts.myLayouts')}</button>

          <button
            id="shared-tab"
            role="tab"
            aria-selected={activeTab === 'shared'}
            aria-controls="shared-panel"
            onClick={() => setActiveTab('shared')}
            className={`
              flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${
                activeTab === 'shared'
                  ? 'bg-accent text-on-dark'
                  : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>{t('layouts.shared')}{sharedWithMeCount > 0 && (
              <span
                className={`
                text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center
                ${activeTab === 'shared' ? 'bg-white/20' : 'bg-surface-secondary'}
              `}
              >
                {sharedWithMeCount}
              </span>
            )}
          </button>

          <button
            id="import-tab"
            role="tab"
            aria-selected={activeTab === 'import'}
            aria-controls="import-panel"
            onClick={() => setActiveTab('import')}
            className={`
              flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${
                activeTab === 'import'
                  ? 'bg-accent text-on-dark'
                  : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
              }
            `}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>{t('common.import')}</button>
        </div>

        {/* Tab Content */}
        <div className="min-h-0 overflow-hidden flex flex-col">
          {/* My Layouts Tab */}
          {activeTab === 'layouts' && (
            <div
              id="layouts-panel"
              role="tabpanel"
              aria-labelledby="layouts-tab"
              className="flex-1 min-h-0 overflow-auto"
            >
              <LayoutList
                entries={library.entries}
                activeLayoutId={activeLayoutId}
                viewMode={viewMode}
                sortBy={sortBy}
                onSwitch={handleSwitch}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onCreate={handleCreate}
                onShare={handleShare}
              />
            </div>
          )}

          {activeTab === 'shared' && (
            <div
              id="shared-panel"
              role="tabpanel"
              aria-labelledby="shared-tab"
              className="flex-1 min-h-0 overflow-auto"
            >
              <SharedWithMeList onOpenLayout={onClose} />
            </div>
          )}

          {activeTab === 'import' && (
            <div id="import-panel" role="tabpanel" aria-labelledby="import-tab" className="h-full">
              <ImportView onImport={handleImport} onCancel={handleImportCancel} />
            </div>
          )}
        </div>
      </div>

      {/* Share Modal - rendered via dependency injection */}
      {renderShareModal?.({
        isOpen: shareModalLayoutId !== null,
        onClose: () => setShareModalLayoutId(null),
        layoutId: shareModalLayoutId ?? undefined,
      })}
    </div>
  );
}
