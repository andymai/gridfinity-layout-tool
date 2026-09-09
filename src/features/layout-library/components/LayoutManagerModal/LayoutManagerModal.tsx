import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useLayoutSwitcher } from '@/shared/hooks';
import { useInteractionStore } from '@/core/store/interaction';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { useLibraryStore } from '@/core/store/library';
import { LayoutList } from './LayoutList';
import { ImportView } from './ImportView';
import { FolderTree } from './FolderTree';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { MoveToFolderDialog } from './MoveToFolderDialog';
import { useLayoutFolders } from '@/shared/hooks/useLayoutFolders';
import { childFolders, entriesInFolder, entryFolderId, folderPath } from '@/core/storage';
import type { ViewMode } from './ViewModeToggle';
import type { Layout } from '@/core/types';
import { layoutId } from '@/core/types';
import type { LayoutArchive } from '@/core/storage';
import { downloadArchive, importArchive } from '@/core/storage';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import { Button, IconButton, ArrowLeftIcon, XIcon } from '@/design-system';

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
  // null is every layout, flat; a folder shows only what is filed directly in it.
  const [folderId, setFolderId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
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
  const folderOps = useLayoutFolders();
  const hasFolders = folderOps.folders.length > 0;
  // A folder that vanished under the selection (deleted here, or elsewhere and
  // pulled) falls back to every layout rather than an empty, unnamed view.
  const currentPath = folderPath(library, folderId);
  const currentFolderId = folderId === null || currentPath.length > 0 ? folderId : null;
  const shownEntries =
    currentFolderId === null ? library.entries : entriesInFolder(library, currentFolderId);
  const subfolders = currentFolderId === null ? [] : childFolders(library, currentFolderId);
  const movingEntry = movingId ? library.entries.find((e) => e.id === movingId) : undefined;

  const handleMove = useCallback(
    async (destination: string | null) => {
      if (!movingEntry) return;
      const moved = await folderOps.moveLayout(movingEntry.id, destination);
      setMovingId(null);
      if (moved) {
        const target = destination ? folderPath(library, destination).at(-1)?.name : undefined;
        announceToScreenReader(
          target ? t('layouts.folders.movedTo', { name: target }) : t('layouts.folders.movedToRoot')
        );
      }
    },
    [movingEntry, folderOps, library, announceToScreenReader, t]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const parent = folderPath(library, id).at(-2)?.id ?? null;
      const removed = await folderOps.deleteFolder(id);
      if (removed && currentPath.some((f) => f.id === id)) setFolderId(parent);
    },
    [folderOps, library, currentPath]
  );

  // Announce modal opened
  useEffect(() => {
    const count = library.entries.length;
    announceToScreenReader(t('layouts.announce.dialogOpened', { count }));
  }, [announceToScreenReader, library.entries.length, t]);

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
        announceToScreenReader(
          t('layouts.announce.switchedTo', {
            name: entry?.name || t('layouts.announce.fallbackName'),
          })
        );
        onClose();
      }
    },
    [library.entries, switchLayout, announceToScreenReader, onClose, t]
  );

  const handleCreate = useCallback(async () => {
    const result = await createNewLayout();
    if (isOk(result)) {
      announceToScreenReader(t('toast.layoutCreated'));
      onClose();
    }
  }, [createNewLayout, announceToScreenReader, onClose, t]);

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
        announceToScreenReader(t('layouts.announce.imported', { name: layout.name }));
        onClose();
      }
    },
    [importLayoutFromJSON, switchLayout, announceToScreenReader, onClose, t]
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
          announceToScreenReader(t('layouts.announce.importedCount', { count: result.imported }));
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
      className="fixed inset-0 bg-overlay-dark flex items-center justify-center z-50 animate-fade-in"
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
              <IconButton
                size="sm"
                touchTarget={false}
                onClick={() => setActiveTab('layouts')}
                className="text-content-secondary hover:bg-surface hover:text-content"
                aria-label={t('layouts.backToLayouts')}
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </IconButton>
            )}
            <h2 id="layout-manager-title" className="text-2xl font-bold text-content">
              {activeTab === 'layouts' ? t('layouts.layouts') : t('common.import')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'layouts' && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleExportAll}
                  disabled={isExporting}
                  className="px-3 py-1.5 text-sm"
                >
                  {isExporting ? t('common.exporting') : t('layouts.exportAll')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setActiveTab('import')}
                  className="px-3 py-1.5 text-sm"
                >
                  {t('common.import')}
                </Button>
                <Button variant="primary" onClick={handleCreate} className="px-3 py-1.5 text-sm">
                  {t('layouts.newLayout')}
                </Button>
              </>
            )}
            <IconButton
              ref={closeButtonRef}
              size="sm"
              touchTarget={false}
              onClick={onClose}
              className="text-content-secondary hover:bg-surface hover:text-content"
              aria-label={t('layouts.closeLayoutsDialog')}
            >
              <XIcon className="w-5 h-5" />
            </IconButton>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 overflow-hidden flex flex-col px-6 pb-6">
          {activeTab === 'layouts' && (
            <div className="flex min-h-0 flex-1 gap-4">
              {/* The tree needs width; a phone gets the breadcrumb and the
                  subfolder chips above the list instead. */}
              {!isMobile && (
                <aside className="w-60 shrink-0 border-r border-stroke-subtle pr-3 pt-1">
                  <FolderTree
                    library={library}
                    selectedId={currentFolderId}
                    onSelect={setFolderId}
                    onCreate={(name, parentId) => void folderOps.createFolder(name, parentId)}
                    onRename={(id, name) => void folderOps.renameFolder(id, name)}
                    onDelete={(id) => void handleDeleteFolder(id)}
                  />
                </aside>
              )}
              <div className="flex min-h-0 flex-1 flex-col">
                {(currentFolderId !== null || (isMobile && hasFolders)) && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <FolderBreadcrumb path={currentPath} onNavigate={setFolderId} />
                    {isMobile &&
                      (currentFolderId === null ? childFolders(library, null) : subfolders).map(
                        (folder) => (
                          <Button
                            key={folder.id}
                            variant="secondary"
                            size="sm"
                            onClick={() => setFolderId(folder.id)}
                            aria-label={t('layouts.folders.open', { name: folder.name })}
                            className="h-7 px-2 text-xs"
                          >
                            {folder.name}
                          </Button>
                        )
                      )}
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-auto">
                  <LayoutList
                    entries={shownEntries}
                    searchEntries={library.entries}
                    emptyFolder={currentFolderId !== null}
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
                    onMoveToFolder={hasFolders ? setMovingId : undefined}
                  />
                </div>
              </div>
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

      {movingEntry && (
        <MoveToFolderDialog
          key={movingEntry.id}
          open
          library={library}
          name={movingEntry.name}
          currentFolderId={entryFolderId(library, movingEntry)}
          onClose={() => setMovingId(null)}
          onMove={(destination) => void handleMove(destination)}
        />
      )}

      {/* Share Modal - rendered via dependency injection */}
      {renderShareModal?.({
        isOpen: shareModalLayoutId !== null,
        onClose: () => setShareModalLayoutId(null),
        layoutId: shareModalLayoutId ?? undefined,
      })}
    </div>
  );
}
