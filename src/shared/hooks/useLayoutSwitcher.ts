import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import {
  queueLibraryWrite,
  useLibraryStore,
  useToastStore,
  useSettingsStore,
  writeLibrary,
} from '@/core/store';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import type { Layout, LayoutId } from '@/core/types';
import { layoutId } from '@/core/types';
import { useLayoutActivation } from '@/shared/hooks/useLayoutActivation';
import { isErr, isOk } from '@/core/result';
import {
  saveLayoutWithMetadata,
  createLayoutEntry,
  deleteLayoutWithEntry,
  duplicateLayoutEntry as duplicateLayoutStorage,
  switchActiveLayout,
  renameLayoutEntry,
} from '@/core/storage';
import { setLayoutURL } from '@/shared/utils/url';
import {
  createLayoutWithSettings,
  DEFAULT_LAYOUT_NAME,
  SHARED_PREVIEW_ID,
  isRealLayoutId,
} from '@/core/constants';
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

type CreateLayoutResult = Result<string, StorageError | UnknownError | LayoutLibraryLimitError>;

// Module scope, not a ref: the keyboard, the header, the layout manager and the
// mobile panel each own a hook instance, and a second request from any of them
// while a creation is pending opens that same new layout.
let pendingCreate: Promise<CreateLayoutResult> | null = null;

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

  const failureMessage = useCallback(
    (error: StorageError | LayoutError, fallbackKey: string): string =>
      error.code === 'LAYOUT_LIBRARY_LIMIT'
        ? t('toast.layoutLimitReached', { max: error.maxCount })
        : t(fallbackKey),
    [t]
  );

  /**
   * Save the current layout to storage and update library entry.
   */
  const saveCurrentLayout = useCallback(async () => {
    const result = await queueLibraryWrite(async (library) => {
      const { activeLayoutId: currentActiveId, layout } = useLayoutStore.getState();
      if (!isRealLayoutId(currentActiveId)) return OK;
      const saved = await saveLayoutWithMetadata(currentActiveId, layout, library);
      if (isOk(saved)) setLibrary(saved.value.library);
      return saved;
    });
    if (isErr(result)) addToast(t('toast.layoutSaveFailed'), 'error');
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

        const result = await queueLibraryWrite(async (library) => {
          const { activeLayoutId: currentActiveId, layout } = useLayoutStore.getState();
          const switched = await switchActiveLayout(
            currentActiveId || SHARED_PREVIEW_ID,
            layout,
            targetId,
            library
          );
          if (isOk(switched)) {
            setLibrary(switched.value.library);
            activateLayout(switched.value.targetLayout, targetId);
          }
          return switched;
        });

        if (isErr(result)) {
          addToast(t('toast.layoutSwitchFailed'), 'error');
          return result;
        }

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

  const createLayout = useCallback(
    async (name?: string): Promise<CreateLayoutResult> => {
      await saveCurrentLayout();

      // Create new layout with user's default settings
      const newLayout = createLayoutWithSettings(settings);
      newLayout.name = name || DEFAULT_LAYOUT_NAME;

      try {
        const result = await queueLibraryWrite(async (library) => {
          const created = await createLayoutEntry(newLayout, library, {
            name: newLayout.name,
            author: library.settings.authorName,
            activate: true,
          });
          if (isOk(created)) {
            clearSharedLayoutPreview();
            setLibrary(created.value.library);
            activateLayout(created.value.layout, layoutId(created.value.layoutId));
          }
          return created;
        });

        if (isErr(result)) {
          addToast(failureMessage(result.error, 'toast.layoutCreateFailed'), 'error');
          return result;
        }

        const newLayoutId = layoutId(result.value.layoutId);
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
      setLibrary,
      clearSharedLayoutPreview,
      activateLayout,
      addToast,
      failureMessage,
      settings,
      t,
    ]
  );

  /**
   * Create a new layout and switch to it. A call while a creation is pending
   * gets that creation's result instead of starting another.
   */
  const createNewLayout = useCallback(
    (name?: string): Promise<CreateLayoutResult> => {
      pendingCreate ??= createLayout(name).finally(() => {
        pendingCreate = null;
      });
      return pendingCreate;
    },
    [createLayout]
  );

  const deleteLayout = useCallback(
    async (id: LayoutId): Promise<Result<Unit, LayoutError | StorageError | UnknownError>> => {
      if (useLibraryStore.getState().library.entries.length <= 1) {
        return err(layoutLastEntity('layout'));
      }

      try {
        const result = await writeLibrary((library) => deleteLayoutWithEntry(id, library));

        if (isErr(result)) {
          addToast(t('toast.layoutDeleteFailed'), 'error');
          return result;
        }

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
    [switchLayout, addToast, t]
  );

  const duplicateLayout = useCallback(
    async (id: LayoutId): Promise<Result<string, LayoutError | StorageError | UnknownError>> => {
      const sourceEntry = getEntry(id);
      if (!sourceEntry) {
        return err(layoutInvalidOperation('duplicateLayout', 'Layout not found'));
      }

      try {
        const result = await writeLibrary((library) => duplicateLayoutStorage(id, library));

        if (isErr(result)) {
          addToast(failureMessage(result.error, 'toast.layoutDuplicateFailed'), 'error');
          return result;
        }

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
    [getEntry, addToast, failureMessage, t]
  );

  const renameLayout = useCallback(
    (id: LayoutId, newName: string): void => {
      void queueLibraryWrite((library) => {
        const result = renameLayoutEntry(id, newName, library);

        if (isOk(result)) {
          setLibrary(result.value);

          if (id === useLayoutStore.getState().activeLayoutId) {
            mutations.setName(newName);
          }

          trackLayoutAction('renamed');
        } else {
          addToast(t('toast.layoutRenameFailed'), 'error');
        }
      });
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
        const result = await writeLibrary((library) =>
          createLayoutEntry(importedLayout, library, {
            name: importedLayout.name,
            author: library.settings.authorName,
            forkedFrom,
          })
        );

        if (isErr(result)) {
          addToast(failureMessage(result.error, 'toast.layoutImportFailed'), 'error');
          return result;
        }

        trackLayoutAction('imported', forkedFrom ? 'url' : 'json');

        addToast(t('toast.layoutImported', { name: importedLayout.name }), 'success');
        return ok(result.value.layoutId);
      } catch (error) {
        addToast(t('toast.layoutImportFailed'), 'error');
        return err(fromUnknown(error));
      }
    },
    [addToast, failureMessage, t]
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
