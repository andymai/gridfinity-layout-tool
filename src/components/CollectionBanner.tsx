/**
 * Banner shown when viewing a collection.
 * Displays collection name, sync status, and provides quick actions.
 */

import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../store/collection';
import { useToastStore } from '../store/toast';
import { useUIStore } from '../store/ui';
import { useCollectionRouting } from '../hooks/useCollectionRouting';
import { generateCollectionURL } from '../utils/url';
import { copyToClipboard } from '../utils/storage';
import { ConfirmDialog } from './modals/ConfirmDialog';

export function CollectionBanner() {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const { activeCollection, getLayoutCount } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      getLayoutCount: state.getLayoutCount,
    }))
  );

  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);
  const { exitCollection, isSyncing } = useCollectionRouting();

  const handleCopyLink = useCallback(async () => {
    if (!activeCollection) return;

    const url = generateCollectionURL(activeCollection.id);
    const success = await copyToClipboard(url);

    if (success) {
      setCopied(true);
      addToast('Collection link copied!', 'success');
      announceToScreenReader('Collection link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      addToast('Failed to copy link', 'error');
    }
  }, [activeCollection, addToast, announceToScreenReader]);

  const handleLeave = useCallback(() => {
    exitCollection();
    addToast('Left collection', 'info');
    setShowLeaveConfirm(false);
  }, [exitCollection, addToast]);

  // Don't render if not in collection mode
  if (!activeCollection) return null;

  const layoutCount = getLayoutCount();

  return (
    <div
      className="flex items-center justify-between px-4 py-2 bg-accent text-white"
      role="banner"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {/* Collection Icon */}
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>

        {/* Collection Info */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            Collection: <strong>{activeCollection.name}</strong>
          </span>
          <span className="text-xs text-white/70">
            ({layoutCount} layout{layoutCount !== 1 ? 's' : ''})
          </span>

          {/* Sync Status Indicator */}
          {isSyncing && (
            <span className="flex items-center gap-1 text-xs text-white/80">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Syncing...
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Copy Link Button */}
        <button
          onClick={handleCopyLink}
          disabled={copied}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-70 flex items-center gap-1.5"
          aria-label={copied ? 'Link copied' : 'Copy collection link'}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Share Link
            </>
          )}
        </button>

        {/* Leave Button */}
        <button
          onClick={() => setShowLeaveConfirm(true)}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-white/15 hover:bg-white/25 transition-colors"
          aria-label="Leave collection"
        >
          Leave
        </button>
      </div>

      {/* Leave Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLeaveConfirm}
        title="Leave collection?"
        message="You can rejoin anytime using the collection link. Any unsaved changes will be lost."
        confirmText="Leave"
        cancelText="Stay"
        destructive
        onConfirm={handleLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
