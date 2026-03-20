/**
 * Share button for the header when collaborative editing flag is enabled.
 * Opens a popover with share link and permission controls.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLabsStore, useLayoutStore, useToastStore } from '@/core/store';
import { useSharedPreviewStore } from '@/core/store/sharedPreview';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import { useCollabMode } from '@/shared/hooks/useCollabMode';
import { useTranslation } from '@/i18n';
import { slugify } from '@/shared/utils/slug';
import type { SharePermission } from '@/core/types';

/** Minimum distance from viewport edge for popover positioning */
const VIEWPORT_PADDING = 16;
/** Popover width in pixels */
const POPOVER_WIDTH = 320;

/**
 * Share button that appears in the header when collaborative_editing flag is enabled.
 * Opens SharePopover on click to manage cloud shares.
 */
export function ShareButton() {
  const t = useTranslation();
  const isFeatureEnabled = useLabsStore((state) => state.isFeatureEnabled('collaborative_editing'));

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Single hook instance shared between button and popover
  const cloudShare = useCloudShare();
  const { hasActiveShare, status } = cloudShare;

  // Check if viewing someone else's shared layout
  const sharedLayoutCloudShareId = useSharedPreviewStore(
    (state) => state.sharedPreview?.cloudShareId ?? null
  );
  const isViewingSharedLayout = !!sharedLayoutCloudShareId;

  // Show shared indicator if we have our own share OR viewing someone else's
  const showSharedIndicator = hasActiveShare || isViewingSharedLayout;
  const isLoading = status === 'sharing' || status === 'updating';

  // Listen for command palette open-share-modal event
  useEffect(() => {
    const handleOpenShare = () => setIsPopoverOpen(true);
    window.addEventListener('open-share-modal', handleOpenShare);
    return () => window.removeEventListener('open-share-modal', handleOpenShare);
  }, []);

  // Don't render if feature flag is disabled
  if (!isFeatureEnabled) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        className={`btn px-4 py-1.5 text-sm font-medium flex items-center gap-2 ${
          showSharedIndicator ? 'btn-secondary' : 'btn-primary'
        }`}
        aria-haspopup="true"
        aria-expanded={isPopoverOpen}
        title={showSharedIndicator ? t('share.button.manageShare') : t('share.button.shareLayout')}
      >
        {/* Loading spinner */}
        {isLoading ? (
          <svg
            className="w-4 h-4 animate-spin motion-reduce:animate-none"
            viewBox="0 0 24 24"
            fill="none"
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
        ) : showSharedIndicator ? (
          /* Shared state icon - checkmark with share */
          <div className="relative">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            {/* Green checkmark badge */}
            <svg
              className="w-2.5 h-2.5 absolute -top-1 -right-1 text-success"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        ) : (
          /* Default share icon */
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
        )}
        {showSharedIndicator ? t('share.button.shared') : t('common.share')}
      </button>

      {isPopoverOpen && (
        <SharePopover
          buttonRef={buttonRef}
          onClose={() => setIsPopoverOpen(false)}
          cloudShare={cloudShare}
        />
      )}
    </>
  );
}

/**
 * Popover that appears below the Share button.
 * Shows share link, permission dropdown, and copy button.
 */
function SharePopover({
  buttonRef,
  onClose,
  cloudShare,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  cloudShare: ReturnType<typeof useCloudShare>;
}) {
  const t = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const layoutName = useLayoutStore((state) => state.layout.name);
  const addToast = useToastStore((state) => state.addToast);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; right: number } | null>(
    null
  );

  // Calculate position with viewport boundary checking
  const calculatePosition = useCallback((): { top: number; right: number } | null => {
    if (!buttonRef.current) return null;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 8;
    let right = viewportWidth - rect.right;

    // Check if popover would overflow right edge
    if (right < VIEWPORT_PADDING) {
      right = VIEWPORT_PADDING;
    }

    // Check if popover would overflow left edge
    const leftEdge = viewportWidth - right - POPOVER_WIDTH;
    if (leftEdge < VIEWPORT_PADDING) {
      right = viewportWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
    }

    // Check if popover would overflow bottom (estimate height ~300px)
    const estimatedHeight = 300;
    if (top + estimatedHeight > viewportHeight - VIEWPORT_PADDING) {
      // Position above the button instead
      top = rect.top - estimatedHeight - 8;
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      }
    }

    return { top, right };
  }, [buttonRef]);

  // Calculate position on mount - this is an acceptable use case for setState
  // in effect because we need the DOM ref which isn't available during render
  useEffect(() => {
    // Calculate initial position after mount when ref is available
    const position = calculatePosition();
    if (position) {
      setPopoverPosition(position);
    }

    const handleResize = () => {
      const newPosition = calculatePosition();
      if (newPosition) {
        setPopoverPosition(newPosition);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculatePosition]);

  // Get shared layout info from shared preview store (when viewing someone else's share)
  const sharedLayoutCloudShareId = useSharedPreviewStore(
    (state) => state.sharedPreview?.cloudShareId ?? null
  );
  const sharedLayoutPermission = useSharedPreviewStore(
    (state) => state.sharedPreview?.permission ?? null
  );
  const isViewingSharedLayout = !!sharedLayoutCloudShareId;

  // Check if we're in collaborative mode (will need to disconnect on delete)
  const { isCollaborative } = useCollabMode();

  // Use the cloudShare hook from parent to avoid duplicate state
  const {
    status,
    existingShare,
    hasActiveShare,
    share,
    updatePermission,
    copyUrl,
    remove,
    error,
    reset,
  } = cloudShare;

  const [urlCopied, setUrlCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Permission from existing share or shared layout (default to 'view' for new shares)
  const serverPermission = isViewingSharedLayout
    ? (sharedLayoutPermission ?? 'view')
    : (existingShare?.permission ?? 'view');

  // Local permission state for new shares (before first share)
  const [localPermission, setLocalPermission] = useState<SharePermission>(serverPermission);

  // Sync local permission when server state changes (e.g., after sharing, or switching layouts)
  useEffect(() => {
    setLocalPermission(serverPermission);
  }, [serverPermission]);

  // Reset copy state after timeout
  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => setUrlCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [urlCopied]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideButton = buttonRef.current?.contains(target);

      if (!isInsidePopover && !isInsideButton) {
        onClose();
      }
    };

    // Use setTimeout to add listener on next tick, avoiding the click that opened the popover
    const frameId = requestAnimationFrame(() => {
      document.addEventListener('click', handleClickOutside);
    });

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose, buttonRef]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleShare = async () => {
    const success = await share(localPermission);
    if (success) {
      setUrlCopied(true);
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyUrl();
    if (success) setUrlCopied(true);
  };

  const handlePermissionChange = async (newPermission: SharePermission) => {
    const oldPermission = localPermission;
    setLocalPermission(newPermission);

    if (hasActiveShare) {
      const success = await updatePermission(newPermission);
      if (success) {
        // Determine if this change affects Liveblocks connection
        const wasEditable = oldPermission === 'edit';
        const isNowEditable = newPermission === 'edit';
        const collabStateChanged = wasEditable !== isNowEditable;

        // Build appropriate message
        let message = `Permission updated to "${newPermission === 'edit' ? 'can edit' : 'view only'}"`;
        if (collabStateChanged) {
          message =
            newPermission === 'edit'
              ? 'Collaboration enabled. Anyone with the link can now edit.'
              : 'Collaboration disabled. Link is now view-only.';
        }

        // Show toast with undo option
        addToast({
          type: 'success',
          message,
          action: {
            label: 'Undo',
            onClick: async () => {
              setLocalPermission(oldPermission);
              await updatePermission(oldPermission);
            },
          },
        });
      }
    }
  };

  const handleDelete = async () => {
    // Track if we were in collaborative mode before deleting
    // (deleting will cause us to exit collaborative mode)
    const wasCollaborative = isCollaborative;

    const success = await remove();
    if (success) {
      addToast({
        type: 'success',
        message: wasCollaborative
          ? 'Share link deleted. Collaboration ended.'
          : 'Share link deleted',
      });
      // Close popover after successful deletion
      onClose();
    }
  };

  // Calculate position below the button with boundary checking
  const popoverStyle: React.CSSProperties = popoverPosition
    ? {
        position: 'fixed',
        top: popoverPosition.top,
        right: popoverPosition.right,
        zIndex: 50,
        width: POPOVER_WIDTH,
      }
    : {
        position: 'fixed',
        top: 60,
        right: 16,
        zIndex: 50,
        width: POPOVER_WIDTH,
      };

  // Determine the share URL - prefer viewing shared layout, then own share
  // Use unified /l/{shareId}/{slug} format
  const shareId = isViewingSharedLayout ? sharedLayoutCloudShareId : existingShare?.id;
  const shareUrl = shareId ? `${window.location.origin}/l/${shareId}/${slugify(layoutName)}` : '';

  // Show as "shared" when viewing a shared layout or when we have our own active share
  const showSharedState = isViewingSharedLayout || hasActiveShare;

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-surface-elevated border border-stroke rounded-lg shadow-lg p-4"
      role="dialog"
      aria-label={t('share.title')}
    >
      {/* Header with layout name and close button */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-content-secondary truncate flex-1 mr-2">{layoutName}</div>
        <button
          onClick={onClose}
          className="text-content-tertiary hover:text-content transition-colors p-1 -m-1"
          aria-label={t('common.close')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Loading state - not shown for 'deleting' since we have inline loading */}
      {(status === 'sharing' || status === 'updating') && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-content-secondary">
            <svg
              className="w-4 h-4 animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
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
            <span className="text-sm">
              {status === 'sharing' ? t('share.cloud.publishing') : t('share.cloud.updating')}
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="space-y-3">
          <div className="text-sm text-error">{error.message}</div>
          <button onClick={reset} className="btn btn-secondary w-full text-sm">
            {t('error.tryAgain')}
          </button>
        </div>
      )}

      {/* Unshared state - only show if not viewing shared layout and no own share */}
      {status === 'idle' && !showSharedState && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={localPermission}
              onChange={(e) => setLocalPermission(e.target.value as SharePermission)}
              className="flex-1 bg-surface text-content text-sm px-3 py-2 rounded border border-stroke"
            >
              <option value="view">{t('share.anyoneWithLinkCanView')}</option>
              <option value="edit">{t('share.anyoneWithLinkCanEdit')}</option>
            </select>
          </div>
          <button onClick={handleShare} className="btn btn-primary w-full text-sm">
            {t('share.createShareLink')}
          </button>
        </div>
      )}

      {/* Shared state - show when viewing shared layout or own share */}
      {/* Also show during 'deleting' so the delete confirmation remains visible */}
      {(status === 'idle' || status === 'success' || status === 'deleting') && showSharedState && (
        <div className="space-y-3">
          {/* Link input and copy button */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={shareUrl}
              readOnly
              onClick={() => inputRef.current?.select()}
              className="flex-1 bg-surface text-content text-xs px-3 py-2 rounded border border-stroke focus:outline-none font-mono truncate"
            />
            <button
              onClick={handleCopyUrl}
              className={`btn px-3 text-sm whitespace-nowrap ${
                urlCopied ? 'btn-secondary text-success' : 'btn-primary'
              }`}
            >
              {urlCopied ? (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {t('common.copied')}
                </span>
              ) : (
                t('common.copy')
              )}
            </button>
          </div>

          {/* Permission display - read-only when viewing someone else's share */}
          {isViewingSharedLayout ? (
            <div className="text-sm text-content-secondary">
              {t('share.anyoneWithLinkCan')}
              {localPermission}
            </div>
          ) : (
            <select
              value={localPermission}
              onChange={(e) => handlePermissionChange(e.target.value as SharePermission)}
              className="w-full bg-surface text-content text-sm px-3 py-2 rounded border border-stroke"
            >
              <option value="view">{t('share.anyoneWithLinkCanView')}</option>
              <option value="edit">{t('share.anyoneWithLinkCanEdit')}</option>
            </select>
          )}

          {/* Delete share option - only for own shares */}
          {!isViewingSharedLayout && hasActiveShare && existingShare && (
            <div className="border-t border-stroke-subtle pt-3 mt-3">
              {!showDeleteConfirm ? (
                <button
                  onClick={(e) => {
                    // Stop propagation to prevent click-outside handler from
                    // detecting this as an outside click (the button gets removed
                    // from DOM when confirmation shows, so contains() would fail)
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="text-sm text-content-tertiary hover:text-error transition-colors"
                >
                  {t('share.deleteShareLink')}
                </button>
              ) : (
                <div className="bg-error/10 border border-error/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-content">
                    Delete this share? The link will stop working.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete();
                      }}
                      disabled={status === 'deleting'}
                      className="btn btn-secondary text-error border-error hover:bg-error hover:text-white text-sm px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {status === 'deleting' ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="w-3 h-3 animate-spin motion-reduce:animate-none"
                            viewBox="0 0 24 24"
                            fill="none"
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
                          Deleting...
                        </span>
                      ) : (
                        t('common.delete')
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(false);
                      }}
                      disabled={status === 'deleting'}
                      className="btn btn-secondary text-sm px-3 py-1.5 disabled:opacity-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done button */}
          <div className="pt-2">
            <button onClick={onClose} className="btn btn-secondary w-full text-sm">
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
