/**
 * Banner shown when viewing a collection.
 * Displays collection name, sync status, presence indicators, and provides quick actions.
 */

import { useState, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore } from '../store/collection';
import { useLayoutStore } from '../store/layout';
import { useToastStore } from '../store/toast';
import { useUIStore } from '../store/ui';
import { useCollectionRouting } from '../hooks/useCollectionRouting';
import { useCollectionSync } from '../hooks/useCollectionSync';
import { usePartySync } from '../hooks/usePartySync';
import { generateCollectionURL } from '../utils/url';
import { copyToClipboard } from '../utils/storage';
import { ConfirmDialog } from './modals/ConfirmDialog';
import { ConflictDialog } from './modals/ConflictDialog';
import { CollectionShareDialog } from './modals/CollectionShareDialog';
import type { ConflictResolution } from './modals/ConflictDialog';

export function CollectionBanner() {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const { activeCollection, getLayoutCount } = useCollectionStore(
    useShallow((state) => ({
      activeCollection: state.activeCollection,
      getLayoutCount: state.getLayoutCount,
    }))
  );

  const activeLayoutId = useLayoutStore((state) => state.activeLayoutId);
  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);
  const { exitCollection } = useCollectionRouting();
  const { status, conflict, activeEditors, resolveConflict } = useCollectionSync();

  // Connect to PartyKit for real-time notifications
  // This provides instant updates while useCollectionSync handles push/conflict resolution
  const { isConnected: isRealtimeConnected, totalConnections } = usePartySync();

  // Get active editor count for current layout
  const currentLayoutEditors = activeLayoutId ? activeEditors.get(activeLayoutId) ?? 0 : 0;

  const shareUrl = activeCollection ? generateCollectionURL(activeCollection.id) : '';

  const handleCopyLink = useCallback(async (): Promise<boolean> => {
    if (!activeCollection) return false;

    const success = await copyToClipboard(shareUrl);

    if (success) {
      addToast('Collection link copied!', 'success');
      announceToScreenReader('Collection link copied to clipboard');
      return true;
    } else {
      addToast('Failed to copy link', 'error');
      return false;
    }
  }, [activeCollection, shareUrl, addToast, announceToScreenReader]);

  const handleLeave = useCallback(() => {
    exitCollection();
    addToast('Left collection', 'info');
    setShowLeaveConfirm(false);
  }, [exitCollection, addToast]);

  const handleResolveConflict = useCallback(
    (resolution: ConflictResolution) => {
      resolveConflict(resolution);
      addToast(
        resolution === 'save-both'
          ? 'Saved your changes as a copy'
          : resolution === 'keep-mine'
          ? 'Kept your changes'
          : 'Applied their changes',
        'success'
      );
    },
    [resolveConflict, addToast]
  );

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
          <span className="text-[9px] leading-none text-amber-200/80 bg-amber-500/20 px-1 py-0.5 rounded">experimental</span>
          <span className="text-xs text-white/70">
            ({layoutCount} layout{layoutCount !== 1 ? 's' : ''})
          </span>

          {/* Sync Status Indicator */}
          {status === 'syncing' && (
            <span className="flex items-center gap-1 text-xs text-white/80">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </span>
          )}
          {status === 'synced' && (
            <span className="flex items-center gap-1 text-xs text-white/70">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          {status === 'offline' && (
            <span className="flex items-center gap-1 text-xs text-yellow-200">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              Offline
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-red-200">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sync error
            </span>
          )}

          {/* Connection Mode Indicator */}
          {isRealtimeConnected ? (
            <span
              className="flex items-center gap-1 text-xs text-white/60"
              title={`Real-time sync active${totalConnections > 1 ? ` • ${totalConnections} connected` : ''}`}
            >
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" aria-hidden="true" />
              {totalConnections > 1 ? `${totalConnections} online` : 'Live'}
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-xs text-white/50"
              title="Real-time sync unavailable, using polling (updates every 30s)"
            >
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" aria-hidden="true" />
              Polling
            </span>
          )}

          {/* Presence Indicator - show if others are editing this layout */}
          {currentLayoutEditors > 0 && (
            <span
              className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full"
              title={`${currentLayoutEditors} ${currentLayoutEditors === 1 ? 'person' : 'people'} editing`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {currentLayoutEditors} editing
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Invite Button */}
        <button
          onClick={() => setShowShareDialog(true)}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          aria-label="Invite others to collection"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Invite
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

      {/* Conflict Resolution Dialog */}
      {conflict && (
        <ConflictDialog
          isOpen={true}
          layoutName={conflict.layoutName}
          serverModifiedAt={conflict.serverModifiedAt}
          onResolve={handleResolveConflict}
          onCancel={() => {
            // User cancels - keep conflict state but close dialog
            // They'll need to resolve eventually
          }}
        />
      )}

      {/* Share Dialog */}
      <CollectionShareDialog
        isOpen={showShareDialog}
        collectionName={activeCollection.name}
        shareUrl={shareUrl}
        onClose={() => setShowShareDialog(false)}
        onCopy={handleCopyLink}
      />
    </div>
  );
}
