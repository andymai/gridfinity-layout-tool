/**
 * Share button for the header when collaborative editing flag is enabled.
 * Opens a popover with share link and permission controls.
 */

import { useState, useRef, useEffect } from 'react';
import { useLabsStore } from '../store/labs';
import { useLayoutStore } from '../store/layout';
import { useUIStore } from '../store/ui';
import { useCloudShare } from '../hooks/useCloudShare';
import type { SharePermission } from '../types';

/**
 * Share button that appears in the header when collaborative_editing flag is enabled.
 * Opens SharePopover on click to manage cloud shares.
 */
export function ShareButton() {
  const isFeatureEnabled = useLabsStore((state) =>
    state.isFeatureEnabled('collaborative_editing')
  );

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Don't render if feature flag is disabled
  if (!isFeatureEnabled) {
    return null;
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsPopoverOpen((prev) => !prev)}
        className="btn btn-primary px-4 py-1.5 text-sm font-medium flex items-center gap-2"
        aria-haspopup="true"
        aria-expanded={isPopoverOpen}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        Share
      </button>

      {isPopoverOpen && (
        <SharePopover
          buttonRef={buttonRef}
          onClose={() => setIsPopoverOpen(false)}
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
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const layoutName = useLayoutStore((state) => state.layout.name);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  // Calculate position on mount
  useEffect(() => {
    if (buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
  }, [buttonRef]);

  // Get shared layout info from UI store (when viewing someone else's share)
  const sharedLayoutCloudShareId = useUIStore((state) => state.sharedLayoutCloudShareId);
  const sharedLayoutPermission = useUIStore((state) => state.sharedLayoutPermission);
  const isViewingSharedLayout = !!sharedLayoutCloudShareId;

  const {
    status,
    existingShare,
    hasActiveShare,
    share,
    updatePermission,
    copyUrl,
    error,
    reset,
  } = useCloudShare();

  const [urlCopied, setUrlCopied] = useState(false);

  // Determine the effective permission:
  // - If viewing a shared layout, use that permission
  // - If we have our own share, use that
  // - Otherwise default to 'view'
  const effectivePermission = isViewingSharedLayout
    ? sharedLayoutPermission ?? 'view'
    : existingShare?.permission ?? 'view';

  const [localPermission, setLocalPermission] = useState<SharePermission>(effectivePermission);

  // Sync local permission state with effective permission
  useEffect(() => {
    setLocalPermission(effectivePermission);
  }, [effectivePermission]);

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
    setLocalPermission(newPermission);
    if (hasActiveShare) {
      await updatePermission(newPermission);
    }
  };

  // Calculate position below the button
  const popoverStyle: React.CSSProperties = buttonRect
    ? {
        position: 'fixed',
        top: buttonRect.bottom + 8,
        right: window.innerWidth - buttonRect.right,
        zIndex: 50,
      }
    : {
        position: 'fixed',
        top: 60,
        right: 16,
        zIndex: 50,
      };

  // Determine the share URL - prefer viewing shared layout, then own share
  const shareId = isViewingSharedLayout ? sharedLayoutCloudShareId : existingShare?.id;
  const shareUrl = shareId ? `${window.location.origin}/s/${shareId}` : '';

  // Show as "shared" when viewing a shared layout or when we have our own active share
  const showSharedState = isViewingSharedLayout || hasActiveShare;

  const isLoading = status === 'sharing' || status === 'updating';

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-surface-elevated border border-stroke rounded-lg shadow-lg w-80 p-4"
      role="dialog"
      aria-label="Share layout"
    >
      {/* Layout name */}
      <div className="text-sm text-content-secondary mb-3 truncate">
        {layoutName}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-content-secondary">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
              {status === 'sharing' ? 'Creating link...' : 'Updating...'}
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <div className="space-y-3">
          <div className="text-sm text-error">{error.message}</div>
          <button onClick={reset} className="btn btn-secondary w-full text-sm">
            Try Again
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
              className="flex-1 bg-surface text-content text-sm px-3 py-2 rounded border border-stroke focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="view">Anyone with link can view</option>
              <option value="edit">Anyone with link can edit</option>
            </select>
          </div>
          <button onClick={handleShare} className="btn btn-primary w-full text-sm">
            Create Share Link
          </button>
        </div>
      )}

      {/* Shared state - show when viewing shared layout or own share */}
      {(status === 'idle' || status === 'success') && showSharedState && (
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
              className="btn btn-primary px-3 text-sm whitespace-nowrap"
            >
              {urlCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Permission display - read-only when viewing someone else's share */}
          {isViewingSharedLayout ? (
            <div className="text-sm text-content-secondary">
              Anyone with link can {localPermission}
            </div>
          ) : (
            <select
              value={localPermission}
              onChange={(e) => handlePermissionChange(e.target.value as SharePermission)}
              className="w-full bg-surface text-content text-sm px-3 py-2 rounded border border-stroke focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="view">Anyone with link can view</option>
              <option value="edit">Anyone with link can edit</option>
            </select>
          )}
        </div>
      )}
    </div>
  );
}
