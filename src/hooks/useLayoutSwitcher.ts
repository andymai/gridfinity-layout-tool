import { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useLibraryStore, useHistoryStore, useUIStore, useToastStore, useSettingsStore } from '../store';
import type { Layout, OperationResult, LayoutPreview } from '../types';
import {
  saveLayoutByIdAsync,
  loadLayoutByIdAsync,
  deleteLayoutByIdAsync,
  saveLibrary,
  computeLayoutPreview,
} from '../utils/storage';
import { setLayoutHash } from '../utils/url';
import { validateLayoutIntegrity } from '../utils/validation';
import { generateUUID } from '../utils/uuid';
import { createLayoutWithSettings } from '../constants';
import { trackLayoutAction } from '../utils/analytics';

/**
 * Orchestration hook for layout switching and management.
 * Coordinates mutations across multiple stores without cross-store dependencies.
 */
export function useLayoutSwitcher() {
  const pendingSaveRef = useRef<number | null>(null);

  // Layout store
  const { layout, activeLayoutId, importLayout } = useLayoutStore(
    useShallow(state => ({
      layout: state.layout,
      activeLayoutId: state.activeLayoutId,
      importLayout: state.importLayout,
    }))
  );

  // Library store
  const {
    library,
    getEntry,
    updateEntry,
    createEntry,
    deleteEntry,
    duplicateEntry,
    setActiveLayoutId: setLibraryActiveId,
  } = useLibraryStore(
    useShallow(state => ({
      library: state.library,
      getEntry: state.getEntry,
      updateEntry: state.updateEntry,
      createEntry: state.createEntry,
      deleteEntry: state.deleteEntry,
      duplicateEntry: state.duplicateEntry,
      setActiveLayoutId: state.setActiveLayoutId,
    }))
  );

  // History store
  const clearHistory = useHistoryStore(state => state.clear);

  // UI store
  const { clearSelection, setActiveLayer, setActiveCategory, clearSharedLayoutPreview } = useUIStore(
    useShallow(state => ({
      clearSelection: state.clearSelection,
      setActiveLayer: state.setActiveLayer,
      setActiveCategory: state.setActiveCategory,
      clearSharedLayoutPreview: state.clearSharedLayoutPreview,
    }))
  );

  // Toast store
  const addToast = useToastStore(state => state.addToast);

  /**
   * Save the current layout to storage and update library entry.
   * Uses async IndexedDB storage for better performance with large layouts.
   */
  const saveCurrentLayout = useCallback(async () => {
    if (!activeLayoutId) return;

    try {
      await saveLayoutByIdAsync(activeLayoutId, layout);
      updateEntry(activeLayoutId, {
        modifiedAt: Date.now(),
        preview: computeLayoutPreview(layout),
        name: layout.name, // Sync name with library
      });
      saveLibrary(useLibraryStore.getState().library);
    } catch (error) {
      console.error('Failed to save current layout:', error);
    }
  }, [activeLayoutId, layout, updateEntry]);

  /**
   * Switch to a different layout.
   */
  const switchLayout = useCallback(async (targetId: string): Promise<OperationResult> => {
    // 1. Validate target exists
    const targetEntry = getEntry(targetId);
    if (!targetEntry) {
      return { success: false, error: 'Layout not found' };
    }

    // 2. Cancel any pending auto-save (prevent race)
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }

    try {
      // 3. Clear any shared layout preview state (user is explicitly switching)
      clearSharedLayoutPreview();

      // 4. Save current layout immediately (skip if it was a shared preview)
      // Use async save to IndexedDB with localStorage backup
      if (activeLayoutId && activeLayoutId !== '__shared_preview__') {
        await saveLayoutByIdAsync(activeLayoutId, layout);
        updateEntry(activeLayoutId, {
          modifiedAt: Date.now(),
          preview: computeLayoutPreview(layout),
          name: layout.name,
        });
      }

      // 5. Load target layout from IndexedDB (with localStorage fallback)
      const targetLayout = await loadLayoutByIdAsync(targetId);
      if (!targetLayout) {
        return { success: false, error: 'Failed to load layout data' };
      }

      // 6. Validate layout integrity
      const validation = validateLayoutIntegrity(targetLayout);
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Layout data is corrupted' };
      }

      // 7. Update stores (atomic sequence)
      importLayout(targetLayout, targetId, 'init');
      setLibraryActiveId(targetId);

      // 8. Reset UI state
      clearSelection();
      setActiveLayer(targetLayout.layers[0]?.id ?? '');
      setActiveCategory(targetLayout.categories[0]?.id ?? '');

      // 9. Clear undo history
      clearHistory();

      // 10. Save library index
      saveLibrary(useLibraryStore.getState().library);

      // 11. Update URL hash (add to browser history for back/forward navigation)
      setLayoutHash(targetId, true);

      // 12. Track analytics
      trackLayoutAction('switched');

      return { success: true };
    } catch (error) {
      addToast('Failed to switch layout', 'error');
      return { success: false, error: String(error) };
    }
  }, [
    activeLayoutId,
    layout,
    getEntry,
    updateEntry,
    importLayout,
    setLibraryActiveId,
    clearSelection,
    setActiveLayer,
    setActiveCategory,
    clearHistory,
    clearSharedLayoutPreview,
    addToast,
  ]);

  // Settings store
  const settings = useSettingsStore((state) => state.settings);

  /**
   * Create a new layout and switch to it.
   */
  const createNewLayout = useCallback(async (name?: string): Promise<OperationResult<string>> => {
    // Save current layout first
    await saveCurrentLayout();

    // Create new layout using user preferences
    const layoutId = generateUUID();
    const newLayout = createLayoutWithSettings(settings);
    newLayout.name = name || 'Untitled layout';

    try {
      // Save the new layout to IndexedDB + localStorage
      await saveLayoutByIdAsync(layoutId, newLayout);

      // Create library entry
      createEntry(
        newLayout.name,
        layoutId,
        computeLayoutPreview(newLayout)
      );

      // Switch to the new layout
      importLayout(newLayout, layoutId, 'init');
      setLibraryActiveId(layoutId);

      // Reset UI state
      clearSelection();
      setActiveLayer(newLayout.layers[0]?.id ?? '');
      setActiveCategory(newLayout.categories[0]?.id ?? '');

      // Clear undo history
      clearHistory();

      // Save library
      saveLibrary(useLibraryStore.getState().library);

      // Update URL hash (add to browser history)
      setLayoutHash(layoutId, true);

      // Track analytics
      trackLayoutAction('created');

      addToast('New layout created', 'success');
      return { success: true, data: layoutId };
    } catch (error) {
      addToast('Failed to create layout', 'error');
      return { success: false, error: String(error) };
    }
  }, [
    saveCurrentLayout,
    importLayout,
    createEntry,
    setLibraryActiveId,
    clearSelection,
    setActiveLayer,
    setActiveCategory,
    clearHistory,
    addToast,
    settings,
  ]);

  /**
   * Delete a layout.
   */
  const deleteLayout = useCallback(async (id: string): Promise<OperationResult> => {
    const { entries } = library;

    // Can't delete last layout
    if (entries.length <= 1) {
      return { success: false, error: 'Cannot delete the only layout' };
    }

    try {
      // Remove from storage (both IndexedDB and localStorage)
      await deleteLayoutByIdAsync(id);

      // Remove from library
      const result = deleteEntry(id);
      if (!result.success) {
        return result;
      }

      // If deleting active layout, switch to first remaining
      if (activeLayoutId === id) {
        const remaining = entries.filter(e => e.id !== id);
        const fallbackId = remaining[0].id;
        const switchResult = await switchLayout(fallbackId);
        if (!switchResult.success) {
          return switchResult;
        }
      }

      // Save library
      saveLibrary(useLibraryStore.getState().library);

      // Track analytics
      trackLayoutAction('deleted');

      addToast('Layout deleted', 'success');
      return { success: true };
    } catch (error) {
      addToast('Failed to delete layout', 'error');
      return { success: false, error: String(error) };
    }
  }, [library, activeLayoutId, deleteEntry, switchLayout, addToast]);

  /**
   * Duplicate a layout.
   */
  const duplicateLayout = useCallback(async (id: string): Promise<OperationResult<string>> => {
    const sourceEntry = getEntry(id);
    if (!sourceEntry) {
      return { success: false, error: 'Layout not found' };
    }

    // Load the source layout from IndexedDB (with localStorage fallback)
    const sourceLayout = await loadLayoutByIdAsync(id);
    if (!sourceLayout) {
      return { success: false, error: 'Failed to load layout data' };
    }

    try {
      // Create new layout ID
      const newLayoutId = generateUUID();

      // Clone the layout with new name
      const newLayout: Layout = {
        ...sourceLayout,
        name: `${sourceLayout.name} (copy)`,
      };

      // Save the new layout to IndexedDB + localStorage
      await saveLayoutByIdAsync(newLayoutId, newLayout);

      // Create library entry
      duplicateEntry(sourceEntry, newLayoutId);

      // Save library
      saveLibrary(useLibraryStore.getState().library);

      // Track analytics
      trackLayoutAction('duplicated');

      addToast('Layout duplicated', 'success');
      return { success: true, data: newLayoutId };
    } catch (error) {
      addToast('Failed to duplicate layout', 'error');
      return { success: false, error: String(error) };
    }
  }, [getEntry, duplicateEntry, addToast]);

  /**
   * Rename a layout.
   */
  const renameLayout = useCallback((id: string, newName: string): void => {
    updateEntry(id, { name: newName });

    // If renaming active layout, also update layout store
    if (id === activeLayoutId) {
      useLayoutStore.getState().setName(newName);
    }

    saveLibrary(useLibraryStore.getState().library);

    // Track analytics
    trackLayoutAction('renamed');
  }, [activeLayoutId, updateEntry]);

  /**
   * Import a layout from JSON and add to library.
   */
  const importLayoutFromJSON = useCallback(async (
    importedLayout: Layout,
    forkedFrom?: { name: string; author?: string }
  ): Promise<OperationResult<string>> => {
    try {
      const layoutId = generateUUID();

      // Save the layout to IndexedDB + localStorage
      await saveLayoutByIdAsync(layoutId, importedLayout);

      // Create library entry
      const preview: LayoutPreview = computeLayoutPreview(importedLayout);
      createEntry(
        importedLayout.name,
        layoutId,
        preview,
        library.settings.authorName
      );

      // Add forkedFrom if provided
      if (forkedFrom) {
        updateEntry(layoutId, { forkedFrom });
      }

      // Save library
      saveLibrary(useLibraryStore.getState().library);

      // Track analytics
      trackLayoutAction('imported', forkedFrom ? 'url' : 'json');

      addToast(`Imported "${importedLayout.name}"`, 'success');
      return { success: true, data: layoutId };
    } catch (error) {
      addToast('Failed to import layout', 'error');
      return { success: false, error: String(error) };
    }
  }, [library.settings.authorName, createEntry, updateEntry, addToast]);

  return {
    // State
    activeLayoutId,
    library,

    // Actions
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
