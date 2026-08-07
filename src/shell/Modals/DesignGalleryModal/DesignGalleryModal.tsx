import { Suspense, useCallback, useEffect, useState } from 'react';
import { Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useGapFitStore } from '@/core/store/gapFit';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import type { CommunityGallerySurface } from '@/shared/types/communityGalleryTab';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import {
  clearLocalPublishedId,
  editOriginalCommunityDesign,
  openPublishForActiveDesign,
  placeCommunityDesignInLayout,
  remixCommunityDesign,
} from './communityDesignerBridge';
import { GalleryTabBar } from './GalleryTabBar';
import { useGalleryTab } from './useGalleryTab';
import type { GalleryTabId } from './useGalleryTab';

// Per-tab lazy chunks: a static import here would pull both features'
// component trees (three.js included) into the shell chunk on first paint.
const ExamplesTabContent = lazyWithRetry(() =>
  import('@/features/bin-designer/components/ExampleGallery').then(
    namedExport('ExampleGalleryContent')
  )
);
const CommunityTabContent = lazyWithRetry(() =>
  import('@/features/community/components/CommunityGalleryTab').then(
    namedExport('CommunityGalleryTab')
  )
);
const CommunityDetail = lazyWithRetry(() =>
  import('@/features/community/components/CommunityDetail').then(namedExport('CommunityDetail'))
);

interface DesignGalleryModalProps {
  onClose: () => void;
}

export function DesignGalleryModal({ onClose }: DesignGalleryModalProps) {
  const t = useTranslation();
  const communityEnabled = useFeatureFlag('community_showcase');
  const { activeTab, setActiveTab, showNewDot } = useGalleryTab();
  const effectiveTab: GalleryTabId = communityEnabled ? activeTab : 'examples';
  const detailOpen = useCommunityDetailStore((s) => s.request !== null);
  // The one-shot "never opened" dot and the unseen-digest dot share the tab
  // bar's single indicator; either signal lights it.
  const hasUnseenDigest = useCommunityDigestStore((s) => s.hasUnseenDeltas);

  // Captured once at mount: the fits-gap entry sets the constraint before
  // opening this modal, and later clears (banner X, placement) must not flip
  // the surface of an already-open gallery.
  const [openedForFitsGap] = useState(() => useGapFitStore.getState().constraint !== null);
  const communitySurface: CommunityGallerySurface = openedForFitsGap ? 'fits_gap' : 'tab';

  // A fits-gap open lands on the Community tab regardless of the stored
  // last-used tab; the user can still switch away afterwards.
  useEffect(() => {
    if (openedForFitsGap && communityEnabled) setActiveTab('community');
  }, [openedForFitsGap, communityEnabled, setActiveTab]);

  // Closing the gallery ends the fits-gap context: without this, the next
  // manual gallery open would silently re-enter it.
  const handleClose = useCallback(() => {
    useGapFitStore.getState().clear();
    onClose();
  }, [onClose]);

  return (
    <>
      <Dialog.Root
        open
        onClose={handleClose}
        size="5xl"
        height="fixed"
        fullScreen="mobile"
        closeOnOverlayClick
      >
        <Dialog.Header
          title={t(
            communityEnabled ? 'binExamples.gallery.title' : 'binExamples.gallery.tabs.examples'
          )}
          bordered
          closeAriaLabel={t('common.close')}
        />
        {communityEnabled && (
          <Dialog.SubHeader className="py-0">
            <GalleryTabBar
              activeTab={effectiveTab}
              onTabChange={setActiveTab}
              showNewDot={showNewDot || hasUnseenDigest}
            />
          </Dialog.SubHeader>
        )}
        <Dialog.Body padding="none" scroll={false}>
          <div
            key={effectiveTab}
            className="flex min-h-0 flex-1 flex-col"
            role={communityEnabled ? 'tabpanel' : undefined}
            // Focusable per APG: during the loading skeleton the panel has no
            // focusable child, so Tab from the active tab needs a landing spot.
            tabIndex={communityEnabled ? 0 : undefined}
            id={communityEnabled ? `gallery-tabpanel-${effectiveTab}` : undefined}
            aria-labelledby={communityEnabled ? `gallery-tab-${effectiveTab}` : undefined}
          >
            <Suspense fallback={<LoadingFallback variant="panel" label={t('loading.gallery')} />}>
              {effectiveTab === 'community' ? (
                <CommunityTabContent
                  onRequestClose={handleClose}
                  onRequestPublish={openPublishForActiveDesign}
                  onEditOwnDesign={editOriginalCommunityDesign}
                  onOwnDesignUnpublished={clearLocalPublishedId}
                  surface={communitySurface}
                />
              ) : (
                <ExamplesTabContent onRequestClose={handleClose} />
              )}
            </Suspense>
          </div>
        </Dialog.Body>
      </Dialog.Root>

      {communityEnabled && detailOpen && (
        <Suspense fallback={null}>
          <CommunityDetail
            onRequestCloseGallery={handleClose}
            onRemixDesign={remixCommunityDesign}
            onEditOriginal={editOriginalCommunityDesign}
            onPlaceInLayout={placeCommunityDesignInLayout}
            surface={communitySurface}
          />
        </Suspense>
      )}
    </>
  );
}
