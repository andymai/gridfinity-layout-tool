import { useEffect } from 'react';
import { useLayoutStore, useLibraryStore, useHistoryStore, useUIStore } from '../store';
import { loadLayoutById, loadLibrary } from '../utils/storage';
import { validateLayoutIntegrity } from '../utils/validation';

/**
 * Hook to automatically sync layout data when modified in another browser tab.
 * The storage event only fires for changes from OTHER tabs, so this won't loop.
 */
export function useCrossTabSync() {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Library index changed - reload it
      if (e.key === 'gridfinity-library-v1') {
        const newLibrary = loadLibrary();
        if (newLibrary) {
          useLibraryStore.getState().setLibrary(newLibrary);
        }
        return;
      }

      // A specific layout changed - check if it's the active one
      if (e.key?.startsWith('gridfinity-layout-')) {
        const layoutId = e.key.replace('gridfinity-layout-', '');
        const activeLayoutId = useLayoutStore.getState().activeLayoutId;

        // Only reload if it's the currently active layout
        if (layoutId === activeLayoutId) {
          const newLayout = loadLayoutById(layoutId);
          if (newLayout) {
            // Validate before applying
            const validation = validateLayoutIntegrity(newLayout);
            if (validation.valid) {
              // Update layout store
              useLayoutStore.getState().importLayout(newLayout, layoutId);

              // Clear undo history since we're syncing external changes
              useHistoryStore.getState().clear();

              // Update active layer/category if they no longer exist
              const uiState = useUIStore.getState();
              const activeLayer = uiState.activeLayerId;
              const activeCategory = uiState.activeCategoryId;

              if (activeLayer && !newLayout.layers.find(l => l.id === activeLayer)) {
                uiState.setActiveLayer(newLayout.layers[0]?.id ?? '');
              }
              if (activeCategory && !newLayout.categories.find(c => c.id === activeCategory)) {
                uiState.setActiveCategory(newLayout.categories[0]?.id ?? '');
              }

              // Clear selection since bins may have changed
              uiState.clearSelection();
            }
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
