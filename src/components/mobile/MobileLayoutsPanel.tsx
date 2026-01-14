import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/shallow';
import { useUIStore } from '../../store/ui';
import { useLayoutStore } from '../../store/layout';
import { useLibraryStore } from '../../store/library';
import { useLayoutSwitcher } from '../../hooks/useLayoutSwitcher';
import { useCloudShare } from '../../hooks/useCloudShare';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { LayoutThumbnail } from '../LayoutThumbnail';
import { loadLayoutByIdAsync, generateShareableURL, copyToClipboard, downloadLayoutAsFile } from '../../utils/storage';
import { EXPIRATION_OPTIONS, formatShareDate, calculateDaysRemaining } from '../../utils/cloudShare';
import type { LayoutEntry, ShareExpiration } from '../../types';

/**
 * Mobile-optimized layouts panel with larger touch targets and swipe gestures.
 * Displays in BottomSheet for mobile users.
 */
export function MobileLayoutsPanel() {
  const [deleteLayoutId, setDeleteLayoutId] = useState<string | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [cloudShareId, setCloudShareId] = useState<string | null>(null);
  const [renameLayoutId, setRenameLayoutId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Scroll rename input into view when keyboard appears on mobile
  useEffect(() => {
    if (renameLayoutId && renameInputRef.current) {
      // Small delay to allow keyboard to appear
      const timer = setTimeout(() => {
        renameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [renameLayoutId]);

  const {
    activeLayoutId,
    library,
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
  } = useLayoutSwitcher();

  const currentLayout = useLayoutStore((state) => state.layout);

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

  const handleSelectLayout = useCallback(async (layoutId: string) => {
    if (layoutId === activeLayoutId) return;

    const entry = library.entries.find(e => e.id === layoutId);
    const result = await switchLayout(layoutId);
    if (result.success) {
      announceToScreenReader(`Switched to ${entry?.name || 'layout'}`);
      closeMobilePanel();
    }
  }, [activeLayoutId, switchLayout, library.entries, announceToScreenReader, closeMobilePanel]);

  const handleCreateNew = useCallback(async () => {
    const result = await createNewLayout();
    if (result.success) {
      announceToScreenReader('New layout created');
      closeMobilePanel();
    }
  }, [createNewLayout, announceToScreenReader, closeMobilePanel]);

  const handleDuplicate = useCallback(async (layoutId: string) => {
    const entry = library.entries.find(e => e.id === layoutId);
    const result = await duplicateLayout(layoutId);
    if (result.success) {
      announceToScreenReader(`Duplicated ${entry?.name || 'layout'}`);
    }
    setSwipingId(null);
    setSwipeX(0);
  }, [duplicateLayout, library.entries, announceToScreenReader]);

  const handleShare = useCallback((layoutId: string) => {
    setShareMenuId(layoutId);
    setSwipingId(null);
    setSwipeX(0);
  }, []);

  const handleRenameRequest = useCallback((layoutId: string) => {
    const entry = library.entries.find(e => e.id === layoutId);
    setRenameValue(entry?.name || '');
    setRenameLayoutId(layoutId);
    setSwipingId(null);
    setSwipeX(0);
  }, [library.entries]);

  const handleRenameConfirm = useCallback(() => {
    if (!renameLayoutId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameLayout(renameLayoutId, trimmed);
      announceToScreenReader(`Renamed to ${trimmed}`);
    }
    setRenameLayoutId(null);
    setRenameValue('');
  }, [renameLayoutId, renameValue, renameLayout, announceToScreenReader]);

  const handleCopyLink = useCallback(async (layoutId: string) => {
    const entry = library.entries.find(e => e.id === layoutId);
    // For active layout use current state; otherwise load from IndexedDB
    const layout = layoutId === activeLayoutId ? currentLayout : await loadLayoutByIdAsync(layoutId);
    if (layout) {
      const url = generateShareableURL(layout);
      const success = await copyToClipboard(url);
      if (success) {
        announceToScreenReader(`Link copied for ${entry?.name || 'layout'}`);
      }
    }
    setShareMenuId(null);
  }, [activeLayoutId, currentLayout, library.entries, announceToScreenReader]);

  const handleDownload = useCallback(async (layoutId: string) => {
    const entry = library.entries.find(e => e.id === layoutId);
    // For active layout use current state; otherwise load from IndexedDB
    const layout = layoutId === activeLayoutId ? currentLayout : await loadLayoutByIdAsync(layoutId);
    if (layout && entry) {
      downloadLayoutAsFile(layout, `${entry.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`);
      announceToScreenReader('Layout downloaded');
    }
    setShareMenuId(null);
  }, [activeLayoutId, currentLayout, library.entries, announceToScreenReader]);

  const handleCloudShare = useCallback((layoutId: string) => {
    setShareMenuId(null);
    setCloudShareId(layoutId);
  }, []);

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
    // Only allow left swipe (negative values) - 160px for 4 action buttons
    setSwipeX(Math.min(0, Math.max(-160, deltaX)));
  }, [swipingId]);

  const handleTouchEnd = useCallback(() => {
    if (!swipingId) return;
    // If swiped far enough, show actions
    if (swipeX < -80) {
      // Keep the swipe state to show buttons
      setSwipeX(-160);
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
                  onClick={() => handleRenameRequest(entry.id)}
                  className="w-15 flex items-center justify-center bg-amber-600 text-white"
                  aria-label={`Rename ${entry.name}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleShare(entry.id)}
                  className="w-15 flex items-center justify-center bg-green-600 text-white"
                  aria-label={`Share ${entry.name}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
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
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <LayoutThumbnail preview={entry.preview} size={48} />
                    </div>

                    {/* Layout info */}
                    <div className="flex-1 min-w-0">
                      {/* Layout name and active badge */}
                      <div className="flex items-center gap-2">
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
                      <div className="text-xs text-content-tertiary mt-0.5">
                        {formatDate(entry.modifiedAt)}
                      </div>

                      {/* Forked from info */}
                      {entry.forkedFrom && (
                        <div className="text-xs text-content-disabled">
                          Forked from {entry.forkedFrom.name}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {/* Action buttons for active layout */}
                {isActive && (
                  <div className="flex items-center gap-2 px-4 pb-4">
                    <button
                      onClick={() => handleRenameRequest(entry.id)}
                      className="btn btn-secondary flex-1 h-11"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Rename
                    </button>
                    <button
                      onClick={() => handleShare(entry.id)}
                      className="btn btn-secondary flex-1 h-11"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share
                    </button>
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

      {/* Share action sheet - portaled to escape BottomSheet's scrollable container */}
      {shareMenuId && createPortal(
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={() => setShareMenuId(null)}
        >
          <div
            className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-content mb-4">Share Layout</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleCloudShare(shareMenuId)}
                className="w-full flex items-center gap-3 p-4 bg-surface rounded-lg active:bg-surface-hover"
              >
                <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-content">Share to Cloud</div>
                  <div className="text-sm text-content-secondary">Create expiring share link</div>
                </div>
              </button>
              <button
                onClick={() => handleCopyLink(shareMenuId)}
                className="w-full flex items-center gap-3 p-4 bg-surface rounded-lg active:bg-surface-hover"
              >
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-content">Copy Link</div>
                  <div className="text-sm text-content-secondary">URL-encoded (may be long)</div>
                </div>
              </button>
              <button
                onClick={() => handleDownload(shareMenuId)}
                className="w-full flex items-center gap-3 p-4 bg-surface rounded-lg active:bg-surface-hover"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-content">Download JSON</div>
                  <div className="text-sm text-content-secondary">Save as file</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShareMenuId(null)}
              className="w-full mt-4 py-3 text-content-secondary font-medium"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Rename action sheet - portaled to escape BottomSheet's scrollable container */}
      {renameLayoutId && createPortal(
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end"
          onClick={() => {
            setRenameLayoutId(null);
            setRenameValue('');
          }}
        >
          <div
            className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-content mb-4">Rename Layout</h3>
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameConfirm();
                } else if (e.key === 'Escape') {
                  setRenameLayoutId(null);
                  setRenameValue('');
                }
              }}
              className="w-full bg-surface px-4 py-3 rounded-lg border border-stroke focus:border-accent focus:outline-none text-content text-base"
              placeholder="Layout name"
              maxLength={64}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setRenameLayoutId(null);
                  setRenameValue('');
                }}
                className="flex-1 py-3 text-content-secondary font-medium bg-surface rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameConfirm}
                disabled={!renameValue.trim()}
                className="flex-1 py-3 text-white font-medium bg-accent rounded-lg disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Cloud share panel - portaled to escape BottomSheet's scrollable container */}
      {cloudShareId && createPortal(
        <MobileCloudSharePanel
          layoutId={cloudShareId}
          onClose={() => setCloudShareId(null)}
        />,
        document.body
      )}
    </div>
  );
}

/**
 * Mobile cloud share panel component.
 * Handles cloud sharing operations with a mobile-optimized UI.
 */
function MobileCloudSharePanel({
  layoutId,
  onClose,
}: {
  layoutId: string;
  onClose: () => void;
}) {
  const lastExpiration = useLibraryStore(
    useShallow((s) => s.library.settings.lastShareExpiration)
  );

  // Initialize with last used expiration or default to 30 days
  const [expiresInDays, setExpiresInDays] = useState<ShareExpiration>(
    () => lastExpiration ?? 30
  );
  const [urlCopied, setUrlCopied] = useState(false);

  const {
    status,
    result,
    error,
    existingShare,
    hasActiveShare,
    share,
    update,
    remove,
    copyUrl,
    reset,
  } = useCloudShare(layoutId);

  // Reset copy state after timeout
  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => setUrlCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [urlCopied]);

  const handleShare = async () => {
    await share(expiresInDays);
  };

  const handleUpdate = async () => {
    await update(expiresInDays);
  };

  const handleDelete = async () => {
    const success = await remove();
    if (success) {
      onClose();
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyUrl();
    if (success) setUrlCopied(true);
  };

  // Calculate days remaining using stable reference time to avoid render issues
  const [mountTime] = useState(() => Date.now());
  const daysRemaining = existingShare
    ? calculateDaysRemaining(existingShare.expiresAt, mountTime)
    : 0;

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-cloud-share-title"
        className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h3 id="mobile-cloud-share-title" className="text-lg font-semibold text-content">Cloud Share</h3>
        </div>

        {/* Loading states */}
        {(status === 'sharing' || status === 'updating' || status === 'deleting') && (
          <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
            <div className="flex items-center gap-3 text-content-secondary">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>
                {status === 'sharing' && 'Uploading layout...'}
                {status === 'updating' && 'Updating share...'}
                {status === 'deleting' && 'Deleting share...'}
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-error">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="font-medium">Failed to share</span>
            </div>
            <p className="text-sm text-content-secondary">{error.message}</p>
            <button onClick={reset} className="w-full py-3 bg-accent text-white font-medium rounded-lg">
              Try Again
            </button>
          </div>
        )}

        {/* Success state */}
        {status === 'success' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Shared successfully!</span>
            </div>

            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm text-content-secondary mb-2">Link copied to clipboard</p>
              <p className="text-xs text-content-tertiary break-all font-mono">{result.url}</p>
            </div>

            <p className="text-sm text-content-secondary">
              Expires: {result.expiresAt.toLocaleDateString()} ({expiresInDays} days)
            </p>

            <div className="flex gap-2">
              <button onClick={handleCopyUrl} className="flex-1 py-3 bg-accent text-white font-medium rounded-lg">
                {urlCopied ? 'Copied!' : 'Copy Link Again'}
              </button>
              <button onClick={onClose} className="flex-1 py-3 bg-surface text-content font-medium rounded-lg">
                Done
              </button>
            </div>
          </div>
        )}

        {/* Idle state - no existing share */}
        {status === 'idle' && !hasActiveShare && (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              Share your layout to the cloud. Anyone with the link can import it.
            </p>

            <div className="flex items-center gap-3">
              <label htmlFor="mobile-expiration" className="text-sm text-content-secondary whitespace-nowrap">
                Expires after:
              </label>
              <select
                id="mobile-expiration"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value) as ShareExpiration)}
                className="flex-1 bg-surface text-content px-3 py-2 rounded border border-stroke focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button onClick={handleShare} className="w-full py-3 bg-accent text-white font-medium rounded-lg">
              Share to Cloud
            </button>
          </div>
        )}

        {/* Idle state - has existing share */}
        {status === 'idle' && hasActiveShare && existingShare && (
          <div className="space-y-4">
            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm text-content-secondary">
                Shared on {formatShareDate(existingShare.sharedAt)}
              </p>
              <p className="text-sm text-content">
                Expires: {formatShareDate(existingShare.expiresAt)}{' '}
                <span className="text-content-tertiary">({daysRemaining} days)</span>
              </p>
            </div>

            <button onClick={handleCopyUrl} className="w-full py-3 bg-accent text-white font-medium rounded-lg">
              {urlCopied ? 'Copied!' : 'Copy Link'}
            </button>

            <div className="flex items-center gap-3">
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value) as ShareExpiration)}
                className="flex-1 bg-surface text-content px-3 py-2 rounded border border-stroke focus:outline-none"
                aria-label="Update expiration"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button onClick={handleUpdate} className="py-2 px-4 bg-surface text-content font-medium rounded-lg border border-stroke">
                Update
              </button>
            </div>

            <button
              onClick={handleDelete}
              className="w-full py-2 text-sm text-content-tertiary hover:text-error transition-colors"
            >
              Delete share
            </button>
          </div>
        )}

        {/* Cancel button */}
        {status !== 'success' && (
          <button
            onClick={onClose}
            className="w-full mt-4 py-3 text-content-secondary font-medium"
          >
            Cancel
          </button>
        )}
      </div>
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
