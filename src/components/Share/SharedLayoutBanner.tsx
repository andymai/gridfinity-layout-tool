import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '../../core/store/layout';
import { useLibraryStore, computePreview } from '../../core/store/library';
import { useUIStore } from '../../core/store/ui';
import { useHistoryStore } from '../../core/store/history';
import { useToastStore } from '../../core/store/toast';
import {
  saveLayoutById,
  saveLibrary,
  initializeLayoutLibrary,
} from '../../core/storage';
import { generateLayoutId } from '../../utils/uuid';
import { ConfirmDialog } from '../Modals/ConfirmDialog';
import { useCollabMode } from '../../hooks/useCollabMode';

/**
 * Banner shown when viewing a shared layout in view-only mode.
 * Provides options to save to library or discard and return to previous layout.
 *
 * Note: This banner is NOT shown in collaborative editing mode, since the user
 * is an active participant rather than just a viewer.
 */
export function SharedLayoutBanner() {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { sharedLayoutPreview, sharedLayoutOriginalName, clearSharedLayoutPreview, setActiveLayer, setActiveCategory, clearSelection } = useUIStore(
    useShallow((state) => ({
      sharedLayoutPreview: state.sharedLayoutPreview,
      sharedLayoutOriginalName: state.sharedLayoutOriginalName,
      clearSharedLayoutPreview: state.clearSharedLayoutPreview,
      setActiveLayer: state.setActiveLayer,
      setActiveCategory: state.setActiveCategory,
      clearSelection: state.clearSelection,
    }))
  );

  const { layout, importLayout } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      importLayout: state.importLayout,
    }))
  );

  const { createEntry, setActiveLayoutId, updateEntry } = useLibraryStore(
    useShallow((state) => ({
      createEntry: state.createEntry,
      setActiveLayoutId: state.setActiveLayoutId,
      updateEntry: state.updateEntry,
    }))
  );

  const clearHistory = useHistoryStore((state) => state.clear);
  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  // Check if in collaborative editing mode
  const { isCollaborative } = useCollabMode();

  // Don't render if not viewing a shared layout
  if (!sharedLayoutPreview) return null;

  // Don't render in collaborative mode - user is an active participant, not just a viewer
  if (isCollaborative) return null;

  const handleSave = () => {
    // Create a new layout entry in the library
    const layoutId = generateLayoutId();

    // Add suffix to indicate it was imported
    const savedLayout = {
      ...layout, // Use current layout state (user may have made edits)
      name: `${sharedLayoutOriginalName || layout.name} (imported)`,
    };

    // Save the layout to storage
    saveLayoutById(layoutId, savedLayout);

    // Create entry in library store
    createEntry(
      savedLayout.name,
      layoutId,
      computePreview(savedLayout)
    );

    // Add forkedFrom info
    updateEntry(layoutId, {
      forkedFrom: { name: sharedLayoutOriginalName || layout.name },
    });

    // Update the layout store with the proper ID (not __shared_preview__)
    importLayout(savedLayout, layoutId, 'init');
    setActiveLayoutId(layoutId);

    // Save the library to storage (get fresh state after store updates)
    saveLibrary(useLibraryStore.getState().library);

    // Clear the shared preview state
    clearSharedLayoutPreview();

    // Show feedback
    addToast(`Saved "${savedLayout.name}" to your layouts`, 'success');
    announceToScreenReader(`Layout saved: ${savedLayout.name}`);
  };

  const handleDiscard = () => {
    // Restore the user's previous layout
    const { library: restoredLibrary, activeLayout } = initializeLayoutLibrary();

    // Import the previous active layout
    importLayout(activeLayout, restoredLibrary.activeLayoutId, 'init');
    setActiveLayoutId(restoredLibrary.activeLayoutId);

    // Reset UI state
    clearSelection();
    if (activeLayout.layers[0]) {
      setActiveLayer(activeLayout.layers[0].id);
    }
    if (activeLayout.categories[0]) {
      setActiveCategory(activeLayout.categories[0].id);
    }

    // Clear history
    clearHistory();

    // Clear the shared preview state
    clearSharedLayoutPreview();

    // Show feedback
    addToast('Shared layout discarded', 'info');
    announceToScreenReader('Shared layout discarded, returned to your layouts');
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2 bg-primary text-white"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="text-sm font-medium">
          Viewing shared layout: <strong>{sharedLayoutOriginalName || layout.name}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-slate-900 hover:bg-slate-100 transition-colors"
        >
          Save to My Layouts
        </button>
        <button
          onClick={() => setShowDiscardConfirm(true)}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-white/15 hover:bg-white/25 transition-colors"
        >
          Discard
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Discard shared layout?"
        message="Any changes you made will be lost. You'll return to your previous layout."
        confirmText="Discard"
        cancelText="Keep viewing"
        destructive
        onConfirm={handleDiscard}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}
