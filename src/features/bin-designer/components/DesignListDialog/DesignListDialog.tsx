/**
 * Design list dialog for the Bin Designer.
 *
 * Shows all saved designs with load, rename, duplicate, and delete actions.
 * Supports grid and list view modes with search and sort functionality.
 * Accessible from the header via the design name/selector.
 */

import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { isOk } from '@/core/result';
import {
  listDesigns,
  deleteDesign,
  duplicateDesign,
  createVariant,
  saveDesign,
  updateDesignTags,
} from '@/features/bin-designer/storage/DesignerStorage';
import { useBinDefaults } from '../../hooks';
import { collectTags, toggleTag } from '@/features/bin-designer/utils/tagFilter';
import { normalizeTags, tagsEqual } from '@/features/bin-designer/utils/tags';
import { TagFilterBar } from './TagFilterBar';
import { BulkActionBar } from './BulkActionBar';
import { TagEditDialog } from './TagEditDialog';
import { TagManagerDialog } from '../TagManagerDialog';
import { useDesignSelection } from './useDesignSelection';
import { DesignListHeader } from './DesignListHeader';
import { DesignListSkeleton } from './DesignListSkeleton';
import { DesignListEmptyState } from './DesignListEmptyState';
import { DesignListNoResults } from './DesignListNoResults';
import { DesignListOptionsMenu } from './DesignListOptionsMenu';
import { DesignItemsView } from './DesignItemsView';
import { filterAndSortDesigns, SORT_OPTIONS, SORT_OPTION_KEYS } from './designListSort';
import { groupByLineage, branchesOf } from './designLineage';
import type { SortOption } from './designListSort';
import { removeRegistryEntry } from '../../store/customBinRegistry';
import { useDesignerStore } from '../../store';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import type { ItemKind } from '@/shared/types/item';
import { useDesignerRouting } from '@/shared/hooks/useDesignerRouting';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useToastStore } from '@/core/store/toast';
import { showErrorToast } from '@/shared/hooks/useResultToast';
import { useSettingsStore } from '@/core/store/settings';
import { useResponsive } from '@/shared/hooks';
import { ItemListShell } from '@/shared/components';
import { DesignImportView } from '../DesignImportView';
import { ImportBinDialog, useImportBinDesign } from '../ImportBinDialog';
import type { SavedDesign, BinParams } from '../../types';
import { useThumbnailRegeneration } from '../../hooks/useThumbnailRegeneration';
import { useTranslation } from '@/i18n';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/ConfirmDialog';
import type { ViewMode } from '@/shared/components/ViewModeToggle';
import { downloadDesignAsFile } from '@/features/bin-designer/utils/designJson';
import { navigateToPlaceInLayout } from '@/features/bin-designer/hooks/usePlaceBinInLayout';

interface DesignListDialogProps {
  open: boolean;
  onClose: () => void;
}

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
  const [showTagManager, setShowTagManager] = useState(false);
  // Overflow ("...") menu for new-bin default management.
  const [optionsMenu, setOptionsMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
  }>({ open: false, position: { x: 0, y: 0 } });
  const {
    hasCustomDefault: customDefaultActive,
    setCurrentAsDefault,
    resetToFactory,
  } = useBinDefaults();
  const selection = useDesignSelection();
  const itemRefs = useRef<Map<string, HTMLDivElement | HTMLLIElement>>(new Map());
  const gridRef = useRef<HTMLDivElement>(null);

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
  const workshopEnabled = useFeatureFlag('workshop');
  const currentDesignId = useDesignerStore((s) => s.currentDesignId);
  const { navigateToDesign, syncUrlToDesign } = useDesignerRouting();
  const addToast = useToastStore((s) => s.addToast);

  const handleImportedBinSaved = useCallback(
    (design: SavedDesign) => {
      navigateToDesign(design.id);
      setShowImport(false);
      onClose();
    },
    [navigateToDesign, onClose]
  );
  const binImport = useImportBinDesign(handleImportedBinSaved);

  const handlePlaceInLayout = useCallback(
    (design: SavedDesign) => {
      navigateToPlaceInLayout(design);
      onClose();
    },
    [onClose]
  );

  const handleDownloadJSON = useCallback(
    (design: SavedDesign) => {
      if (!design.params) return;
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
    setShowTagManager(false);
    setOptionsMenu((s) => ({ ...s, open: false }));
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
  const sortedDesigns = useMemo(
    () => filterAndSortDesigns(designs, { activeTags, searchQuery, sortBy, currentDesignId }),
    [designs, activeTags, searchQuery, sortBy, currentDesignId]
  );

  // Which designs are showing their branches. Held here rather than persisted:
  // it is a reading position, and a remembered one goes stale the moment the
  // library changes.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

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
  // Which kind the pending confirm dialog will create; the confirm is the same
  // unsaved-changes gate for a bin and a workshop, so the kind rides state.
  const [pendingNewKind, setPendingNewKind] = useState<ItemKind>('bin');

  const createNewDesign = useCallback(
    (kind: ItemKind) => {
      newDesign(kind === 'bin' ? undefined : kind);
      syncUrlToDesign(null);
      addToast({ message: t('binDesigner.newDesignCreated'), type: 'success', duration: 2000 });
      onClose();
    },
    [newDesign, syncUrlToDesign, addToast, onClose, t]
  );

  const handleNewDesign = useCallback(
    (kind: ItemKind = 'bin') => {
      const state = useDesignerStore.getState();
      if (state.currentDesignId && state.history.past.length > 0) {
        setPendingNewKind(kind);
        setShowNewDesignConfirm(true);
        return;
      }
      createNewDesign(kind);
    },
    [createNewDesign]
  );

  const handleConfirmNewDesign = useCallback(() => {
    createNewDesign(pendingNewKind);
  }, [createNewDesign, pendingNewKind]);

  const handleOpenOptionsMenu = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Anchor the menu to the button's lower-left; Menu.Root clamps to the
    // viewport so it never runs off the right edge of the screen.
    setOptionsMenu({ open: true, position: { x: rect.left, y: rect.bottom + 4 } });
  }, []);

  const closeOptionsMenu = useCallback(() => {
    setOptionsMenu((s) => ({ ...s, open: false }));
  }, []);

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

  // Created with NO overrides: an exact copy that stays in step. The user then
  // claims values in the Variant panel section, which is where the difference
  // between this and Duplicate becomes visible.
  const handleCreateVariant = useCallback(
    async (design: SavedDesign) => {
      const name = `${design.name} (${t('binDesigner.variants.label')})`;
      const result = await createVariant(design.id, name, {});
      if (isOk(result)) {
        setDesigns((prev) => [result.value, ...prev]);
        addToast({
          message: t('binDesigner.variants.created', {
            name: result.value.name,
            parent: design.name,
          }),
          type: 'success',
          duration: 3000,
        });
        // Opened rather than just listed. A variant is created with no claims,
        // so it is identical to its parent until the user claims something, and
        // leaving them in the list to find it makes the next step invisible.
        loadDesign(result.value);
        navigateToDesign(result.value.id);
        onClose();
      } else {
        showErrorToast(result.error);
      }
    },
    [addToast, t, loadDesign, navigateToDesign, onClose]
  );

  const handleDelete = useCallback(
    async (design: SavedDesign) => {
      // Counted BEFORE the delete, while the branches are still in the list.
      const orphaned = branchesOf(designs, String(design.id)).length;
      const result = await deleteDesign(design.id);
      if (isOk(result)) {
        setDesigns((prev) => prev.filter((d) => d.id !== design.id));
        removeRegistryEntry(design.id);
        addToast({
          message: t('binDesigner.toast.designDeleted', { name: design.name }),
          type: 'success',
          duration: 2000,
        });
        // Branches are independent designs, so they survive. Saying so is the
        // difference between "my branches are safe" and "they vanished with the
        // row they were nested under", which is what the indent implies.
        if (orphaned > 0) {
          addToast({
            message: t('binDesigner.designs.deleteWithBranches', { count: orphaned }),
            type: 'info',
            duration: 5000,
          });
        }
      } else {
        addToast({
          message: t('binDesigner.toast.designDeleteFailed'),
          type: 'error',
          duration: 4000,
        });
      }
    },
    [addToast, t, designs]
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
      if (d.params) downloadDesignAsFile(d.name, d.params);
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

  const registerItemRef = useCallback((id: string, el: HTMLDivElement | HTMLLIElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  const itemViewProps = {
    currentDesignId,
    focusedIndex,
    selectionActive: selection.active,
    isSelected: selection.isSelected,
    onLoad: handleLoad,
    onPlaceInLayout: handlePlaceInLayout,
    onDownloadJSON: handleDownloadJSON,
    onRename: (design: SavedDesign, newName: string) => void handleRename(design, newName),
    onEditTags: (design: SavedDesign) => setTagEdit({ mode: 'single', design }),
    onDuplicate: (design: SavedDesign) => void handleDuplicate(design),
    onCreateVariant: (design: SavedDesign) => void handleCreateVariant(design),
    onDelete: (design: SavedDesign) => void handleDelete(design),
    onFocus: setFocusedIndex,
    onToggleSelect: selection.toggle,
    registerItemRef,
  };

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
        <DesignListHeader
          showSelectButton={!showImport && designs.length > 0 && !selection.active}
          optionsMenuOpen={optionsMenu.open}
          customDefaultActive={customDefaultActive}
          onEnterSelect={() => selection.enter()}
          onShowImport={() => setShowImport(true)}
          onNewDesign={handleNewDesign}
          showWorkshopButton={workshopEnabled}
          onOpenOptionsMenu={handleOpenOptionsMenu}
          onClose={onClose}
        />

        {/* Design list or import view */}
        <div className="flex-1 min-h-0 flex flex-col px-5 py-3" aria-busy={loading}>
          {showImport ? (
            <>
              <DesignImportView
                onImport={handleImportDesign}
                onCancel={() => setShowImport(false)}
                onStlFile={binImport.handleFile}
              />
              <ImportBinDialog
                pending={binImport.pending}
                importing={binImport.importing}
                claim={binImport.claim}
                onClaimChange={binImport.setClaim}
                onRotate={binImport.setAxisRotation}
                onSave={() => void binImport.save()}
                onCancel={binImport.cancel}
              />
            </>
          ) : loading ? (
            <DesignListSkeleton />
          ) : designs.length === 0 ? (
            <DesignListEmptyState onNewDesign={handleNewDesign} />
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
                  <DesignItemsView
                    variant="grid"
                    rows={groupByLineage(items, expandedIds)}
                    expandedIds={expandedIds}
                    onToggleExpand={toggleExpanded}
                    {...itemViewProps}
                  />
                </div>
              )}
              renderList={(items) => (
                <ul role="listbox" aria-label={t('binDesigner.savedDesigns')} className="space-y-2">
                  <DesignItemsView
                    variant="list"
                    rows={groupByLineage(items, expandedIds)}
                    expandedIds={expandedIds}
                    onToggleExpand={toggleExpanded}
                    {...itemViewProps}
                  />
                </ul>
              )}
              noResultsState={<DesignListNoResults searchQuery={searchQuery} />}
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
          suggestions={allTags}
          saveLabel={
            tagEdit.mode === 'bulk' ? t('binDesigner.bulk.tagApply') : t('binDesigner.tags.save')
          }
          onSave={(tags) => void handleSaveTags(tags)}
          onClose={() => setTagEdit(null)}
        />
      )}
      <TagManagerDialog
        open={showTagManager}
        tags={allTags}
        onClose={() => setShowTagManager(false)}
      />
      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title={t('binDesigner.bulk.deleteTitle')}
        message={t('binDesigner.bulk.deleteConfirm', { count: selection.count })}
        confirmText={t('binDesigner.bulk.delete')}
        onConfirm={() => void handleBulkDelete()}
        onCancel={() => setShowBulkDeleteConfirm(false)}
      />
      <DesignListOptionsMenu
        open={optionsMenu.open}
        position={optionsMenu.position}
        customDefaultActive={customDefaultActive}
        onClose={closeOptionsMenu}
        onSetDefault={setCurrentAsDefault}
        onOpenTagManager={() => {
          closeOptionsMenu();
          setShowTagManager(true);
        }}
        onResetFactory={resetToFactory}
      />
    </div>
  );
}
