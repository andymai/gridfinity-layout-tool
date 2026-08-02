import { Suspense } from 'react';
import { Dialog } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import {
  editOriginalCommunityDesign,
  openPublishForActiveDesign,
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

  return (
    <>
      <Dialog.Root
        open
        onClose={onClose}
        size="5xl"
        height="fixed"
        fullScreen="mobile"
        closeOnOverlayClick
      >
        <Dialog.Header
          title={t('binExamples.gallery.title')}
          bordered={!communityEnabled}
          closeAriaLabel={t('common.close')}
        />
        {communityEnabled && (
          <Dialog.SubHeader className="py-0">
            <GalleryTabBar
              activeTab={effectiveTab}
              onTabChange={setActiveTab}
              showNewDot={showNewDot}
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
                  onRequestClose={onClose}
                  onRequestPublish={openPublishForActiveDesign}
                />
              ) : (
                <ExamplesTabContent onRequestClose={onClose} />
              )}
            </Suspense>
          </div>
        </Dialog.Body>
      </Dialog.Root>

      {communityEnabled && detailOpen && (
        <Suspense fallback={null}>
          <CommunityDetail
            onRequestCloseGallery={onClose}
            onRemixDesign={remixCommunityDesign}
            onEditOriginal={editOriginalCommunityDesign}
          />
        </Suspense>
      )}
    </>
  );
}
