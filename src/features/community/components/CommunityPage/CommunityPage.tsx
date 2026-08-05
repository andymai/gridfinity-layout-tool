/**
 * Full-page host for the community gallery at /community, composing the same
 * gallery and detail components the DesignGalleryModal's Community tab uses.
 * The detail view is URL-driven here: /community/d/<id> opens it, opening a
 * card pushes that URL, and closing returns to /community with the gallery's
 * filters and scroll intact (they live in the browse store, not this page).
 * The designer-facing actions arrive as props from the shell composition
 * (App.tsx) so this feature never imports the bin designer.
 *
 * The page renders under the app's own chrome (ToolSwitcher + support links)
 * rather than a "back to the app" control. Community is a destination in the
 * tool switcher, so there is nothing to go back from, and a visitor who
 * arrived on a shared link sees the whole app rather than a detached gallery.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import type { CommunityDetailProps } from '@/shared/types/communityDetail';
import type { CommunityGalleryTabProps } from '@/shared/types/communityGalleryTab';
import { HeaderSupportLinks } from '@/shared/components/HeaderSupportLinks';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { useResponsive } from '@/shared/hooks';
import {
  getCommunityDesignIdFromUrl,
  syncCommunityAuthorParam,
  useCommunityRouting,
} from '@/shared/hooks/useCommunityRouting';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { useBrowseStore } from '../../store/browseStore';
import { CommunityGalleryTab } from '../CommunityGalleryTab';
import { hasLocalDesigns } from '../CommunityGalleryTab/hasLocalDesigns';

// Lazy for the same reason as in DesignGalleryModal: the detail pulls the GLB
// viewer (three.js), which a plain gallery visit should not have to download.
const CommunityDetail = lazyWithRetry(() =>
  import('../CommunityDetail').then(namedExport('CommunityDetail'))
);

export interface CommunityPageProps {
  onRequestPublish: () => Promise<boolean>;
  onRemixDesign: CommunityDetailProps['onRemixDesign'];
  onEditOriginal: CommunityDetailProps['onEditOriginal'];
  onEditOwnDesign?: CommunityGalleryTabProps['onEditOwnDesign'];
  onOwnDesignUnpublished?: CommunityGalleryTabProps['onOwnDesignUnpublished'];
}

export function CommunityPage({
  onRequestPublish,
  onRemixDesign,
  onEditOriginal,
  onEditOwnDesign,
  onOwnDesignUnpublished,
}: CommunityPageProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const {
    communityDesignIdFromUrl,
    communityAuthorIdFromUrl,
    openCommunityDesignUrl,
    closeCommunityDesignUrl,
  } = useCommunityRouting();
  const request = useCommunityDetailStore((s) => s.request);
  const hasUnseenDigest = useCommunityDigestStore((s) => s.hasUnseenDeltas);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const authorFilterId = useBrowseStore((s) => s.filters.author?.id ?? null);
  const authorFilterName = useBrowseStore((s) => s.filters.author?.name ?? null);
  const items = useBrowseStore((s) => s.items);

  // Read once on mount: the CTA must not change label under the user when a
  // design is saved in another tab mid-visit.
  const [hadLocalDesigns] = useState(hasLocalDesigns);

  // URL -> store: the deep link owns which detail is open, so back/forward
  // and cold visits to /community/d/<id> both resolve through here. The card
  // snapshot (optimistic poster/name) comes from the browse index when the
  // design is already loaded; a cold visit opens by bare id and the detail
  // fetches everything itself.
  useEffect(() => {
    const current = useCommunityDetailStore.getState().request;
    if (communityDesignIdFromUrl !== null) {
      if (current?.designId !== communityDesignIdFromUrl) {
        const card = useBrowseStore.getState().items.find((c) => c.id === communityDesignIdFromUrl);
        useCommunityDetailStore.getState().open(communityDesignIdFromUrl, card);
      }
    } else if (current !== null) {
      useCommunityDetailStore.getState().close();
    }
  }, [communityDesignIdFromUrl]);

  // Store -> URL: a card selection (store open) pushes the deep link; a UI
  // close (Escape, X) pops back to /community. The fresh getState() read
  // guards the cold-visit mount, where the effect above has already opened
  // the store for the id in the URL before this one runs.
  useEffect(() => {
    const urlId = getCommunityDesignIdFromUrl();
    if (request !== null && urlId !== request.designId) {
      openCommunityDesignUrl(request.designId);
    } else if (
      request === null &&
      urlId !== null &&
      useCommunityDetailStore.getState().request === null
    ) {
      closeCommunityDesignUrl();
    }
  }, [request, openCommunityDesignUrl, closeCommunityDesignUrl]);

  // URL -> store: a shared /community?author= link applies the filter. The
  // display name is unknown on a cold visit ('' placeholder); the effect
  // below resolves it once the index holds one of the author's cards.
  useEffect(() => {
    if (communityAuthorIdFromUrl === null) return;
    const current = useBrowseStore.getState().filters.author;
    if (current?.id === communityAuthorIdFromUrl) return;
    const match = useBrowseStore
      .getState()
      .items.find((c) => c.authorPublicId === communityAuthorIdFromUrl);
    setAuthor({ id: communityAuthorIdFromUrl, name: match?.authorName ?? '' });
  }, [communityAuthorIdFromUrl, setAuthor]);

  useEffect(() => {
    if (authorFilterId === null || authorFilterName !== '') return;
    const match = items.find((c) => c.authorPublicId === authorFilterId);
    if (match !== undefined) setAuthor({ id: authorFilterId, name: match.authorName });
  }, [items, authorFilterId, authorFilterName, setAuthor]);

  // Store -> URL: keeps the author view shareable. Skipped while a detail
  // deep link owns the path; re-runs when it closes back to /community.
  useEffect(() => {
    if (communityDesignIdFromUrl !== null) return;
    syncCommunityAuthorParam(authorFilterId);
  }, [authorFilterId, communityDesignIdFromUrl]);

  // Publishing needs the designer mounted: the dialog captures thumbnails and
  // a GLB from the live mesh, which only exists there. So the CTA leaves for
  // the designer first and asks it to publish, exactly as the gallery's empty
  // state does. A visitor with nothing saved yet is just sent to the designer.
  const handlePublish = useCallback(() => {
    window.dispatchEvent(new Event('switch-to-designer'));
    if (hadLocalDesigns) void onRequestPublish();
  }, [hadLocalDesigns, onRequestPublish]);

  // The route change already unmounts this page when a gallery/detail action
  // switches to the designer; there is no modal to dismiss on this surface.
  const noopClose = useCallback(() => {}, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-content">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-stroke-subtle bg-surface-secondary px-3 md:px-4">
        <ToolSwitcher compact={isMobile} iconOnly={isMobile} />
        {!isMobile && (
          <div className="flex items-center gap-1">
            <HeaderSupportLinks />
          </div>
        )}
      </header>

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-stroke-subtle px-3 py-3 md:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">{t('community.page.title')}</h1>
            <Badge tone="info">{t('common.experimental')}</Badge>
            {hasUnseenDigest && (
              <>
                <span
                  aria-hidden="true"
                  data-testid="community-digest-dot"
                  className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                />
                {/* The dot is aria-hidden; without this the news signal is
                    visual-only (GalleryTabBar folds it into the tab label). */}
                <span className="sr-only">{t('binExamples.gallery.tabs.newBadge')}</span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-sm text-content-secondary">{t('community.page.subtitle')}</p>
        </div>
        <Button variant="primary" className="shrink-0 text-sm" onClick={handlePublish}>
          {hadLocalDesigns ? t('community.page.publishCta') : t('community.page.designCta')}
        </Button>
      </div>

      <CommunityGalleryTab
        onRequestClose={noopClose}
        onRequestPublish={onRequestPublish}
        onEditOwnDesign={onEditOwnDesign}
        onOwnDesignUnpublished={onOwnDesignUnpublished}
        surface="route"
      />

      {request !== null && (
        <Suspense fallback={null}>
          <CommunityDetail
            onRequestCloseGallery={noopClose}
            onRemixDesign={onRemixDesign}
            onEditOriginal={onEditOriginal}
            surface="route"
          />
        </Suspense>
      )}
    </div>
  );
}
