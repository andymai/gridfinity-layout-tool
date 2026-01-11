import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '../store/layout';
import { useLibraryStore, computePreview } from '../store/library';
import { useUIStore } from '../store/ui';
import {
  getSharedLayoutFromURL,
  clearSharedLayoutFromURL,
  saveLayoutById,
  saveLibrary,
} from '../utils/storage';
import { generateUUID } from '../utils/uuid';
import { ConfirmDialog } from './modals/ConfirmDialog';
import type { Layout } from '../types';

// Check for shared layout once at module load time
const initialShareResult = getSharedLayoutFromURL();

/**
 * Component that detects shared layouts in URL and offers to import them.
 * Shows a dialog when #share=... is detected in the URL.
 */
export function SharedLayoutImporter() {
  const [sharedLayout, setSharedLayout] = useState<Layout | null>(
    initialShareResult?.layout ?? null
  );
  const [errors, setErrors] = useState<string[]>(
    initialShareResult?.errors ?? []
  );
  const [showDialog, setShowDialog] = useState(
    initialShareResult !== null
  );

  const importLayout = useLayoutStore((state) => state.importLayout);
  const { library, createEntry, setActiveLayoutId } = useLibraryStore(
    useShallow((state) => ({
      library: state.library,
      createEntry: state.createEntry,
      setActiveLayoutId: state.setActiveLayoutId,
    }))
  );
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  const handleImport = () => {
    if (!sharedLayout) return;

    // Create a new layout entry in the library
    const layoutId = generateUUID();

    // Add name suffix to indicate it was shared
    const importedLayout = {
      ...sharedLayout,
      name: `${sharedLayout.name} (imported)`,
    };

    // Save the layout
    saveLayoutById(layoutId, importedLayout);

    // Create entry in library store
    const newEntry = createEntry(
      importedLayout.name,
      layoutId,
      computePreview(importedLayout)
    );
    // Add forkedFrom info
    newEntry.forkedFrom = { name: sharedLayout.name };

    // Update the library in storage
    const updatedLibrary = {
      ...library,
      activeLayoutId: layoutId,
      entries: [newEntry, ...library.entries.filter(e => e.id !== layoutId)],
    };
    saveLibrary(updatedLibrary);

    // Update active layout
    setActiveLayoutId(layoutId);
    importLayout(importedLayout, layoutId);

    announceToScreenReader(`Imported layout: ${importedLayout.name}`);

    // Clear the URL
    clearSharedLayoutFromURL();

    setShowDialog(false);
    setSharedLayout(null);
  };

  const handleCancel = () => {
    clearSharedLayoutFromURL();
    setShowDialog(false);
    setSharedLayout(null);
    setErrors([]);
  };

  if (!showDialog) return null;

  // Show error dialog if there were errors
  if (errors.length > 0) {
    return (
      <ConfirmDialog
        isOpen={true}
        title="Invalid Share Link"
        message={`Could not load the shared layout: ${errors.join(', ')}`}
        confirmText="OK"
        onConfirm={handleCancel}
        onCancel={handleCancel}
      />
    );
  }

  // Show import confirmation dialog
  if (sharedLayout) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={handleCancel}
      >
        <div
          className="bg-surface-elevated rounded-lg p-6 max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold text-content mb-4">Import Shared Layout</h2>

          <p className="text-content-secondary mb-4">
            Someone shared a layout with you. Would you like to import it?
          </p>

          <div className="bg-surface rounded-lg p-4 mb-6">
            <h3 className="font-medium text-content mb-2">{sharedLayout.name}</h3>
            <div className="text-sm text-content-secondary space-y-1">
              <div>
                Drawer: {sharedLayout.drawer.width}×{sharedLayout.drawer.depth}×{sharedLayout.drawer.height}
              </div>
              <div>{sharedLayout.bins.length} bins</div>
              <div>{sharedLayout.layers.length} layers</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              className="btn btn-primary flex-1"
            >
              Import Layout
            </button>
            <button
              onClick={handleCancel}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
