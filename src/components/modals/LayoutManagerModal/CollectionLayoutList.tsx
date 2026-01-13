/**
 * Collection Layout List - displays layouts in the active collection.
 *
 * Provides actions for:
 * - Switching between collection layouts
 * - Adding current local layout to collection
 * - Removing layouts from collection
 */

import { useState, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../../../store/collection';
import { useLayoutStore } from '../../../store/layout';
import { useToastStore } from '../../../store/toast';
import { useUIStore } from '../../../store/ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { generateCollectionURL } from '../../../utils/url';
import { copyToClipboard } from '../../../utils/storage';
import { createDefaultLayout } from '../../../constants';
import type { CollectionLayoutRef } from '../../../types';

interface CollectionLayoutListProps {
  onSwitch: (layoutId: string) => void;
  onClose: () => void;
}

/**
 * List of layouts in the current collection with management actions.
 */
export function CollectionLayoutList({ onSwitch, onClose }: CollectionLayoutListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    activeCollection,
    activeCollectionLayouts,
    loadingState,
    addLayoutToCollection,
    deleteLayoutFromCollection,
  } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      activeCollectionLayouts: state.activeCollectionLayouts,
      loadingState: state.loadingState,
      addLayoutToCollection: state.addLayoutToCollection,
      deleteLayoutFromCollection: state.deleteLayoutFromCollection,
    }))
  );

  const activeLayoutId = useLayoutStore((state) => state.activeLayoutId);

  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  // Generate share URL
  const shareUrl = activeCollection ? generateCollectionURL(activeCollection.id) : '';

  // Sort layouts: active first, then by modifiedAt
  const sortedLayouts = [...activeCollectionLayouts].sort((a, b) => {
    if (a.id === activeLayoutId) return -1;
    if (b.id === activeLayoutId) return 1;
    return b.modifiedAt - a.modifiedAt;
  });

  const handleCopyUrl = useCallback(async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setUrlCopied(true);
      addToast('Collection link copied!', 'success');
      announceToScreenReader('Collection link copied to clipboard');
      setTimeout(() => setUrlCopied(false), 2000);
    } else {
      addToast('Failed to copy link', 'error');
    }
  }, [shareUrl, addToast, announceToScreenReader]);

  const handleCreateLayout = useCallback(async () => {
    setIsCreating(true);
    const newLayout = createDefaultLayout();
    newLayout.name = 'Untitled';
    const result = await addLayoutToCollection(newLayout);

    if (result.success) {
      addToast(`Created "${result.data.name}" in collection`, 'success');
      announceToScreenReader(`New layout created in collection`);
    } else {
      addToast(result.error.error, 'error');
    }
    setIsCreating(false);
  }, [addLayoutToCollection, addToast, announceToScreenReader]);

  const handleDeleteLayout = useCallback(
    async (layoutId: string) => {
      const layout = activeCollectionLayouts.find((l) => l.id === layoutId);
      const result = await deleteLayoutFromCollection(layoutId);

      if (result.success) {
        addToast(`Removed "${layout?.name}" from collection`, 'success');
        announceToScreenReader(`${layout?.name} removed from collection`);
      } else {
        addToast(result.error.error, 'error');
      }
      setDeleteConfirm(null);
    },
    [deleteLayoutFromCollection, activeCollectionLayouts, addToast, announceToScreenReader]
  );

  const handleSwitch = useCallback(
    (layoutId: string) => {
      if (layoutId !== activeLayoutId) {
        onSwitch(layoutId);
        onClose();
      }
    },
    [activeLayoutId, onSwitch, onClose]
  );

  const isLoading = loadingState === 'loading' || loadingState === 'syncing';
  const layoutToDelete = deleteConfirm
    ? activeCollectionLayouts.find((l) => l.id === deleteConfirm)
    : null;

  return (
    <div className="h-full grid grid-rows-[auto_1fr_auto]">
      {/* Header: Share URL + New Layout Button */}
      <div className="space-y-3 pb-4">
        {/* Share URL */}
        <div className="bg-surface rounded-lg p-3 border border-stroke">
          <label className="text-xs font-medium text-content-secondary mb-1.5 block">
            Share this link to invite others
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-1.5 bg-surface-secondary rounded text-sm text-content font-mono truncate border border-stroke"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              aria-label="Collection share URL"
            />
            <button
              onClick={handleCopyUrl}
              className={`
                px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0
                ${urlCopied
                  ? 'bg-green-600 text-white'
                  : 'bg-accent text-white hover:bg-accent-hover'
                }
              `}
              aria-label="Copy collection URL"
            >
              {urlCopied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* New Layout Button */}
        <button
          onClick={handleCreateLayout}
          disabled={isCreating || isLoading}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
        >
          {isCreating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Layout
            </>
          )}
        </button>
      </div>

      {/* Layout List */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Collection layouts"
        className="overflow-y-auto space-y-2 min-h-0 [scrollbar-gutter:stable]"
      >
        {sortedLayouts.length === 0 && (
          <div className="text-center py-12 text-content-tertiary">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No layouts in collection</p>
            <p className="text-sm mt-1">Add your first layout to share with others</p>
          </div>
        )}

        {sortedLayouts.map((layout) => (
          <CollectionLayoutItem
            key={layout.id}
            layout={layout}
            isActive={layout.id === activeLayoutId}
            isOnlyLayout={sortedLayouts.length <= 1}
            onSelect={() => handleSwitch(layout.id)}
            onDelete={() => setDeleteConfirm(layout.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-stroke text-sm text-content-tertiary">
        {sortedLayouts.length} layout{sortedLayouts.length === 1 ? '' : 's'} in collection
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Remove from collection?"
        message={`"${layoutToDelete?.name}" will be removed from the collection. This cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        destructive
        onConfirm={() => deleteConfirm && handleDeleteLayout(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// ============================================================================
// Collection Layout Item
// ============================================================================

interface CollectionLayoutItemProps {
  layout: CollectionLayoutRef;
  isActive: boolean;
  isOnlyLayout: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function CollectionLayoutItem({
  layout,
  isActive,
  isOnlyLayout,
  onSelect,
  onDelete,
}: CollectionLayoutItemProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div
      role="option"
      aria-selected={isActive}
      onClick={onSelect}
      className={`
        group relative p-3 rounded-lg border cursor-pointer transition-all
        ${isActive
          ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
          : 'border-stroke hover:border-stroke-strong hover:bg-surface-secondary'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail Preview */}
        <div className="flex-shrink-0 w-12 h-12 rounded bg-surface border border-stroke flex items-center justify-center">
          <div className="text-xs text-content-tertiary text-center">
            <div className="font-medium">{layout.preview.drawerWidth}×{layout.preview.drawerDepth}</div>
            <div className="text-[10px]">{layout.preview.binCount} bins</div>
          </div>
        </div>

        {/* Layout Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-content truncate">{layout.name}</span>
            {isActive && (
              <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                Active
              </span>
            )}
          </div>
          <div className="text-xs text-content-tertiary mt-0.5">
            {layout.preview.layerCount} layer{layout.preview.layerCount !== 1 ? 's' : ''} • Modified {formatDate(layout.modifiedAt)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isOnlyLayout}
            className="p-1.5 rounded hover:bg-red-500/10 text-content-tertiary hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={isOnlyLayout ? 'Cannot delete last layout' : 'Remove from collection'}
            aria-label={`Remove ${layout.name} from collection`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
