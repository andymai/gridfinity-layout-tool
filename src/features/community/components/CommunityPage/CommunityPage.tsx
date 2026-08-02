/**
 * Full-page host for the community gallery at /community, composing the same
 * gallery and detail components the DesignGalleryModal's Community tab uses.
 * The detail view is URL-driven here: /community/d/<id> opens it, opening a
 * card pushes that URL, and closing returns to /community with the gallery's
 * filters and scroll intact (they live in the browse store, not this page).
 * The designer-facing actions arrive as props from the shell composition
 * (App.tsx) so this feature never imports the bin designer.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, IconButton } from '@/design-system';
import { ArrowLeftIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useSessionStore } from '@/core/sync/session/useSession';
import type { CommunityDetailProps } from '@/shared/types/communityDetail';
import type { CommunityGalleryTabProps } from '@/shared/types/communityGalleryTab';
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

const STRIP_DISMISSED_KEY = 'gridfinity-community-strip-dismissed-v1';

function isStripDismissed(): boolean {
  try {
    return localStorage.getItem(STRIP_DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

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
  const {
    communityDesignIdFromUrl,
    communityAuthorIdFromUrl,
    navigateHome,
    openCommunityDesignUrl,
    closeCommunityDesignUrl,
  } = useCommunityRouting();
  const request = useCommunityDetailStore((s) => s.request);
  const hasUnseenDigest = useCommunityDigestStore((s) => s.hasUnseenDeltas);
  const sessionStatus = useSessionStore((s) => s.status);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const authorFilterId = useBrowseStore((s) => s.filters.author?.id ?? null);
  const authorFilterName = useBrowseStore((s) => s.filters.author?.name ?? null);
  const items = useBrowseStore((s) => s.items);

  const [stripDismissed, setStripDismissed] = useState(isStripDismissed);
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

  const handleDesignYourOwn = useCallback(() => {
    window.dispatchEvent(new Event('switch-to-designer'));
  }, []);

  const dismissStrip = useCallback(() => {
    setStripDismissed(true);
    try {
      localStorage.setItem(STRIP_DISMISSED_KEY, '1');
    } catch {
      // Session-only dismissal when storage is unavailable.
    }
  }, []);

  // The route change already unmounts this page when a gallery/detail action
  // switches to the designer; there is no modal to dismiss on this surface.
  const noopClose = useCallback(() => {}, []);

  const showStrip = !stripDismissed && sessionStatus === 'anonymous' && !hadLocalDesigns;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-content">
      <header className="flex shrink-0 items-center gap-2 border-b border-stroke-subtle px-3 py-2 md:px-4">
        <Button
          variant="ghost"
          onClick={navigateHome}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm"
        >
          <ArrowLeftIcon size="sm" />
          {t('community.page.back')}
        </Button>
        <h2 className="text-base font-semibold">
          {t('community.page.title')}
          {hasUnseenDigest && (
            <>
              <span
                aria-hidden="true"
                data-testid="community-digest-dot"
                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent"
              />
              {/* The dot is aria-hidden; without this the news signal is
                  visual-only (GalleryTabBar folds it into the tab label). */}
              <span className="sr-only">{` ${t('binExamples.gallery.tabs.newBadge')}`}</span>
            </>
          )}
        </h2>
      </header>

      {showStrip && (
        <div
          data-testid="community-visitor-strip"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-stroke-subtle bg-surface-secondary px-3 py-2 md:px-4"
        >
          <p className="text-sm text-content-secondary">{t('community.page.strip.text')}</p>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="secondary" className="text-sm" onClick={handleDesignYourOwn}>
              {t('community.page.strip.cta')}
            </Button>
            <IconButton
              aria-label={t('community.page.strip.dismiss')}
              size="sm"
              onClick={dismissStrip}
            >
              <XIcon size="sm" />
            </IconButton>
          </div>
        </div>
      )}

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
