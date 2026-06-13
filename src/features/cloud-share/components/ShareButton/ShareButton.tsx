import { useRef } from 'react';
import { useSharedPreviewStore, useSharePopoverStore } from '@/core/store';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { SharePopover } from './SharePopover';

/**
 * Share button that appears in the header when collaborative_editing flag is enabled.
 * Opens SharePopover via the sharePopover store.
 */
export function ShareButton() {
  const t = useTranslation();
  const isFeatureEnabled = useFeatureFlag('collaborative_editing');

  const isPopoverOpen = useSharePopoverStore((state) => state.isOpen);
  const togglePopover = useSharePopoverStore((state) => state.toggle);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Single hook instance shared between button and popover
  const cloudShare = useCloudShare();
  const { hasActiveShare, status } = cloudShare;

  const sharedLayoutCloudShareId = useSharedPreviewStore(
    (state) => state.sharedPreview?.cloudShareId ?? null
  );
  const isViewingSharedLayout = !!sharedLayoutCloudShareId;

  const showSharedIndicator = hasActiveShare || isViewingSharedLayout;
  const isLoading = status === 'sharing' || status === 'updating';

  if (!isFeatureEnabled) {
    return null;
  }

  return (
    <>
      <Button
        ref={buttonRef}
        variant={showSharedIndicator ? 'secondary' : 'primary'}
        onClick={togglePopover}
        loading={isLoading}
        leftIcon={
          showSharedIndicator ? (
            <div className="relative">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          )
        }
        aria-haspopup="true"
        aria-expanded={isPopoverOpen}
        title={showSharedIndicator ? t('share.button.manageShare') : t('share.button.shareLayout')}
      >
        {showSharedIndicator ? t('share.button.shared') : t('common.share')}
      </Button>

      {isPopoverOpen && <SharePopover buttonRef={buttonRef} cloudShare={cloudShare} />}
    </>
  );
}
