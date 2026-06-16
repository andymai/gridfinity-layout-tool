/**
 * Bottom-sheet UI for the cloud-share flow on mobile.
 *
 * Five visible states drive the layout:
 *   - loading (sharing/updating/deleting): spinner + status label
 *   - error: red banner + retry CTA
 *   - success: green banner + URL display + copy/done CTAs
 *   - idle without active share: permission select + share CTA
 *   - idle with active share: share details + copy CTA + permission update
 *     + delete-share affordance
 */

import { useState, useEffect } from 'react';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import type { CloudShareStatus } from '@/features/cloud-share/hooks/useCloudShare';
import { formatShareDate } from '@/features/cloud-share/utils/cloudShare';
import type { SharePermission } from '@/core/types';
import { useTranslation } from '@/i18n';
import type { TFunction } from '@/i18n';
import { Button } from '@/design-system';
import { SvgIcon, LoadingSpinner, PermissionSelect, ICON_PATHS } from './MobileLayoutsPanelParts';

function getLoadingLabel(status: CloudShareStatus, t: TFunction): string {
  switch (status) {
    case 'sharing':
      return t('mobile.layouts.shareUploading');
    case 'updating':
      return t('mobile.layouts.shareUpdating');
    case 'deleting':
      return t('mobile.layouts.shareDeleting');
    case 'idle':
    case 'success':
    case 'error':
      return '';
  }
}

export function MobileCloudSharePanel({
  layoutId,
  onClose,
}: {
  layoutId: string;
  onClose: () => void;
}) {
  const t = useTranslation();
  const [urlCopied, setUrlCopied] = useState(false);
  const [localPermission, setLocalPermission] = useState<SharePermission>('view');

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

  const permission: SharePermission = existingShare?.permission ?? localPermission;
  const setPermission = (newPermission: SharePermission) => {
    if (existingShare) {
      if (newPermission !== existingShare.permission) {
        void updatePermission(newPermission);
      }
    } else {
      setLocalPermission(newPermission);
    }
  };

  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => setUrlCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [urlCopied]);

  const handleShare = async () => {
    await share(permission);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isLoading = status === 'sharing' || status === 'updating' || status === 'deleting';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-cloud-share-title"
        className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Close on Escape locally, then stop propagation so the window-level
          // keydown listener (registered as a fallback for focus outside the
          // dialog) doesn't fire onClose() a second time.
          if (e.key === 'Escape') {
            onClose();
          }
          e.stopPropagation();
        }}
      >
        <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <SvgIcon path={ICON_PATHS.cloud} className="w-5 h-5 text-purple-500" />
          </div>
          <h3 id="mobile-cloud-share-title" className="text-lg font-semibold text-content">
            {t('mobile.layouts.cloudShare')}
          </h3>
        </div>

        {isLoading && <LoadingSpinner label={getLoadingLabel(status, t)} />}

        {status === 'error' && error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-error">
              <SvgIcon path={ICON_PATHS.close} />
              <span className="font-medium">{t('share.failedToShare')}</span>
            </div>
            <p className="text-sm text-content-secondary">{error.message}</p>
            <Button variant="primary" fullWidth onClick={reset} className="py-3 rounded-lg">
              {t('mobile.layouts.tryAgain')}
            </Button>
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <SvgIcon path={ICON_PATHS.check} />
              <span className="font-medium">{t('share.sharedSuccessfully')}</span>
            </div>

            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm text-content-secondary mb-2">{t('toast.linkCopied')}</p>
              <p className="text-xs text-content-tertiary break-all font-mono">{result.url}</p>
            </div>

            <p className="text-sm text-content-secondary">
              {result.permission === 'edit'
                ? t('mobile.layouts.anyoneCanEdit')
                : t('mobile.layouts.anyoneCanView')}
            </p>

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleCopyUrl} className="flex-1 py-3 rounded-lg">
                {urlCopied ? t('common.copied') : t('mobile.layouts.copyLinkAgain')}
              </Button>
              <Button variant="secondary" onClick={onClose} className="flex-1 py-3 rounded-lg">
                {t('common.done')}
              </Button>
            </div>
          </div>
        )}

        {status === 'idle' && !hasActiveShare && (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">{t('mobile.layouts.shareDescription')}</p>

            <div className="flex items-center gap-3">
              <label
                htmlFor="mobile-permission"
                className="text-sm text-content-secondary whitespace-nowrap"
              >
                {t('mobile.layouts.permission')}
              </label>
              <PermissionSelect
                id="mobile-permission"
                value={permission}
                onChange={setPermission}
              />
            </div>

            <Button variant="primary" fullWidth onClick={handleShare} className="py-3 rounded-lg">
              {t('share.shareToCloud')}
            </Button>
          </div>
        )}

        {status === 'idle' && hasActiveShare && existingShare && (
          <div className="space-y-4">
            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm text-content-secondary">
                {t('mobile.layouts.sharedOn')}
                {formatShareDate(existingShare.sharedAt)}
              </p>
              <p className="text-sm text-content">
                {existingShare.permission === 'edit'
                  ? t('mobile.layouts.anyoneCanEdit')
                  : t('mobile.layouts.anyoneCanView')}
              </p>
            </div>

            <Button variant="primary" fullWidth onClick={handleCopyUrl} className="py-3 rounded-lg">
              {urlCopied ? t('common.copied') : t('share.copyLink')}
            </Button>

            <div className="flex items-center gap-3">
              <PermissionSelect
                value={permission}
                onChange={setPermission}
                ariaLabel={t('mobile.layouts.updatePermission')}
                className="focus:outline-none"
              />
            </div>

            <Button
              variant="ghost"
              fullWidth
              onClick={handleDelete}
              className="py-2 text-sm font-normal text-content-tertiary hover:text-error hover:bg-transparent"
            >
              {t('mobile.layouts.deleteShare')}
            </Button>
          </div>
        )}

        {status !== 'success' && (
          <Button
            variant="ghost"
            fullWidth
            onClick={onClose}
            className="mt-4 py-3 text-content-secondary hover:bg-transparent hover:text-content-secondary"
          >
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
