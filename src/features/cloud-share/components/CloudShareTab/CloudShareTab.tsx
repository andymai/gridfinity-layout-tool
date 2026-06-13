/**
 * Cloud sharing tab content for ShareModal.
 * Handles creating, updating, and deleting cloud shares.
 */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import { formatShareDate } from '@/features/cloud-share/utils/cloudShare';
import { Button, Input, Select } from '@/design-system';
import type { SharePermission } from '@/core/types';

interface CloudShareTabProps {
  layoutId: string;
  onClose: () => void;
  onSwitchToUrlTab: () => void;
}

export function CloudShareTab({ layoutId, onClose, onSwitchToUrlTab }: CloudShareTabProps) {
  const t = useTranslation();
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

  // Derive permission from existing share
  const permission: SharePermission = existingShare?.permission ?? 'view';
  // Track local permission for new shares (before first share)
  const [localPermission, setLocalPermission] = useState<SharePermission>(permission);
  // Adjust local permission when the server-derived value changes — done during
  // render rather than in an effect, per React docs: a conditional setState in
  // render bails out and re-runs in a single pass, instead of the two-render
  // cascade an effect would produce.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSyncedPermission, setLastSyncedPermission] = useState<SharePermission>(permission);
  if (permission !== lastSyncedPermission) {
    setLastSyncedPermission(permission);
    setLocalPermission(permission);
  }

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
    await share(localPermission);
  };

  const handlePermissionChange = async (newPermission: SharePermission) => {
    setLocalPermission(newPermission);
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
        <p className="text-sm text-content-secondary">{t('share.cloud.description')}</p>

        <div className="flex items-center gap-3">
          <label htmlFor="permission" className="text-sm text-content-secondary whitespace-nowrap">
            {t('share.cloud.permissionsLabel')}
          </label>
          <Select
            id="permission"
            value={localPermission}
            onValueChange={(value) => setLocalPermission(value as SharePermission)}
            options={[
              { id: 'view', name: t('share.cloud.viewOnly') },
              { id: 'edit', name: t('share.cloud.canEdit') },
            ]}
          />
        </div>

        <Button variant="primary" fullWidth onClick={handleShare}>
          {t('share.cloud.publish')}
        </Button>

        <div className="text-xs text-content-tertiary border-t border-stroke-subtle pt-3 mt-3">
          Note: Cloud shares are snapshots. Changes you make locally won't affect the shared
          version.
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
            {t('share.cloud.lastUpdated', { date: formatShareDate(existingShare.sharedAt) })}
          </div>
          <div className="text-sm text-content">
            {existingShare.permission === 'edit'
              ? t('share.cloud.canEdit')
              : t('share.cloud.viewOnly')}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="primary" onClick={handleCopyUrl} className="flex-1">
            {urlCopied ? t('share.cloud.linkCopied') : t('share.cloud.copyLink')}
          </Button>
          <Select
            value={localPermission}
            onValueChange={(value) => handlePermissionChange(value as SharePermission)}
            options={[
              { id: 'view', name: t('share.cloud.viewOnly') },
              { id: 'edit', name: t('share.cloud.canEdit') },
            ]}
            aria-label={t('share.cloud.permissions')}
          />
        </div>

        <Button
          variant="ghost"
          onClick={() => setShowDeleteConfirm(true)}
          className="px-0 py-0 hover:bg-transparent text-content-tertiary hover:text-error"
        >
          {t('share.cloud.unpublish')}
        </Button>

        {showDeleteConfirm && (
          <div className="bg-error/10 border border-error/30 rounded-lg p-3 space-y-2">
            <p className="text-sm text-content">
              Are you sure you want to delete this share? The link will stop working.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDelete}>
                {t('common.delete')}
              </Button>
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                {t('common.cancel')}
              </Button>
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
      sharing: t('share.cloud.publishing'),
      updating: t('share.cloud.updating'),
      deleting: 'Deleting share...',
    };

    return (
      <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-content-secondary">
          <svg
            className="w-5 h-5 animate-spin motion-reduce:animate-none"
            viewBox="0 0 24 24"
            fill="none"
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">{t('share.cloud.published')}</span>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-content-secondary">{t('share.cloud.shareLink')}</label>
          <div className="flex gap-2">
            <Input
              ref={urlInputRef}
              type="text"
              value={result.url}
              readOnly
              onClick={() => urlInputRef.current?.select()}
              className="font-mono"
              wrapperClassName="flex-1"
              aria-label={t('share.cloud.shareLink')}
            />
            <Button variant="primary" onClick={handleCopyUrl}>
              {urlCopied ? t('share.cloud.linkCopied') : t('common.copy')}
            </Button>
          </div>
        </div>

        <div className="text-sm text-content-secondary">
          {result.permission === 'edit' ? t('share.cloud.canEdit') : t('share.cloud.viewOnly')}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="primary" onClick={onClose}>
            {t('common.done')}
          </Button>
          <Button variant="secondary" onClick={reset}>
            {t('share.shareAnother')}
          </Button>
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
          <span className="font-medium">{t('share.failedToShareLayout')}</span>
        </div>

        <p className="text-sm text-content-secondary">{error.message}</p>

        <div className="flex gap-3">
          <Button variant="primary" onClick={reset}>
            {t('error.tryAgain')}
          </Button>
          <Button variant="secondary" onClick={onSwitchToUrlTab}>
            {t('share.useShareLinkInstead')}
          </Button>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
