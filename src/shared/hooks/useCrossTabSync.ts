import { useEffect } from 'react';
import {
  useLayoutStore,
  useLibraryStore,
  useHistoryStore,
  useLabsStore,
  LABS_STORAGE_KEY,
} from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { loadLayoutAsync, loadLibraryAsync } from '@/core/storage';
import { listenForLibraryChanges } from '@/core/storage/librarySync';
import { layoutId as toLayoutId } from '@/core/types';
import { validateLayoutIntegrity } from '@/shared/utils/validation';
import { createDefaultLabsPreferences } from '@/core/labs';
import type { LabsPreferences } from '@/core/labs';

/** Syncs layout data modified in another browser tab (storage events are cross-tab only). */
export function useCrossTabSync() {
  useEffect(() => {
    const cleanupLibraryChannel = listenForLibraryChanges(() => {
      loadLibraryAsync()
        .then((newLibrary) => {
          if (newLibrary) {
            useLibraryStore.getState().setLibrary(newLibrary);
          }
        })
        .catch((error: unknown) => {
          console.error('[CrossTabSync] Failed to reload library:', error);
        });
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LABS_STORAGE_KEY) {
        try {
          const newPrefs: unknown = e.newValue
            ? JSON.parse(e.newValue)
            : createDefaultLabsPreferences();
          useLabsStore.getState().syncFromStorage({
            ...createDefaultLabsPreferences(),
            ...(newPrefs as Partial<LabsPreferences>),
          });
        } catch {
          // Ignore parse errors
        }
        return;
      }

      // Legacy backwards compatibility: IndexedDB has no cross-tab events
      if (e.key?.startsWith('gridfinity-layout-')) {
        const layoutId = e.key.replace('gridfinity-layout-', '');
        const activeLayoutId = useLayoutStore.getState().activeLayoutId;

        if (layoutId === activeLayoutId) {
          loadLayoutAsync(layoutId)
            .then((newLayout) => {
              if (newLayout) {
                if (useLayoutStore.getState().activeLayoutId !== layoutId) return;

                const validation = validateLayoutIntegrity(newLayout);
                if (validation.valid) {
                  useLayoutStore.getState().importLayout(newLayout, toLayoutId(layoutId), 'remote');
                  useHistoryStore.getState().clear();

                  const selectionState = useSelectionStore.getState();
                  const activeLayer = selectionState.activeLayerId;
                  const activeCategory = selectionState.activeCategoryId;

                  if (activeLayer && !newLayout.layers.find((l) => l.id === activeLayer)) {
                    selectionState.setActiveLayer(newLayout.layers[0]?.id ?? '');
                  }
                  if (
                    activeCategory &&
                    !newLayout.categories.find((c) => c.id === activeCategory)
                  ) {
                    selectionState.setActiveCategory(newLayout.categories[0]?.id ?? '');
                  }

                  selectionState.clearSelection();
                }
              }
            })
            .catch((error: unknown) => {
              console.error(`[CrossTabSync] Failed to load layout ${layoutId}:`, error);
            });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      cleanupLibraryChannel();
    };
  }, []);
}
