import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useLayoutSwitcher } from '@/shared/hooks';
import { useInteractionStore } from '@/core/store/interaction';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { useLibraryStore } from '@/core/store/library';
import { LayoutList } from './LayoutList';
import { ImportView } from './ImportView';
import type { ViewMode } from './ViewModeToggle';
import type { Layout } from '@/core/types';
import { layoutId } from '@/core/types';
import type { LayoutArchive } from '@/core/storage';
import { downloadArchive, importArchive } from '@/core/storage';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';

export type SortOption = 'recent' | 'name' | 'size' | 'binCount';

type Tab = 'layouts' | 'import';

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
  const [isExporting, setIsExporting] = useState(false);
  const handleSortChange = useCallback((value: SortOption) => setSortBy(value), []);
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

  const setLibrary = useLibraryStore((state) => state.setLibrary);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

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
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
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
      const result = await switchLayout(layoutId(id));
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
      const result = await deleteLayout(layoutId(id));
      // Result error is already shown via toast internally
      return isOk(result);
    },
    [deleteLayout]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const result = await duplicateLayout(layoutId(id));
      // Result error is already shown via toast internally
      return isOk(result);
    },
    [duplicateLayout]
  );

  const handleRename = useCallback(
    (id: string, newName: string) => {
      renameLayout(layoutId(id), newName);
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
        await switchLayout(layoutId(result.value));
        announceToScreenReader(`Imported ${layout.name}`);
        onClose();
      }
    },
    [importLayoutFromJSON, switchLayout, announceToScreenReader, onClose]
  );

  const handleImportArchive = useCallback(
    async (archive: LayoutArchive) => {
      const addToast = useToastStore.getState().addToast;

      try {
        const currentLibrary = useLibraryStore.getState().library;
        const { result, library: updatedLibrary } = await importArchive(archive, currentLibrary);

        setLibrary(updatedLibrary);

        if (result.imported > 0) {
          addToast(
            t('layouts.archiveImported', {
              count: result.imported,
              skipped: result.skipped,
            }),
            'success'
          );
          announceToScreenReader(`Imported ${result.imported} layouts`);
          onClose();
        } else {
          addToast(t('layouts.archiveImportFailed'), 'error');
        }
      } catch {
        addToast(t('layouts.archiveImportFailed'), 'error');
      }
    },
    [setLibrary, announceToScreenReader, onClose, t]
  );

  const handleExportAll = useCallback(async () => {
    const addToast = useToastStore.getState().addToast;
    setIsExporting(true);
    try {
      const currentLibrary = useLibraryStore.getState().library;
      const { exported, skipped } = await downloadArchive(currentLibrary);
      if (skipped > 0) {
        addToast(t('layouts.exportedAllWithSkipped', { count: exported, skipped }), 'info');
      } else {
        addToast(t('layouts.exportedAll', { count: exported }), 'success');
      }
    } catch {
      addToast(t('layouts.exportFailed'), 'error');
    } finally {
      setIsExporting(false);
    }
  }, [t]);

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
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="layout-manager-title"
        className="bg-surface-elevated rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] grid grid-rows-[auto_1fr] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-stroke-subtle px-6 py-4">
          <div className="flex items-center gap-3">
            {activeTab === 'import' && (
              <button
                onClick={() => setActiveTab('layouts')}
                className="p-1 text-content-secondary hover:text-content transition-colors rounded hover:bg-surface"
                aria-label={t('layouts.backToLayouts')}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <h2 id="layout-manager-title" className="text-2xl font-bold text-content">
              {activeTab === 'layouts' ? t('layouts.layouts') : t('common.import')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'layouts' && (
              <>
                <button
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="rounded-md border border-stroke bg-surface px-3 py-1.5 text-sm font-medium text-content transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {isExporting ? t('common.exporting') : t('layouts.exportAll')}
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className="rounded-md border border-stroke bg-surface px-3 py-1.5 text-sm font-medium text-content transition-colors hover:bg-surface-hover"
                >
                  {t('common.import')}
                </button>
                <button
                  onClick={handleCreate}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
                >
                  {t('layouts.newLayout')}
                </button>
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

        {/* Content */}
        <div className="min-h-0 overflow-hidden flex flex-col px-6 pb-6">
          {activeTab === 'layouts' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <LayoutList
                entries={library.entries}
                activeLayoutId={activeLayoutId}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                showViewToggle={!isMobile}
                sortBy={sortBy}
                onSortChange={handleSortChange}
                onSwitch={handleSwitch}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onShare={handleShare}
              />
            </div>
          )}

          {activeTab === 'import' && (
            <div className="h-full">
              <ImportView
                onImport={handleImport}
                onImportArchive={handleImportArchive}
                onCancel={handleImportCancel}
              />
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
