import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useLibraryStore } from '@/core/store/library';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useSelectionStore } from '@/core/store/selection';
import { useInteractionStore } from '@/core/store/interaction';
import { useHistoryStore } from '@/core/store/history';
import { useToastStore } from '@/core/store/toast';
import { createLayoutEntry, initializeLayoutLibrary } from '@/core/storage';
import { isErr, getUserMessage } from '@/core/result';
import { layoutId as toLayoutId } from '@/core/types';
import { ConfirmDialog } from '@/shared/components';
import { useCollabMode } from '@/hooks/useCollabMode';
import { useTranslation } from '@/i18n';

/**
 * Banner shown when viewing a shared layout in view-only mode.
 * Provides options to save to library or discard and return to previous layout.
 *
 * Note: This banner is NOT shown in collaborative editing mode, since the user
 * is an active participant rather than just a viewer.
 */
export function SharedLayoutBanner() {
  const t = useTranslation();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { sharedPreview, clearSharedLayoutPreview } = useSharedPreviewStore(
    useShallow((state) => ({
      sharedPreview: state.sharedPreview,
      clearSharedLayoutPreview: state.clearSharedLayoutPreview,
    }))
  );

  const sharedLayoutPreview = sharedPreview?.layout ?? null;
  const sharedLayoutOriginalName = sharedPreview?.originalName ?? null;

  const { setActiveLayer, setActiveCategory, clearSelection } = useSelectionStore(
    useShallow((state) => ({
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

  const { setLibrary, setActiveLayoutId } = useLibraryStore(
    useShallow((state) => ({
      setLibrary: state.setLibrary,
      setActiveLayoutId: state.setActiveLayoutId,
    }))
  );

  const clearHistory = useHistoryStore((state) => state.clear);
  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  // Check if in collaborative editing mode
  const { isCollaborative } = useCollabMode();

  // Don't render if not viewing a shared layout
  if (!sharedLayoutPreview) return null;

  // Don't render in collaborative mode - user is an active participant, not just a viewer
  if (isCollaborative) return null;

  const handleSave = async () => {
    // Add suffix to indicate it was imported
    const savedLayout = {
      ...layout, // Use current layout state (user may have made edits)
      name: `${sharedLayoutOriginalName || layout.name} (imported)`,
    };

    // Use atomic createLayoutEntry API for storage + library entry in one operation
    const result = await createLayoutEntry(savedLayout, useLibraryStore.getState().library, {
      name: savedLayout.name,
      forkedFrom: { name: sharedLayoutOriginalName || layout.name },
    });

    if (isErr(result)) {
      addToast(getUserMessage(result.error), 'error');
      return;
    }

    const { layoutId: rawLayoutId, library: updatedLibrary } = result.value;
    const brandedLayoutId = toLayoutId(rawLayoutId);

    // Update the layout store with the proper ID (not __shared_preview__)
    importLayout(savedLayout, brandedLayoutId, 'init');
    setActiveLayoutId(brandedLayoutId);

    // Sync library store with updated library from atomic operation
    setLibrary(updatedLibrary);

    // Clear the shared preview state
    clearSharedLayoutPreview();

    // Show feedback
    addToast(t('toast.savedToLayouts', { name: savedLayout.name }), 'success');
    announceToScreenReader(`Layout saved: ${savedLayout.name}`);
  };

  const handleDiscard = async () => {
    try {
      // Restore the user's previous layout
      const { library: restoredLibrary, activeLayout } = await initializeLayoutLibrary();

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
      addToast(t('share.banner.discarded'), 'info');
      announceToScreenReader('Shared layout discarded, returned to your layouts');
    } catch (error) {
      console.error('[SharedLayoutBanner] Failed to restore layout:', error);
      addToast(t('toast.genericError'), 'error');
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2 bg-primary text-on-accent"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        <span className="text-sm font-medium">
          {t('share.banner.viewingLayout', { name: sharedLayoutOriginalName || layout.name })}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-surface text-content hover:bg-surface-hover transition-colors"
        >
          {t('share.banner.saveToMyLayouts')}
        </button>
        <button
          onClick={() => setShowDiscardConfirm(true)}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-on-accent/15 hover:bg-on-accent/25 transition-colors"
        >
          {t('share.banner.discardConfirm')}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title={t('share.banner.discardTitle')}
        message={t('share.banner.discardMessage')}
        confirmText={t('share.banner.discardConfirm')}
        cancelText="Keep viewing"
        destructive
        onConfirm={handleDiscard}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}
