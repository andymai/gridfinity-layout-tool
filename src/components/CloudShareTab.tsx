/**
 * Cloud sharing tab content for ShareModal.
 * Handles creating, updating, and deleting cloud shares.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLibraryStore } from '../store/library';
import { useCloudShare } from '../hooks/useCloudShare';
import type { ShareExpiration } from '../types';

// Calculate days remaining from a timestamp - stable reference time to avoid render issues
function useDaysRemaining(expiresAt: number | undefined): number {
  const [now] = useState(() => Date.now());
  return useMemo(() => {
    if (!expiresAt) return 0;
    const days = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }, [expiresAt, now]);
}

interface CloudShareTabProps {
  layoutId: string;
  onClose: () => void;
  onSwitchToUrlTab: () => void;
}

const EXPIRATION_OPTIONS: { value: ShareExpiration; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

export function CloudShareTab({ layoutId, onClose, onSwitchToUrlTab }: CloudShareTabProps) {
  const lastExpiration = useLibraryStore(
    useShallow((s) => s.library.settings.lastShareExpiration)
  );
  const [expiresInDays, setExpiresInDays] = useState<ShareExpiration>(lastExpiration ?? 30);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

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
    copyDeleteToken,
    reset,
  } = useCloudShare(layoutId);

  // Auto-focus URL on success
  useEffect(() => {
    if (status === 'success' && urlInputRef.current) {
      urlInputRef.current.select();
    }
  }, [status]);

  // Reset copy states after timeout
  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => setUrlCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [urlCopied]);

  useEffect(() => {
    if (tokenCopied) {
      const timer = setTimeout(() => setTokenCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [tokenCopied]);

  const handleShare = async () => {
    await share(expiresInDays);
  };

  const handleUpdate = async () => {
    await update(expiresInDays);
  };

  const handleDelete = async () => {
    const success = await remove();
    if (success) {
      setShowDeleteConfirm(false);
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyUrl();
    if (success) setUrlCopied(true);
  };

  const handleCopyToken = async () => {
    const success = await copyDeleteToken();
    if (success) setTokenCopied(true);
  };

  // Format expiration date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate days remaining using stable time reference
  const daysRemaining = useDaysRemaining(existingShare?.expiresAt);

  // Idle state - no existing share
  if (status === 'idle' && !hasActiveShare) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-content-secondary">
          Share your layout to the cloud for easy sharing. Anyone with the link can import it.
        </p>

        <div className="flex items-center gap-3">
          <label htmlFor="expiration" className="text-sm text-content-secondary whitespace-nowrap">
            Expires after:
          </label>
          <select
            id="expiration"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value) as ShareExpiration)}
            className="bg-surface text-content px-3 py-2 rounded border border-stroke focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button onClick={handleShare} className="btn btn-primary w-full">
          Share to Cloud
        </button>

        <div className="text-xs text-content-tertiary border-t border-stroke-subtle pt-3 mt-3">
          Note: Cloud shares are snapshots. Changes you make locally won't affect the shared version.
        </div>
      </div>
    );
  }

  // Idle state - has existing share
  if (status === 'idle' && hasActiveShare && existingShare) {
    return (
      <div className="space-y-4">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-sm text-content-secondary mb-1">
            Shared on {formatDate(existingShare.sharedAt)}
          </div>
          <div className="text-sm text-content">
            Expires: {formatDate(existingShare.expiresAt)}{' '}
            <span className="text-content-tertiary">
              ({daysRemaining} days remaining)
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleCopyUrl} className="btn btn-primary flex-1">
            {urlCopied ? 'Copied!' : 'Copy Link'}
          </button>
          <div className="relative">
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value) as ShareExpiration)}
              className="btn btn-secondary appearance-none pr-8"
              aria-label="Update expiration"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Update ({opt.label})
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleUpdate} className="btn btn-secondary">
            Update
          </button>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-sm text-content-tertiary hover:text-error transition-colors"
        >
          Delete share
        </button>

        {showDeleteConfirm && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-3 space-y-2">
            <p className="text-sm text-content">
              Are you sure you want to delete this share? The link will stop working.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="btn btn-secondary text-error border-error hover:bg-error hover:text-white"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="text-xs text-content-tertiary border-t border-stroke-subtle pt-3 mt-3">
          Updating will replace the shared version with your current layout. The URL stays the same.
        </div>
      </div>
    );
  }

  // Loading states
  if (status === 'sharing' || status === 'updating' || status === 'deleting') {
    const messages = {
      sharing: 'Uploading layout...',
      updating: 'Updating share...',
      deleting: 'Deleting share...',
    };

    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3 text-content-secondary">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
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
          <span>{messages[status]}</span>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success' && result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-success">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="font-medium">Layout shared successfully!</span>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-content-secondary">Share link:</label>
          <div className="flex gap-2">
            <input
              ref={urlInputRef}
              type="text"
              value={result.url}
              readOnly
              onClick={() => urlInputRef.current?.select()}
              className="flex-1 bg-surface text-content p-3 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button onClick={handleCopyUrl} className="btn btn-primary px-4">
              {urlCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="text-sm text-content-secondary">
          Expires: {result.expiresAt.toLocaleDateString()} ({expiresInDays} days)
        </div>

        <div className="bg-warning-muted border border-warning/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-warning font-medium text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>Delete Token (save this!)</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={result.deleteToken}
              readOnly
              className="flex-1 bg-surface text-content p-2 rounded font-mono text-xs focus:outline-none"
            />
            <button
              onClick={handleCopyToken}
              className="btn btn-secondary px-3 text-sm"
            >
              {tokenCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-content-tertiary">
            Keep this private. Anyone with it can delete your share.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn btn-primary">
            Done
          </button>
          <button onClick={reset} className="btn btn-secondary">
            Share Another
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error' && error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-error">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="font-medium">Failed to share layout</span>
        </div>

        <p className="text-sm text-content-secondary">{error.message}</p>

        <div className="flex gap-3">
          <button onClick={reset} className="btn btn-primary">
            Try Again
          </button>
          <button onClick={onSwitchToUrlTab} className="btn btn-secondary">
            Use Share Link Instead
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
