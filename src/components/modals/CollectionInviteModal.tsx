/**
 * Modal shown when a user visits a collection URL directly.
 * Prompts them to join the collection rather than auto-joining.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { useCollectionStore, type PendingCollectionInvite } from '../../store/collection';
import { useToastStore } from '../../store/toast';
import { useUIStore } from '../../store/ui';
import { clearCollectionURL, setCollectionURL } from '../../utils/url';
import { getCollectionErrorMessage } from '../../api/collection';

interface CollectionInviteModalProps {
  invite: PendingCollectionInvite;
}

export function CollectionInviteModal({ invite }: CollectionInviteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const { clearPendingInvite, acceptPendingInvite, loadingState } = useCollectionStore(
    useShallow((state) => ({
      clearPendingInvite: state.clearPendingInvite,
      acceptPendingInvite: state.acceptPendingInvite,
      loadingState: state.loadingState,
    }))
  );

  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  const isLoading = invite.collectionInfo === null;
  const hasError = invite.error !== undefined;
  const isJoining = loadingState === 'loading';

  // Focus modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleDismiss = useCallback(() => {
    clearPendingInvite();
    clearCollectionURL();
    announceToScreenReader('Collection invite dismissed');
  }, [clearPendingInvite, announceToScreenReader]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isJoining) {
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isJoining, handleDismiss]);

  const handleJoin = useCallback(async () => {
    const result = await acceptPendingInvite();

    if (result.success) {
      setCollectionURL(invite.collectionId, invite.viewOnly, true);
      addToast(`Joined collection: ${result.data.name}`, 'success');
      announceToScreenReader(`Joined collection: ${result.data.name}`);
    } else {
      addToast(getCollectionErrorMessage(result.error), 'error');
    }
  }, [acceptPendingInvite, invite.collectionId, invite.viewOnly, addToast, announceToScreenReader]);

  const formatExpiryDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.ceil((timestamp - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return 'Expired';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else if (diffDays < 7) {
      return `Expires in ${diffDays} days`;
    } else if (diffDays < 30) {
      return `Expires in ${Math.ceil(diffDays / 7)} weeks`;
    } else {
      return `Expires ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in"
      onClick={handleDismiss}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        tabIndex={-1}
        className="bg-surface-elevated rounded-xl p-6 max-w-md w-full mx-4 animate-scale-in focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h2 id="invite-title" className="text-xl font-bold text-content">
              Join Collection?
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            disabled={isJoining}
            className="p-1 text-content-secondary hover:text-content transition-colors rounded hover:bg-surface disabled:opacity-50"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="py-8 text-center">
            <svg className="w-8 h-8 animate-spin mx-auto text-accent" fill="none" viewBox="0 0 24 24">
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="mt-3 text-content-secondary">Loading collection...</p>
          </div>
        )}

        {hasError && (
          <div className="py-6">
            <div className="bg-error/10 border border-error/20 rounded-lg p-4 text-center">
              <svg
                className="w-10 h-10 mx-auto text-error mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-error font-medium">Collection Not Found</p>
              <p className="text-sm text-content-secondary mt-1">
                {invite.error || 'This collection may have been deleted or expired.'}
              </p>
            </div>
          </div>
        )}

        {invite.collectionInfo && (
          <div className="space-y-4">
            <p className="text-content-secondary">
              You've been invited to join a shared collection:
            </p>

            {/* Collection Info Card */}
            <div className="bg-surface rounded-lg p-4 border border-stroke">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-content-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-content truncate">
                    {invite.collectionInfo.name}
                  </h3>
                  <div className="text-sm text-content-secondary mt-1 space-y-0.5">
                    <p>
                      {invite.collectionInfo.layoutCount} layout
                      {invite.collectionInfo.layoutCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-content-tertiary">
                      {formatExpiryDate(invite.collectionInfo.expiresAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-content-tertiary">
              Joining lets you view, create, and edit layouts in this collection.
              Anyone with the link can access this collection.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleDismiss}
            disabled={isJoining}
            className="px-4 py-2 text-sm font-medium rounded-md text-content-secondary hover:text-content hover:bg-surface transition-colors disabled:opacity-50"
          >
            No Thanks
          </button>
          {invite.collectionInfo && (
            <button
              onClick={handleJoin}
              disabled={isJoining || hasError}
              className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isJoining ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Joining...
                </>
              ) : (
                'Join Collection'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
