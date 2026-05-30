/**
 * Design list dialog for the Bin Designer.
 *
 * Shows all saved designs with load, rename, duplicate, and delete actions.
 * Supports grid and list view modes with search and sort functionality.
 * Accessible from the header via the design name/selector.
 */

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { isOk } from '@/core/result';
import {
  listDesigns,
  deleteDesign,
  duplicateDesign,
  saveDesign,
  updateDesignTags,
} from '@/features/bin-designer/storage/DesignerStorage';
import { collectTags, filterByTags, toggleTag } from '@/features/bin-designer/utils/tagFilter';
import { normalizeTags, tagsEqual } from '@/features/bin-designer/utils/tags';
import { TagFilterBar } from './TagFilterBar';
import { BulkActionBar } from './BulkActionBar';
import { TagEditDialog } from './TagEditDialog';
import { useDesignSelection } from './useDesignSelection';
import { removeRegistryEntry } from '../../store/customBinRegistry';
import { useDesignerStore } from '../../store';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { ItemListShell } from '@/shared/components';
import { DesignGridItem } from '../DesignGridItem';
import { DesignListItem } from '../DesignListItem';
import { DesignImportView } from '../DesignImportView';
import type { SavedDesign, BinParams } from '../../types';
import { useThumbnailRegeneration } from '../../hooks/useThumbnailRegeneration';
import { useTranslation } from '@/i18n';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog';
import type { ViewMode } from '@/shared/components/ViewModeToggle';
import { downloadDesignAsFile } from '@/features/bin-designer/utils/designJson';

interface DesignListDialogProps {
  open: boolean;
  onClose: () => void;
}

type SortOption = 'recent' | 'name' | 'size';

/** Sort option values - labels are generated dynamically via i18n */
const SORT_OPTIONS: readonly SortOption[] = ['recent', 'name', 'size'] as const;

/** i18n key mapping for sort options */
const SORT_OPTION_KEYS: Record<SortOption, string> = {
  recent: 'binDesigner.sortRecent',
  name: 'binDesigner.sortName',
  size: 'binDesigner.sortSize',
};

/**
 * Renders a modal dialog listing saved designs and providing load, rename, duplicate, delete, and create actions.
 */
export function DesignListDialog({ open, onClose }: DesignListDialogProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [tagEdit, setTagEdit] = useState<{ mode: 'single' | 'bulk'; design?: SavedDesign } | null>(
    null
  );
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const selection = useDesignSelection();
  const itemRefs = useRef<Map<string, HTMLDivElement | HTMLLIElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);

  // View mode from settings
  const viewMode = useSettingsStore((s) => s.settings.designListViewMode);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const setViewMode = useCallback(
    (mode: ViewMode) => updateSetting('designListViewMode', mode),
    [updateSetting]
  );

  // Force list view on mobile
  const effectiveViewMode = isMobile ? 'list' : viewMode;

  const dialogRef = useFocusTrap({
    active: open,
    onEscape: onClose,
  });

  const loadDesign = useDesignerStore((s) => s.loadDesign);
  const newDesign = useDesignerStore((s) => s.newDesign);
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const { navigateToDesign, syncUrlToDesign } = useDesignerRouting();
  const addToast = useToastStore((s) => s.addToast);

  const handleDownloadJSON = useCallback(
    (design: SavedDesign) => {
      downloadDesignAsFile(design.name, design.params);
      addToast({ message: t('binDesigner.downloadDesignJson'), type: 'success', duration: 2000 });
    },
    [addToast, t]
  );

  // Reset state when dialog opens (React render-time state adjustment)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setSearchQuery('');
    setFocusedIndex(0);
    setLoading(true);
    setShowImport(false);
    setActiveTags([]);
    setTagEdit(null);
    setShowBulkDeleteConfirm(false);
    selection.exit();
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  // Fetch fresh design list when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listDesigns().then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setDesigns(result.value);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Lazily regenerate thumbnails for designs that are missing or outdated
  const handleThumbnailUpdated = useCallback((id: string, thumbnail: string) => {
    setDesigns((prev) => prev.map((d) => (d.id === id ? { ...d, thumbnail } : d)));
  }, []);
  useThumbnailRegeneration(designs, handleThumbnailUpdated);

  const allTags = useMemo(() => collectTags(designs), [designs]);

  // Drop active filters whose tag no longer exists (e.g. after deleting the last
  // design carrying it). Otherwise the list can get stuck showing nothing while
  // the filter bar — which hides when no tags exist — offers no way to clear it.
  const prunedActiveTags = activeTags.filter((tag) =>
    allTags.some((t) => t.toLowerCase() === tag.toLowerCase())
  );
  if (prunedActiveTags.length !== activeTags.length) {
    setActiveTags(prunedActiveTags);
  }

  // Drop selected IDs for designs that no longer exist (e.g. a single delete via
  // the row menu while in selection mode) so the count and bulk actions stay honest.
  if (selection.active && selection.count > 0) {
    const presentIds = designs.map((d) => d.id);
    const present = new Set<string>(presentIds);
    if ([...selection.selectedIds].some((id) => !present.has(id))) {
      selection.prune(presentIds);
    }
  }

  // Filter and sort designs
  const sortedDesigns = useMemo(() => {
    let filtered = filterByTags(designs, activeTags);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(query));
    }

    return [...filtered].sort((a, b) => {
      // Active design always first
      if (a.id === currentDesignId) return -1;
      if (b.id === currentDesignId) return 1;

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size': {
          const aSize = a.params.width * a.params.depth * a.params.height;
          const bSize = b.params.width * b.params.depth * b.params.height;
          return bSize - aSize;
        }
        case 'recent':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
  }, [designs, activeTags, searchQuery, sortBy, currentDesignId]);

  // Get localized sort options
  const localizedSortOptions = useMemo(
    () =>
      SORT_OPTIONS.map((value) => ({
        value,
        label: t(SORT_OPTION_KEYS[value]),
      })),
    [t]
  );

  const handleLoad = useCallback(
    (design: SavedDesign) => {
      // If clicking the active design, just close the modal
      if (design.id === currentDesignId) {
        onClose();
        return;
      }
      loadDesign(design);
      navigateToDesign(design.id);
      addToast({ message: `Loaded "${design.name}"`, type: 'success', duration: 2000 });
      onClose();
    },
    [loadDesign, navigateToDesign, addToast, onClose, currentDesignId]
  );

  const [showNewDesignConfirm, setShowNewDesignConfirm] = useState(false);

  const handleNewDesign = useCallback(() => {
    const state = useDesignerStore.getState();
    if (state.currentDesignId && state.history.past.length > 0) {
      setShowNewDesignConfirm(true);
      return;
    }
    newDesign();
    syncUrlToDesign(null);
    addToast({ message: t('binDesigner.newDesignCreated'), type: 'success', duration: 2000 });
    onClose();
  }, [newDesign, syncUrlToDesign, addToast, onClose, t]);

  const handleConfirmNewDesign = useCallback(() => {
    newDesign();
    syncUrlToDesign(null);
    addToast({ message: t('binDesigner.newDesignCreated'), type: 'success', duration: 2000 });
    onClose();
  }, [newDesign, syncUrlToDesign, addToast, onClose, t]);

  const handleRename = useCallback(
    async (design: SavedDesign, newName: string) => {
      await saveDesign({ ...design, name: newName });
      setDesigns((prev) => prev.map((d) => (d.id === design.id ? { ...d, name: newName } : d)));
      if (design.id === currentDesignId) {
        useDesignerStore.getState().setDesignName(newName);
      }
    },
    [currentDesignId]
  );

  const handleDuplicate = useCallback(
    async (design: SavedDesign) => {
      const result = await duplicateDesign(design.id);
      if (isOk(result)) {
        setDesigns((prev) => [result.value, ...prev]);
        addToast({
          message: t('binDesigner.toast.designDuplicated', { name: design.name }),
          type: 'success',
          duration: 2000,
        });
      } else {
        addToast({
          message: t('binDesigner.toast.designDuplicateFailed'),
          type: 'error',
          duration: 4000,
        });
      }
    },
    [addToast, t]
  );

  const handleDelete = useCallback(
    async (design: SavedDesign) => {
      const result = await deleteDesign(design.id);
      if (isOk(result)) {
        setDesigns((prev) => prev.filter((d) => d.id !== design.id));
        removeRegistryEntry(design.id);
        addToast({
          message: t('binDesigner.toast.designDeleted', { name: design.name }),
          type: 'success',
          duration: 2000,
        });
      } else {
        addToast({
          message: t('binDesigner.toast.designDeleteFailed'),
          type: 'error',
          duration: 4000,
        });
      }
    },
    [addToast, t]
  );

  const handleSaveTags = useCallback(
    async (rawTags: string[]) => {
      const edit = tagEdit;
      if (!edit) return;

      if (edit.mode === 'single' && edit.design) {
        const next = normalizeTags(rawTags);
        // Skip the write (and its updatedAt bump + sync) when nothing changed.
        if (tagsEqual(next, edit.design.tags ?? [])) {
          setTagEdit(null);
          return;
        }
        const result = await updateDesignTags(edit.design.id, next);
        if (isOk(result)) {
          const saved = result.value;
          setDesigns((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
          if (saved.id === currentDesignId) {
            useDesignerStore.getState().setDesignName(saved.name);
          }
        }
      } else if (edit.mode === 'bulk') {
        const ids = selection.selectedIds;
        const targets = designs.filter((d) => ids.has(d.id));
        const updated = new Map<string, SavedDesign>();
        for (const d of targets) {
          // Bulk = add the entered tags to each design's existing set (union).
          const nextTags = normalizeTags([...(d.tags ?? []), ...rawTags]);
          // Only write designs whose tag set actually changes — a no-op bulk
          // tag shouldn't bump updatedAt or trigger a sync for every design.
          if (tagsEqual(nextTags, d.tags ?? [])) continue;
          const result = await updateDesignTags(d.id, nextTags);
          if (isOk(result)) updated.set(result.value.id, result.value);
        }
        if (updated.size > 0) {
          setDesigns((prev) => prev.map((d) => updated.get(d.id) ?? d));
          addToast({
            message: t('binDesigner.bulk.toastTagged', { count: updated.size }),
            type: 'success',
            duration: 2000,
          });
        }
        selection.exit();
      }
      setTagEdit(null);
    },
    [tagEdit, selection, designs, currentDesignId, addToast, t]
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selection.selectedIds];
    // Track only the IDs that actually deleted, so a partial storage failure
    // doesn't drop a still-present design from the UI.
    const deletedIds: string[] = [];
    for (const id of ids) {
      const design = designs.find((d) => d.id === id);
      if (!design) continue;
      const result = await deleteDesign(design.id);
      if (isOk(result)) {
        removeRegistryEntry(design.id);
        deletedIds.push(id);
      }
    }
    if (deletedIds.length > 0) {
      const removed = new Set(deletedIds);
      setDesigns((prev) => prev.filter((d) => !removed.has(d.id)));
      addToast({
        message: t('binDesigner.bulk.toastDeleted', { count: deletedIds.length }),
        type: 'success',
        duration: 2000,
      });
    }
    setShowBulkDeleteConfirm(false);
    selection.exit();
  }, [selection, designs, addToast, t]);

  const handleBulkExport = useCallback(() => {
    const ids = selection.selectedIds;
    const targets = designs.filter((d) => ids.has(d.id));
    for (const d of targets) {
      downloadDesignAsFile(d.name, d.params);
    }
    if (targets.length > 0) {
      addToast({
        message: t('binDesigner.bulk.toastExported', { count: targets.length }),
        type: 'success',
        duration: 2000,
      });
    }
    selection.exit();
  }, [selection, designs, addToast, t]);

  const getGridColumns = useCallback(() => {
    if (effectiveViewMode === 'list' || !gridRef.current) return 1;
    const style = window.getComputedStyle(gridRef.current);
    const columns = style.gridTemplateColumns.split(' ').length;
    return Math.max(1, columns);
  }, [effectiveViewMode]);

  const handleKeyboardNav = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = sortedDesigns.length;
      if (totalItems === 0) return;

      const cols = getGridColumns();
      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newIndex =
            effectiveViewMode === 'grid'
              ? Math.min(focusedIndex + cols, totalItems - 1)
              : Math.min(focusedIndex + 1, totalItems - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex =
            effectiveViewMode === 'grid'
              ? Math.max(focusedIndex - cols, 0)
              : Math.max(focusedIndex - 1, 0);
          break;
        case 'ArrowRight':
          if (effectiveViewMode === 'grid') {
            e.preventDefault();
            newIndex = Math.min(focusedIndex + 1, totalItems - 1);
          }
          break;
        case 'ArrowLeft':
          if (effectiveViewMode === 'grid') {
            e.preventDefault();
            newIndex = Math.max(focusedIndex - 1, 0);
          }
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = totalItems - 1;
          break;
        default:
          return;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        const design = sortedDesigns[newIndex];
        itemRefs.current.get(design.id)?.focus();
      }
    },
    [focusedIndex, sortedDesigns, effectiveViewMode, getGridColumns]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setFocusedIndex(0);
  }, []);

  const handleImportDesign = useCallback(
    async (design: { name: string; params: BinParams }) => {
      const result = await saveDesign({
        name: design.name,
        params: design.params,
        thumbnail: null,
        exportFileNameConfig: null,
      });
      if (isOk(result)) {
        loadDesign(result.value);
        navigateToDesign(result.value.id);
        addToast({
          message: t('binDesigner.importDesignSuccess', { name: design.name }),
          type: 'success',
          duration: 3000,
        });
        onClose();
      } else {
        addToast({
          message: t('binDesigner.invalidDesignFile'),
          type: 'error',
          duration: 4000,
        });
      }
      setShowImport(false);
    },
    [loadDesign, navigateToDesign, addToast, onClose, t]
  );

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="mx-4 max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl border border-stroke-subtle bg-surface-secondary shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={t('binDesigner.savedDesigns')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stroke-subtle px-5 py-4">
          <h2 className="text-lg font-semibold text-content">{t('binDesigner.savedDesigns')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {!showImport && designs.length > 0 && !selection.active && (
              <button
                onClick={() => selection.enter()}
                className="rounded-md bg-surface-secondary px-3 py-1.5 text-sm font-medium text-content border border-stroke transition-colors hover:bg-surface-hover"
              >
                {t('binDesigner.select')}
              </button>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="rounded-md bg-surface-secondary px-3 py-1.5 text-sm font-medium text-content border border-stroke transition-colors hover:bg-surface-hover"
            >
              {t('common.import')}
            </button>
            <button
              onClick={handleNewDesign}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              {t('binDesigner.newDesign')}
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
              aria-label={t('common.close')}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Design list or import view */}
        <div className="flex-1 min-h-0 flex flex-col px-5 py-3" aria-busy={loading}>
          {showImport ? (
            <DesignImportView onImport={handleImportDesign} onCancel={() => setShowImport(false)} />
          ) : loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse motion-reduce:animate-none items-center gap-3 rounded-lg border border-stroke-subtle px-3 py-2.5"
                >
                  <div className="h-10 w-10 flex-shrink-0 rounded-md bg-surface-elevated" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-24 rounded bg-surface-elevated" />
                    <div className="h-3 w-16 rounded bg-surface-elevated" />
                  </div>
                </div>
              ))}
            </div>
          ) : designs.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-elevated">
                <svg
                  className="h-6 w-6 text-content-tertiary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-content-secondary">
                {t('binDesigner.noSavedDesignsYet')}
              </p>
              <p className="mt-1 text-xs text-content-disabled">
                {t('binDesigner.changesAreSavedAutomaticallyAsYouDe')}
              </p>
              <button
                onClick={handleNewDesign}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t('binDesigner.startANewDesign')}
              </button>
            </div>
          ) : (
            <ItemListShell
              items={sortedDesigns}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              searchFilter={(design, query) => design.name.toLowerCase().includes(query)}
              searchThreshold={6}
              searchPlaceholder={t('binDesigner.searchDesigns')}
              searchAriaLabel={t('binDesigner.searchDesignsAriaLabel')}
              clearSearchAriaLabel={t('binDesigner.clearSearch')}
              sortOptions={localizedSortOptions}
              sortValue={sortBy}
              onSortChange={(value) => setSortBy(value as SortOption)}
              sortAriaLabel={t('layouts.sortBy')}
              viewMode={effectiveViewMode}
              onViewModeChange={setViewMode}
              showViewToggle={!isMobile}
              viewModeLabels={{
                ariaLabel: t('layouts.viewMode'),
                listLabel: t('binDesigner.listView'),
                gridLabel: t('binDesigner.gridView'),
              }}
              onKeyboardNav={handleKeyboardNav}
              headerContent={
                selection.active ? (
                  <BulkActionBar
                    count={selection.count}
                    onSelectAll={() => selection.selectAll(sortedDesigns.map((d) => d.id))}
                    onTag={() => setTagEdit({ mode: 'bulk' })}
                    onExport={handleBulkExport}
                    onDelete={() => setShowBulkDeleteConfirm(true)}
                    onCancel={() => selection.exit()}
                  />
                ) : (
                  <TagFilterBar
                    allTags={allTags}
                    activeTags={activeTags}
                    onToggle={(tag) => setActiveTags((prev) => toggleTag(prev, tag))}
                    onClear={() => setActiveTags([])}
                  />
                )
              }
              renderGrid={(items) => (
                <div
                  ref={gridRef}
                  role="listbox"
                  aria-label={t('binDesigner.savedDesigns')}
                  className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 content-start"
                >
                  {items.map((design, index) => (
                    <DesignGridItem
                      key={design.id}
                      design={design}
                      isActive={design.id === currentDesignId}
                      isFocused={index === focusedIndex}
                      onSelect={() => handleLoad(design)}
                      onDownloadJSON={() => handleDownloadJSON(design)}
                      onRename={(newName) => void handleRename(design, newName)}
                      onEditTags={() => setTagEdit({ mode: 'single', design })}
                      onDuplicate={() => void handleDuplicate(design)}
                      onDelete={() => void handleDelete(design)}
                      onFocus={() => setFocusedIndex(index)}
                      selectionActive={selection.active}
                      isSelected={selection.isSelected(design.id)}
                      onToggleSelect={() => selection.toggle(design.id)}
                      itemRef={(el) => {
                        if (el) itemRefs.current.set(design.id, el);
                        else itemRefs.current.delete(design.id);
                      }}
                    />
                  ))}
                </div>
              )}
              renderList={(items) => (
                <ul role="listbox" aria-label={t('binDesigner.savedDesigns')} className="space-y-2">
                  {items.map((design, index) => (
                    <DesignListItem
                      key={design.id}
                      design={design}
                      isActive={design.id === currentDesignId}
                      isFocused={index === focusedIndex}
                      onSelect={() => handleLoad(design)}
                      onDownloadJSON={() => handleDownloadJSON(design)}
                      onRename={(newName) => void handleRename(design, newName)}
                      onEditTags={() => setTagEdit({ mode: 'single', design })}
                      onDuplicate={() => void handleDuplicate(design)}
                      onDelete={() => void handleDelete(design)}
                      onFocus={() => setFocusedIndex(index)}
                      selectionActive={selection.active}
                      isSelected={selection.isSelected(design.id)}
                      onToggleSelect={() => selection.toggle(design.id)}
                      itemRef={(el) => {
                        if (el) itemRefs.current.set(design.id, el);
                        else itemRefs.current.delete(design.id);
                      }}
                    />
                  ))}
                </ul>
              )}
              noResultsState={
                <div className="text-center py-8 text-content-tertiary">
                  <svg
                    className="w-10 h-10 mx-auto mb-3 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p>{t('binDesigner.noDesignsMatch', { query: searchQuery })}</p>
                </div>
              }
              footer={t('binDesigner.designCount', { count: designs.length })}
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={showNewDesignConfirm}
        title={t('binDesigner.newDesign')}
        message={t('binDesigner.newDesignConfirm')}
        confirmText={t('binDesigner.newDesign')}
        onConfirm={handleConfirmNewDesign}
        onCancel={() => setShowNewDesignConfirm(false)}
      />
      {tagEdit !== null && (
        <TagEditDialog
          open
          title={
            tagEdit.mode === 'bulk'
              ? t('binDesigner.bulk.tagTitle', { count: selection.count })
              : t('binDesigner.tags.editForDesign', { name: tagEdit.design?.name ?? '' })
          }
          initialTags={tagEdit.mode === 'single' ? (tagEdit.design?.tags ?? []) : []}
          saveLabel={
            tagEdit.mode === 'bulk' ? t('binDesigner.bulk.tagApply') : t('binDesigner.tags.save')
          }
          onSave={(tags) => void handleSaveTags(tags)}
          onClose={() => setTagEdit(null)}
        />
      )}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title={t('binDesigner.bulk.deleteTitle')}
        message={t('binDesigner.bulk.deleteConfirm', { count: selection.count })}
        confirmText={t('binDesigner.bulk.delete')}
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
    </div>
  );
}
