import { useEffect, useRef, useState } from 'react';
import {
  useLayoutStore,
  useToastStore,
  useSharedPreviewStore,
  useSharePopoverStore,
} from '@/core/store';
import type { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import { useCollabMode } from '@/shared/hooks/useCollabMode';
import { useTranslation } from '@/i18n';
import { slugify } from '@/shared/utils/slug';
import type { SharePermission } from '@/core/types';
import { DeleteShareConfirm } from './DeleteShareConfirm';
import { ShareLinkSection } from './ShareLinkSection';
import { usePopoverPosition } from './usePopoverPosition';

const POPOVER_WIDTH = 320;

interface SharePopoverProps {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  cloudShare: ReturnType<typeof useCloudShare>;
}

/**
 * Popover that appears below the Share button.
 * Shows share link, permission dropdown, and copy/delete actions.
 *
 * Open state lives in `useSharePopoverStore` so the command palette can
 * trigger it without coupling features.
 */
export function SharePopover({ buttonRef, cloudShare }: SharePopoverProps) {
  const t = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const layoutName = useLayoutStore((state) => state.layout.name);
  const addToast = useToastStore((state) => state.addToast);
  const onClose = useSharePopoverStore((state) => state.close);
  const popoverPosition = usePopoverPosition(buttonRef, POPOVER_WIDTH);

  const sharedLayoutCloudShareId = useSharedPreviewStore(
    (state) => state.sharedPreview?.cloudShareId ?? null
  );
  const sharedLayoutPermission = useSharedPreviewStore(
    (state) => state.sharedPreview?.permission ?? null
  );
  const isViewingSharedLayout = !!sharedLayoutCloudShareId;

  const { isCollaborative } = useCollabMode();

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

  // Permission from existing share or shared layout (default to 'view' for new shares)
  const serverPermission = isViewingSharedLayout
    ? (sharedLayoutPermission ?? 'view')
    : (existingShare?.permission ?? 'view');

  // Local permission state for new shares (before first share)
  const [localPermission, setLocalPermission] = useState<SharePermission>(serverPermission);
  // Adjust local permission when the server-derived value changes — done during
  // render rather than in an effect, per React docs: a conditional setState in
  // render bails out and re-runs in a single pass, instead of the two-render
  // cascade an effect would produce.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSyncedPermission, setLastSyncedPermission] =
    useState<SharePermission>(serverPermission);
  if (serverPermission !== lastSyncedPermission) {
    setLastSyncedPermission(serverPermission);
    setLocalPermission(serverPermission);
  }

  // Reset copy state after timeout
  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => {
        setUrlCopied(false);
      }, 2000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [urlCopied]);

  // Click outside closes. Defer the listener by one frame so the click that
  // opened the popover doesn't itself trigger a close.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideButton = buttonRef.current?.contains(target);
      if (!isInsidePopover && !isInsideButton) {
        onClose();
      }
    };

    const frameId = requestAnimationFrame(() => {
      document.addEventListener('click', handleClickOutside);
    });

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose, buttonRef]);

  // Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleShare = async () => {
    const success = await share(localPermission);
    if (success) setUrlCopied(true);
  };

  const handleCopyUrl = async () => {
    const success = await copyUrl();
    if (success) setUrlCopied(true);
  };

  const handlePermissionChange = async (newPermission: SharePermission) => {
    const oldPermission = localPermission;
    setLocalPermission(newPermission);

    if (!hasActiveShare) return;

    const success = await updatePermission(newPermission);
    if (!success) return;

    const wasEditable = oldPermission === 'edit';
    const isNowEditable = newPermission === 'edit';
    const collabStateChanged = wasEditable !== isNowEditable;

    let message: string;
    if (collabStateChanged) {
      message = isNowEditable ? t('share.toast.collabEnabled') : t('share.toast.collabDisabled');
    } else {
      message = t('share.toast.permissionUpdated', {
        label: isNowEditable ? t('share.cloud.canEdit') : t('share.cloud.viewOnly'),
      });
    }

    addToast({
      type: 'success',
      message,
      action: {
        label: t('common.undo'),
        onClick: async () => {
          setLocalPermission(oldPermission);
          await updatePermission(oldPermission);
        },
      },
    });
  };

  const handleDelete = async () => {
    const wasCollaborative = isCollaborative;
    const success = await remove();
    if (!success) return;

    addToast({
      type: 'success',
      message: wasCollaborative
        ? t('share.toast.linkDeletedCollabEnded')
        : t('share.toast.linkDeleted'),
    });
    onClose();
  };

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

  // Determine the share URL — prefer viewing shared layout, then own share.
  // Unified /l/{shareId}/{slug} format.
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

      {status === 'error' && error && (
        <div className="space-y-3">
          <div className="text-sm text-error">{error.message}</div>
          <button onClick={reset} className="btn btn-secondary w-full text-sm">
            {t('error.tryAgain')}
          </button>
        </div>
      )}

      {status === 'idle' && !showSharedState && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={localPermission}
              onChange={(e) => {
                setLocalPermission(e.target.value as SharePermission);
              }}
              className="flex-1 bg-surface text-content text-sm px-3 py-2 rounded border border-stroke"
            >
              <option value="view">{t('share.anyoneWithLinkCanView')}</option>
              <option value="edit">{t('share.anyoneWithLinkCanEdit')}</option>
            </select>
          </div>
          <button
            onClick={() => {
              void handleShare();
            }}
            className="btn btn-primary w-full text-sm"
          >
            {t('share.createShareLink')}
          </button>
        </div>
      )}

      {(status === 'idle' || status === 'success' || status === 'deleting') && showSharedState && (
        <div className="space-y-3">
          <ShareLinkSection
            shareUrl={shareUrl}
            urlCopied={urlCopied}
            onCopyUrl={() => {
              void handleCopyUrl();
            }}
            readOnlyPermission={isViewingSharedLayout}
            permission={localPermission}
            onPermissionChange={(next) => {
              void handlePermissionChange(next);
            }}
          />

          {!isViewingSharedLayout && hasActiveShare && existingShare && (
            <div className="border-t border-stroke-subtle pt-3 mt-3">
              <DeleteShareConfirm
                isDeleting={status === 'deleting'}
                onConfirm={() => {
                  void handleDelete();
                }}
              />
            </div>
          )}

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
