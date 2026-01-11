import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore } from '../../store/ui';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import type { LayoutEntry } from '../../types';

/**
 * Mobile-optimized layouts panel with larger touch targets and swipe gestures.
 * Displays in BottomSheet for mobile users.
 */
export function MobileLayoutsPanel() {
  const [deleteLayoutId, setDeleteLayoutId] = useState<string | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);

  const {
    activeLayoutId,
    library,
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
  } = useLayoutSwitcher();

  const { closeMobilePanel, announceToScreenReader } = useUIStore(
    useShallow((state) => ({
      closeMobilePanel: state.closeMobilePanel,
      announceToScreenReader: state.announceToScreenReader,
    }))
  );

  // Sort entries: active first, then by modifiedAt descending
  const sortedEntries = [...library.entries].sort((a, b) => {
    if (a.id === activeLayoutId) return -1;
    if (b.id === activeLayoutId) return 1;
    return b.modifiedAt - a.modifiedAt;
  });

  const handleSelectLayout = useCallback((layoutId: string) => {
    if (layoutId === activeLayoutId) return;

    const entry = library.entries.find(e => e.id === layoutId);
    const result = switchLayout(layoutId);
    if (result.success) {
      announceToScreenReader(`Switched to ${entry?.name || 'layout'}`);
      closeMobilePanel();
    }
  }, [activeLayoutId, switchLayout, library.entries, announceToScreenReader, closeMobilePanel]);

  const handleCreateNew = useCallback(() => {
    const result = createNewLayout();
    if (result.success) {
      announceToScreenReader('New layout created');
      closeMobilePanel();
    }
  }, [createNewLayout, announceToScreenReader, closeMobilePanel]);

  const handleDuplicate = useCallback((layoutId: string) => {
    const entry = library.entries.find(e => e.id === layoutId);
    const result = duplicateLayout(layoutId);
    if (result.success) {
      announceToScreenReader(`Duplicated ${entry?.name || 'layout'}`);
    }
    setSwipingId(null);
    setSwipeX(0);
  }, [duplicateLayout, library.entries, announceToScreenReader]);

  const handleDeleteRequest = useCallback((layoutId: string) => {
    if (library.entries.length <= 1) {
      announceToScreenReader('Cannot delete the only layout');
      return;
    }
    setDeleteLayoutId(layoutId);
    setSwipingId(null);
    setSwipeX(0);
  }, [library.entries.length, announceToScreenReader]);

  const confirmDelete = useCallback(() => {
    if (!deleteLayoutId) return;
    const entry = library.entries.find(e => e.id === deleteLayoutId);
    deleteLayout(deleteLayoutId);
    announceToScreenReader(`${entry?.name || 'Layout'} deleted`);
    setDeleteLayoutId(null);
  }, [deleteLayoutId, deleteLayout, library.entries, announceToScreenReader]);

  // Swipe gesture handling
  const handleTouchStart = useCallback((_e: React.TouchEvent, layoutId: string) => {
    if (layoutId === activeLayoutId) return; // Don't allow swipe on active layout
    setSwipingId(layoutId);
    setSwipeX(0);
  }, [activeLayoutId]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipingId) return;
    const touch = e.touches[0];
    const startX = e.currentTarget.getBoundingClientRect().left;
    const deltaX = touch.clientX - startX - e.currentTarget.clientWidth / 2;
    // Only allow left swipe (negative values)
    setSwipeX(Math.min(0, Math.max(-120, deltaX)));
  }, [swipingId]);

  const handleTouchEnd = useCallback(() => {
    if (!swipingId) return;
    // If swiped far enough, show actions
    if (swipeX < -60) {
      // Keep the swipe state to show buttons
      setSwipeX(-120);
    } else {
      setSwipingId(null);
      setSwipeX(0);
    }
  }, [swipingId, swipeX]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const layoutToDelete = deleteLayoutId ? library.entries.find(e => e.id === deleteLayoutId) : null;

  return (
    <div className="pb-4">
      {/* Layout count */}
      <div className="text-sm text-content-tertiary mb-3">
        {library.entries.length} layout{library.entries.length !== 1 ? 's' : ''}
      </div>

      {/* Layout list */}
      <div className="space-y-2">
        {sortedEntries.map((entry) => {
          const isActive = entry.id === activeLayoutId;
          const isSwiping = swipingId === entry.id;

          return (
            <div
              key={entry.id}
              className="relative overflow-hidden rounded-lg"
            >
              {/* Swipe action buttons (revealed on swipe) */}
              <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
                <button
                  onClick={() => handleDuplicate(entry.id)}
                  className="w-15 flex items-center justify-center bg-blue-600 text-white"
                  aria-label={`Duplicate ${entry.name}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteRequest(entry.id)}
                  className="w-15 flex items-center justify-center bg-red-600 text-white"
                  aria-label={`Delete ${entry.name}`}
                  disabled={library.entries.length <= 1}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Layout card */}
              <div
                className={`relative transition-transform duration-200 ${isActive ? 'bg-surface-hover border-l-4 border-l-accent' : 'bg-surface-elevated border-l-4 border-l-transparent'}`}
                style={{
                  transform: isSwiping ? `translateX(${swipeX}px)` : 'translateX(0)',
                  transitionDuration: isSwiping ? '0ms' : '200ms',
                }}
                onTouchStart={(e) => handleTouchStart(e, entry.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => handleSelectLayout(entry.id)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {/* Layout name and active badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`truncate text-base ${isActive ? 'font-semibold text-content' : 'font-medium text-content'}`}>
                      {entry.name}
                    </span>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 bg-accent text-white rounded flex-shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Preview stats */}
                  <LayoutPreviewInfo entry={entry} />

                  {/* Modified date */}
                  <div className="text-xs text-content-tertiary mt-1">
                    {formatDate(entry.modifiedAt)}
                  </div>

                  {/* Forked from info */}
                  {entry.forkedFrom && (
                    <div className="text-xs text-content-disabled mt-1">
                      Forked from {entry.forkedFrom.name}
                    </div>
                  )}
                </button>

                {/* Action buttons for active layout */}
                {isActive && (
                  <div className="flex items-center gap-2 px-4 pb-4">
                    <button
                      onClick={() => handleDuplicate(entry.id)}
                      className="btn btn-secondary flex-1 h-11"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Duplicate
                    </button>
                  </div>
                )}
              </div>

              {/* Swipe hint for non-active layouts */}
              {!isActive && !isSwiping && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-content-disabled pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new button */}
      <button
        onClick={handleCreateNew}
        className="btn btn-primary w-full mt-4 h-12"
      >
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Layout
      </button>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteLayoutId !== null}
        title="Delete Layout"
        message={`Delete "${layoutToDelete?.name}"? This cannot be undone.`}
        confirmText="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteLayoutId(null)}
      />
    </div>
  );
}

/**
 * Layout preview info showing drawer dimensions, bin count, and layer count.
 */
function LayoutPreviewInfo({ entry }: { entry: LayoutEntry }) {
  const { preview } = entry;

  return (
    <div className="flex items-center gap-3 text-sm text-content-secondary">
      {/* Drawer dimensions */}
      <span className="flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        {preview.drawerWidth}×{preview.drawerDepth}
      </span>

      {/* Bin count */}
      <span>{preview.binCount} bins</span>

      {/* Layer count */}
      {preview.layerCount > 1 && (
        <span>{preview.layerCount} layers</span>
      )}
    </div>
  );
}
