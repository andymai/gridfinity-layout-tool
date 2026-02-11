import { useEffect } from 'react';
import {
  useLayoutStore,
  useLibraryStore,
  useHistoryStore,
  useLabsStore,
  LABS_STORAGE_KEY,
} from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { loadLayoutAsync, loadLibrary } from '@/core/storage';
import { layoutId as toLayoutId } from '@/core/types';
import { validateLayoutIntegrity } from '@/shared/utils/validation';
import { createDefaultLabsPreferences } from '@/core/labs';
import type { LabsPreferences } from '@/core/labs';

/**
 * Hook to automatically sync layout data when modified in another browser tab.
 * The storage event only fires for changes from OTHER tabs, so this won't loop.
 */
export function useCrossTabSync() {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Labs preferences changed - sync them
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

      // Library index changed - reload it
      if (e.key === 'gridfinity-library-v1') {
        const newLibrary = loadLibrary();
        if (newLibrary) {
          useLibraryStore.getState().setLibrary(newLibrary);
        }
        return;
      }

      // A specific layout changed - check if it's the active one
      // Note: With IndexedDB migration, localStorage events only fire for legacy writes.
      // IndexedDB doesn't have cross-tab events, so this is backwards compatibility.
      if (e.key?.startsWith('gridfinity-layout-')) {
        const layoutId = e.key.replace('gridfinity-layout-', '');
        const activeLayoutId = useLayoutStore.getState().activeLayoutId;

        // Only reload if it's the currently active layout
        if (layoutId === activeLayoutId) {
          // Load asynchronously from IndexedDB (with localStorage fallback)
          loadLayoutAsync(layoutId)
            .then((newLayout) => {
              if (newLayout) {
                // Re-check active layout hasn't changed during async load
                if (useLayoutStore.getState().activeLayoutId !== layoutId) return;

                // Validate before applying
                const validation = validateLayoutIntegrity(newLayout);
                if (validation.valid) {
                  // Update layout store (from another tab, treat as remote)
                  useLayoutStore.getState().importLayout(newLayout, toLayoutId(layoutId), 'remote');

                  // Clear undo history since we're syncing external changes
                  useHistoryStore.getState().clear();

                  // Update active layer/category if they no longer exist
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

                  // Clear selection since bins may have changed
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
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
