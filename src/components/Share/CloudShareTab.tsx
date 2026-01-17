/**
 * Cloud sharing tab content for ShareModal.
 * Handles creating, updating, and deleting cloud shares.
 */

import { useState, useRef, useEffect } from 'react';
import { useCloudShare } from '../../hooks/useCloudShare';
import { formatShareDate } from '../../utils/cloudShare';
import type { SharePermission } from '../../core/types';

interface CloudShareTabProps {
  layoutId: string;
  onClose: () => void;
  onSwitchToUrlTab: () => void;
}

export function CloudShareTab({ layoutId, onClose, onSwitchToUrlTab }: CloudShareTabProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const {
    status,
    result,
    error,
    existingShare,
    hasActiveShare,
    share,
    updatePermission,
    remove,
    copyUrl,
    reset,
  } = useCloudShare(layoutId);

  // Derive permission from existing share (controlled by parent state)
  const permission: SharePermission = existingShare?.permission ?? 'view';
  const setPermission = (newPermission: SharePermission) => {
    if (existingShare && newPermission !== existingShare.permission) {
      updatePermission(newPermission);
    }
  };

  // Auto-focus URL on success
  useEffect(() => {
    if (status === 'success' && urlInputRef.current) {
      urlInputRef.current.select();
    }
  }, [status]);

  // Reset copy state after timeout
  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => setUrlCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [urlCopied]);

  const handleShare = async () => {
    await share(permission);
  };

  const handlePermissionChange = async (newPermission: SharePermission) => {
    setPermission(newPermission);
    if (hasActiveShare) {
      await updatePermission(newPermission);
    }
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

  // Idle state - no existing share
  if (status === 'idle' && !hasActiveShare) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-content-secondary">
          Share your layout to the cloud for easy sharing. Anyone with the link can import it.
        </p>

        <div className="flex items-center gap-3">
          <label htmlFor="permission" className="text-sm text-content-secondary whitespace-nowrap">
            Permission:
          </label>
          <select
            id="permission"
            value={permission}
            onChange={(e) => setPermission(e.target.value as SharePermission)}
            className="bg-surface text-content px-3 py-2 rounded border border-stroke focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="view">Anyone can view</option>
            <option value="edit">Anyone can edit</option>
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
            Shared on {formatShareDate(existingShare.sharedAt)}
          </div>
          <div className="text-sm text-content">
            {existingShare.permission === 'edit'
              ? 'Anyone with the link can edit'
              : 'Anyone with the link can view'}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleCopyUrl} className="btn btn-primary flex-1">
            {urlCopied ? 'Copied!' : 'Copy Link'}
          </button>
          <select
            value={permission}
            onChange={(e) => handlePermissionChange(e.target.value as SharePermission)}
            className="btn btn-secondary"
            aria-label="Update permission"
          >
            <option value="view">View only</option>
            <option value="edit">Can edit</option>
          </select>
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
          Changing permission will update who can access your shared layout.
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
          {result.permission === 'edit'
            ? 'Anyone with the link can edit'
            : 'Anyone with the link can view'}
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
