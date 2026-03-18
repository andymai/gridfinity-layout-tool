import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore, useToastStore, useSettingsStore } from '@/core/store';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import type { Layout, LayoutId } from '@/core/types';
import { layoutId } from '@/core/types';
import { useLayoutActivation } from '@/hooks/useLayoutActivation';
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
import { createLayoutWithSettings, SHARED_PREVIEW_ID, isRealLayoutId } from '@/core/constants';
import { trackLayoutAction } from '@/shared/analytics/posthog';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import type {
  Result,
  Unit,
  LayoutError,
  StorageError,
  UnknownError,
  LayoutLibraryLimitError,
} from '@/core/result';
import { ok, err, OK, layoutLastEntity, layoutInvalidOperation, fromUnknown } from '@/core/result';
import { useTranslation } from '@/i18n';
import { useMutations } from '@/shared/contexts/MutationsContext';

/**
 * Orchestration hook for layout switching and management.
 * Coordinates mutations across multiple stores without cross-store dependencies.
 */
export function useLayoutSwitcher() {
  const t = useTranslation();
  const pendingSaveRef = useRef<number | null>(null);
  const mutations = useMutations();

  // Layout activation hook (importLayout + UI reset + history clear)
  const { activateLayout } = useLayoutActivation();

  // Layout store (activeLayoutId for return value; getState() used in callbacks)
  const activeLayoutId = useLayoutStore((state) => state.activeLayoutId);

  const { library, getEntry, setLibrary } = useLibraryStore(
    useShallow((state) => ({
      library: state.library,
      getEntry: state.getEntry,
      setLibrary: state.setLibrary,
    }))
  );

  const clearSharedLayoutPreview = useSharedPreviewStore((state) => state.clearSharedLayoutPreview);

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

    if (!isRealLayoutId(currentActiveId)) return;

    const result = await saveLayoutWithMetadata(currentActiveId, currentLayout, currentLibrary);
    if (isErr(result)) {
      addToast(t('toast.layoutSaveFailed'), 'error');
      return;
    }

    setLibrary(result.value.library);
  }, [setLibrary, addToast, t]);

  /**
   * Switch to a different layout.
   */
  const switchLayout = useCallback(
    async (
      targetId: LayoutId
    ): Promise<Result<Unit, LayoutError | StorageError | UnknownError>> => {
      const targetEntry = getEntry(targetId);
      if (!targetEntry) {
        return err(layoutInvalidOperation('switchLayout', 'Layout not found'));
      }

      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }

      try {
        clearSharedLayoutPreview();

        // Note: Get ALL fresh state to avoid stale closure issues
        // (e.g., when called right after importLayoutFromJSON, deleteLayout, or auto-save)
        const currentLibrary = useLibraryStore.getState().library;
        const currentActiveId = useLayoutStore.getState().activeLayoutId;
        const currentLayout = useLayoutStore.getState().layout;
        const result = await switchActiveLayout(
          currentActiveId || SHARED_PREVIEW_ID,
          currentLayout,
          targetId,
          currentLibrary
        );

        if (isErr(result)) {
          addToast(t('toast.layoutSwitchFailed'), 'error');
          return result;
        }

        setLibrary(result.value.library);
        activateLayout(result.value.targetLayout, targetId);

        setLayoutURL(targetId, result.value.targetLayout.name, true);

        trackLayoutAction('switched');

        // Captures session workflow metrics (bins placed, edit ratio, etc.)
        mlTracking.trackSession('layout_switch');

        // The old layout was just saved in step 4, so this captures the "finished" state
        mlTracking.trackSnapshot('layout_switch');

        return OK;
      } catch (error) {
        addToast(t('toast.layoutSwitchFailed'), 'error');
        return err(fromUnknown(error));
      }
    },
    [
      // Note: activeLayoutId, layout, library removed - we use fresh state via getState()
      getEntry,
      setLibrary,
      activateLayout,
      clearSharedLayoutPreview,
      addToast,
      t,
    ]
  );

  const settings = useSettingsStore((state) => state.settings);

  /**
   * Create a new layout and switch to it.
   */
  const createNewLayout = useCallback(
    async (
      name?: string
    ): Promise<Result<string, StorageError | UnknownError | LayoutLibraryLimitError>> => {
      await saveCurrentLayout();

      // Create new layout with user's default settings
      const newLayout = createLayoutWithSettings(settings);
      newLayout.name = name || 'Untitled layout';

      try {
        // Get fresh library state after saveCurrentLayout (may have updated it)
        const currentLibrary = useLibraryStore.getState().library;

        const result = await createLayoutEntry(newLayout, currentLibrary, {
          name: newLayout.name,
          author: currentLibrary.settings.authorName,
        });

        if (isErr(result)) {
          addToast(t('toast.layoutCreateFailed'), 'error');
          return result;
        }

        setLibrary(result.value.library);
        const newLayoutId = layoutId(result.value.layoutId);
        activateLayout(result.value.layout, newLayoutId);

        setLayoutURL(newLayoutId, result.value.layout.name, true);

        trackLayoutAction('created');

        addToast(t('toast.layoutCreated'), 'success');
        return ok(newLayoutId);
      } catch (error) {
        addToast(t('toast.layoutCreateFailed'), 'error');
        return err(fromUnknown(error));
      }
    },
    [
      saveCurrentLayout,
      // Note: library removed - we use fresh state via getState()
      setLibrary,
      activateLayout,
      addToast,
      settings,
      t,
    ]
  );

  /**
   * Delete a layout.
   */
  const deleteLayout = useCallback(
    async (id: LayoutId): Promise<Result<Unit, LayoutError | StorageError | UnknownError>> => {
      // Get fresh library state to avoid stale closure issues
      const currentLibrary = useLibraryStore.getState().library;

      if (currentLibrary.entries.length <= 1) {
        return err(layoutLastEntity('layout'));
      }

      try {
        const result = await deleteLayoutWithEntry(id, currentLibrary);

        if (isErr(result)) {
          addToast(t('toast.layoutDeleteFailed'), 'error');
          return result;
        }

        setLibrary(result.value.library);

        if (result.value.newActiveId) {
          const switchResult = await switchLayout(layoutId(result.value.newActiveId));
          if (isErr(switchResult)) {
            return switchResult;
          }
        }

        trackLayoutAction('deleted');
        // Track quality signal (deleted = negative signal for ML)
        mlTracking.trackQuality('deleted');

        addToast(t('toast.layoutDeleted'), 'success');
        return OK;
      } catch (error) {
        addToast(t('toast.layoutDeleteFailed'), 'error');
        return err(fromUnknown(error));
      }
    },
    [setLibrary, switchLayout, addToast, t]
  );

  /**
   * Duplicate a layout.
   */
  const duplicateLayout = useCallback(
    async (id: LayoutId): Promise<Result<string, LayoutError | StorageError | UnknownError>> => {
      const sourceEntry = getEntry(id);
      if (!sourceEntry) {
        return err(layoutInvalidOperation('duplicateLayout', 'Layout not found'));
      }

      try {
        // Get fresh library state to avoid stale closure
        const currentLibrary = useLibraryStore.getState().library;

        const result = await duplicateLayoutStorage(id, currentLibrary);

        if (isErr(result)) {
          addToast(t('toast.layoutDuplicateFailed'), 'error');
          return result;
        }

        setLibrary(result.value.library);

        trackLayoutAction('duplicated');
        // Track quality signal (duplicated = positive signal for ML)
        mlTracking.trackQuality('duplicated');

        addToast(t('toast.layoutDuplicated'), 'success');
        return ok(result.value.layoutId);
      } catch (error) {
        addToast(t('toast.layoutDuplicateFailed'), 'error');
        return err(fromUnknown(error));
      }
    },
    [getEntry, setLibrary, addToast, t]
  );

  /**
   * Rename a layout.
   */
  const renameLayout = useCallback(
    (id: LayoutId, newName: string): void => {
      // Get fresh library state to avoid stale closure
      const currentLibrary = useLibraryStore.getState().library;
      const currentActiveId = useLayoutStore.getState().activeLayoutId;

      const result = renameLayoutEntry(id, newName, currentLibrary);

      if (isOk(result)) {
        setLibrary(result.value);

        if (id === currentActiveId) {
          mutations.setName(newName);
        }

        trackLayoutAction('renamed');
      } else {
        addToast(t('toast.layoutRenameFailed'), 'error');
      }
    },
    [setLibrary, addToast, t, mutations]
  );

  /**
   * Import a layout from JSON and add to library.
   */
  const importLayoutFromJSON = useCallback(
    async (
      importedLayout: Layout,
      forkedFrom?: { name: string; author?: string }
    ): Promise<Result<string, StorageError | UnknownError | LayoutLibraryLimitError>> => {
      try {
        // Get fresh library state to avoid stale closure
        const currentLibrary = useLibraryStore.getState().library;

        const result = await createLayoutEntry(importedLayout, currentLibrary, {
          name: importedLayout.name,
          author: currentLibrary.settings.authorName,
          forkedFrom,
        });

        if (isErr(result)) {
          addToast(t('toast.layoutImportFailed'), 'error');
          return result;
        }

        setLibrary(result.value.library);

        trackLayoutAction('imported', forkedFrom ? 'url' : 'json');

        addToast(t('toast.layoutImported', { name: importedLayout.name }), 'success');
        return ok(result.value.layoutId);
      } catch (error) {
        addToast(t('toast.layoutImportFailed'), 'error');
        return err(fromUnknown(error));
      }
    },
    [setLibrary, addToast, t]
  );

  return {
    activeLayoutId,
    library,

    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
    saveCurrentLayout,
    importLayoutFromJSON,

    pendingSaveRef,
  };
}
