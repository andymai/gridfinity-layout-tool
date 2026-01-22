import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  useLayoutStore,
  useLibraryStore,
  useHistoryStore,
  useUIStore,
  useToastStore,
  useSettingsStore,
} from '@/core/store';
import type { Layout } from '@/core/types';
import { isErr, isOk } from '@/core/result';
import {
  saveLayoutWithMetadata,
  createLayoutEntry,
  deleteLayoutWithEntry,
  duplicateLayoutEntry as duplicateLayoutStorage,
  switchActiveLayout,
  renameLayoutEntry,
} from '@/core/storage';
import { setLayoutURL } from '@/utils/url';
import { createLayoutWithSettings } from '@/core/constants';
import { trackLayoutAction } from '@/utils/analytics';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type { Result, Unit, LayoutError, StorageError, UnknownError } from '@/core/result';
import { ok, err, OK, layoutLastEntity, layoutInvalidOperation, fromUnknown } from '@/core/result';

/**
 * Orchestration hook for layout switching and management.
 * Coordinates mutations across multiple stores without cross-store dependencies.
 */
export function useLayoutSwitcher() {
  const pendingSaveRef = useRef<number | null>(null);

  // Layout store
  // Note: layout is accessed via getState() in callbacks to avoid stale closures
  const { activeLayoutId, importLayout } = useLayoutStore(
    useShallow((state) => ({
      activeLayoutId: state.activeLayoutId,
      importLayout: state.importLayout,
    }))
  );

  // Library store
  const { library, getEntry, setLibrary } = useLibraryStore(
    useShallow((state) => ({
      library: state.library,
      getEntry: state.getEntry,
      setLibrary: state.setLibrary,
    }))
  );

  // History store
  const clearHistory = useHistoryStore((state) => state.clear);

  // UI store
  const { clearSelection, setActiveLayer, setActiveCategory, clearSharedLayoutPreview } =
    useUIStore(
      useShallow((state) => ({
        clearSelection: state.clearSelection,
        setActiveLayer: state.setActiveLayer,
        setActiveCategory: state.setActiveCategory,
        clearSharedLayoutPreview: state.clearSharedLayoutPreview,
      }))
    );

  // Toast store
  const addToast = useToastStore((state) => state.addToast);

  /**
   * Save the current layout to storage and update library entry.
   * Uses atomic save for data consistency.
   * Gets fresh state to avoid stale closure issues.
   */
  const saveCurrentLayout = useCallback(async () => {
    // Get fresh state to avoid stale closures
    const currentActiveId = useLayoutStore.getState().activeLayoutId;
    const currentLayout = useLayoutStore.getState().layout;
    const currentLibrary = useLibraryStore.getState().library;

    if (!currentActiveId || currentActiveId === '__shared_preview__') return;

    const result = await saveLayoutWithMetadata(currentActiveId, currentLayout, currentLibrary);
    if (isErr(result)) {
      console.error('Failed to save current layout:', result.error);
      return;
    }

    setLibrary(result.value.library);
  }, [setLibrary]);

  /**
   * Switch to a different layout.
   */
  const switchLayout = useCallback(
    async (targetId: string): Promise<Result<Unit, LayoutError | StorageError | UnknownError>> => {
      // 1. Validate target exists
      const targetEntry = getEntry(targetId);
      if (!targetEntry) {
        return err(layoutInvalidOperation('switchLayout', 'Layout not found'));
      }

      // 2. Cancel any pending auto-save (prevent race)
      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }

      try {
        // 3. Clear any shared layout preview state
        clearSharedLayoutPreview();

        // 4. Atomic switch: save current, load target, update library
        // Note: Get ALL fresh state to avoid stale closure issues
        // (e.g., when called right after importLayoutFromJSON, deleteLayout, or auto-save)
        const currentLibrary = useLibraryStore.getState().library;
        const currentActiveId = useLayoutStore.getState().activeLayoutId;
        const currentLayout = useLayoutStore.getState().layout;
        const result = await switchActiveLayout(
          currentActiveId || '__shared_preview__',
          currentLayout,
          targetId,
          currentLibrary
        );

        if (isErr(result)) {
          addToast('Failed to switch layout', 'error');
          return result;
        }

        // 5. Update stores with result
        setLibrary(result.value.library);
        importLayout(result.value.targetLayout, targetId, 'init');

        // 6. Reset UI state
        clearSelection();
        setActiveLayer(result.value.targetLayout.layers[0]?.id ?? '');
        setActiveCategory(result.value.targetLayout.categories[0]?.id ?? '');

        // 7. Clear undo history
        clearHistory();

        // 8. Update URL with slug
        setLayoutURL(targetId, result.value.targetLayout.name, true);

        // 9. Track analytics
        trackLayoutAction('switched');

        // 10. Track ML session summary for the layout we're leaving
        // Captures session workflow metrics (bins placed, edit ratio, etc.)
        mlTracking.trackSession('layout_switch');

        // 11. Track ML snapshot for the layout we're leaving (if substantial)
        // The old layout was just saved in step 4, so this captures the "finished" state
        mlTracking.trackSnapshot('layout_switch');

        return OK;
      } catch (error) {
        addToast('Failed to switch layout', 'error');
        return err(fromUnknown(error));
      }
    },
    [
      // Note: activeLayoutId, layout, library removed - we use fresh state via getState()
      getEntry,
      setLibrary,
      importLayout,
      clearSelection,
      setActiveLayer,
      setActiveCategory,
      clearHistory,
      clearSharedLayoutPreview,
      addToast,
    ]
  );

  // Settings store
  const settings = useSettingsStore((state) => state.settings);

  /**
   * Create a new layout and switch to it.
   */
  const createNewLayout = useCallback(
    async (name?: string): Promise<Result<string, StorageError | UnknownError>> => {
      // Save current layout first
      await saveCurrentLayout();

      // Create new layout with user's default settings
      const newLayout = createLayoutWithSettings(settings);
      newLayout.name = name || 'Untitled layout';

      try {
        // Get fresh library state after saveCurrentLayout (may have updated it)
        const currentLibrary = useLibraryStore.getState().library;

        // Atomic create: save layout, create entry, save library
        const result = await createLayoutEntry(newLayout, currentLibrary, {
          name: newLayout.name,
          author: currentLibrary.settings.authorName,
        });

        if (isErr(result)) {
          addToast('Failed to create layout', 'error');
          return result;
        }

        // Update stores
        setLibrary(result.value.library);
        importLayout(result.value.layout, result.value.layoutId, 'init');

        // Reset UI state
        clearSelection();
        setActiveLayer(result.value.layout.layers[0]?.id ?? '');
        setActiveCategory(result.value.layout.categories[0]?.id ?? '');

        clearHistory();

        setLayoutURL(result.value.layoutId, result.value.layout.name, true);

        trackLayoutAction('created');

        addToast('New layout created', 'success');
        return ok(result.value.layoutId);
      } catch (error) {
        addToast('Failed to create layout', 'error');
        return err(fromUnknown(error));
      }
    },
    [
      saveCurrentLayout,
      // Note: library removed - we use fresh state via getState()
      setLibrary,
      importLayout,
      clearSelection,
      setActiveLayer,
      setActiveCategory,
      clearHistory,
      addToast,
      settings,
    ]
  );

  /**
   * Delete a layout.
   */
  const deleteLayout = useCallback(
    async (id: string): Promise<Result<Unit, LayoutError | StorageError | UnknownError>> => {
      // Get fresh library state to avoid stale closure issues
      const currentLibrary = useLibraryStore.getState().library;

      // Can't delete last layout
      if (currentLibrary.entries.length <= 1) {
        return err(layoutLastEntity('layout'));
      }

      try {
        // Atomic delete: remove layout, update library
        const result = await deleteLayoutWithEntry(id, currentLibrary);

        if (isErr(result)) {
          addToast('Failed to delete layout', 'error');
          return result;
        }

        // Update library store
        setLibrary(result.value.library);

        // If deleted the active layout, switch to the new active
        if (result.value.newActiveId) {
          const switchResult = await switchLayout(result.value.newActiveId);
          if (isErr(switchResult)) {
            return switchResult;
          }
        }

        trackLayoutAction('deleted');
        // Track quality signal (deleted = negative signal for ML)
        mlTracking.trackQuality('deleted');

        addToast('Layout deleted', 'success');
        return OK;
      } catch (error) {
        addToast('Failed to delete layout', 'error');
        return err(fromUnknown(error));
      }
    },
    [setLibrary, switchLayout, addToast]
  );

  /**
   * Duplicate a layout.
   */
  const duplicateLayout = useCallback(
    async (id: string): Promise<Result<string, LayoutError | StorageError | UnknownError>> => {
      const sourceEntry = getEntry(id);
      if (!sourceEntry) {
        return err(layoutInvalidOperation('duplicateLayout', 'Layout not found'));
      }

      try {
        // Get fresh library state to avoid stale closure
        const currentLibrary = useLibraryStore.getState().library;

        // Atomic duplicate: load source, create copy, save both layout and library
        const result = await duplicateLayoutStorage(id, currentLibrary);

        if (isErr(result)) {
          addToast('Failed to duplicate layout', 'error');
          return result;
        }

        // Update library store
        setLibrary(result.value.library);

        trackLayoutAction('duplicated');
        // Track quality signal (duplicated = positive signal for ML)
        mlTracking.trackQuality('duplicated');

        addToast('Layout duplicated', 'success');
        return ok(result.value.layoutId);
      } catch (error) {
        addToast('Failed to duplicate layout', 'error');
        return err(fromUnknown(error));
      }
    },
    [getEntry, setLibrary, addToast]
  );

  /**
   * Rename a layout.
   */
  const renameLayout = useCallback(
    (id: string, newName: string): void => {
      // Get fresh library state to avoid stale closure
      const currentLibrary = useLibraryStore.getState().library;
      const currentActiveId = useLayoutStore.getState().activeLayoutId;

      // Atomic rename: update library entry and save
      const result = renameLayoutEntry(id, newName, currentLibrary);

      if (isOk(result)) {
        setLibrary(result.value);

        // Also update the layout store's name if this is the active layout
        if (id === currentActiveId) {
          useLayoutStore.getState().setName(newName);
        }

        trackLayoutAction('renamed');
      }
    },
    [setLibrary]
  );

  /**
   * Import a layout from JSON and add to library.
   */
  const importLayoutFromJSON = useCallback(
    async (
      importedLayout: Layout,
      forkedFrom?: { name: string; author?: string }
    ): Promise<Result<string, StorageError | UnknownError>> => {
      try {
        // Get fresh library state to avoid stale closure
        const currentLibrary = useLibraryStore.getState().library;

        // Atomic create: save layout, create entry, save library
        const result = await createLayoutEntry(importedLayout, currentLibrary, {
          name: importedLayout.name,
          author: currentLibrary.settings.authorName,
          forkedFrom,
        });

        if (isErr(result)) {
          addToast('Failed to import layout', 'error');
          return result;
        }

        // Update library store
        setLibrary(result.value.library);

        trackLayoutAction('imported', forkedFrom ? 'url' : 'json');

        addToast(`Imported "${importedLayout.name}"`, 'success');
        return ok(result.value.layoutId);
      } catch (error) {
        addToast('Failed to import layout', 'error');
        return err(fromUnknown(error));
      }
    },
    [setLibrary, addToast]
  );

  return {
    // State
    activeLayoutId,
    library,

    // Actions (all return Result<T, E>)
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
    saveCurrentLayout,
    importLayoutFromJSON,

    // Ref for auto-save coordination
    pendingSaveRef,
  };
}
