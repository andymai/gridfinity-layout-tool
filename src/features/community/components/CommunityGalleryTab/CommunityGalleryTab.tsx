import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, EmptyState } from '@/design-system';
import { AlertTriangleIcon, LayoutGridIcon, SearchIcon } from '@/design-system/Icon';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import type { CommunityGalleryTabProps } from '@/shared/types/communityGalleryTab';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { COMMUNITY_INDEX_CAP } from '../../api/client';
import { filterAndSortCards, useBrowseStore } from '../../store/browseStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { loadRecentlyViewedIds } from '../../utils/recentlyViewed';
import { CommunityCard } from '../CommunityCard';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { GalleryToolbar } from './GalleryToolbar';
import { hasLocalDesigns } from './hasLocalDesigns';

export { GALLERY_PAGE_SIZE } from '../../store/browseStore';

const SKELETON_COUNT = 10;

const GRID_CLASS = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4';

function GallerySkeletons() {
  return (
    <div className={GRID_CLASS} aria-hidden="true" data-testid="community-gallery-skeletons">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className="rounded-lg bg-surface-secondary p-2">
          <div className="mb-2 aspect-square rounded bg-surface motion-safe:animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-surface motion-safe:animate-pulse" />
          <div className="mt-1.5 h-3 w-1/2 rounded bg-surface motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function CommunityGalleryTab({
  onRequestClose,
  onRequestPublish,
  surface = 'tab',
}: CommunityGalleryTabProps) {
  const t = useTranslation();

  const { status, items, capped, error, filters, visibleCount } = useBrowseStore(
    useShallow((s) => ({
      status: s.status,
      items: s.items,
      capped: s.capped,
      error: s.error,
      filters: s.filters,
      visibleCount: s.visibleCount,
    }))
  );
  const ensureIndex = useBrowseStore((s) => s.ensureIndex);
  const refreshIndex = useBrowseStore((s) => s.refreshIndex);
  const clearFilters = useBrowseStore((s) => s.clearFilters);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const showMore = useBrowseStore((s) => s.showMore);
  const openDetail = useCommunityDetailStore((s) => s.open);
  const detailRequest = useCommunityDetailStore((s) => s.request);
  const addToast = useToastStore((s) => s.addToast);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent('community_gallery_opened', { surface });
  }, [surface]);

  useEffect(() => {
    void ensureIndex();
  }, [ensureIndex]);

  const reconnectAttempt = useRetryOnReconnect(status === 'error');
  useEffect(() => {
    if (reconnectAttempt > 0) void refreshIndex();
  }, [reconnectAttempt, refreshIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = useBrowseStore.getState().scrollTop;
    return () => {
      if (el) useBrowseStore.getState().setScrollTop(el.scrollTop);
    };
  }, []);

  // The store setters reset scrollTop to 0 on every filter change, but the
  // restore effect above only runs on mount; without this the DOM keeps its
  // old offset over freshly re-filtered results (and the unmount cleanup then
  // persists that stale offset).
  const filtersRestoredRef = useRef(false);
  useEffect(() => {
    if (!filtersRestoredRef.current) {
      filtersRestoredRef.current = true;
      return;
    }
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [filters]);

  const handleSelect = useCallback(
    (card: CommunityCardData) => {
      openDetail(card.id, card);
    },
    [openDetail]
  );

  const handleSelectAuthor = useCallback(
    (card: CommunityCardData) => {
      setAuthor({ id: card.authorPublicId, name: card.authorName });
      trackEvent('community_author_filter_applied', { surface: 'card' });
    },
    [setAuthor]
  );

  const handleGoToDesigner = useCallback(() => {
    // Capture before closing: hasLocalDesigns reads localStorage.
    const publish = hasLocalDesigns() ? onRequestPublish : undefined;
    window.dispatchEvent(new Event('switch-to-designer'));
    onRequestClose();
    if (publish) {
      void publish().then((opened) => {
        if (!opened) addToast(t('community.toast.publishDesignMissing'), 'error');
      });
    }
  }, [addToast, onRequestClose, onRequestPublish, t]);

  const searchLabels = useCallback(
    (card: CommunityCardData) =>
      [t(CATEGORY_LABEL_KEYS[card.category])]
        .concat(card.techniques.map((technique) => t(TECHNIQUE_CONFIG[technique].labelKey)))
        .join(' '),
    [t]
  );

  // Re-read after every detail open/close: opening a detail records it, so
  // the recently-viewed order can change while this component stays mounted.
  const recentIds = useMemo(() => {
    void detailRequest;
    return loadRecentlyViewedIds();
  }, [detailRequest]);

  const filtered = useMemo(
    () => filterAndSortCards(items, filters, searchLabels, recentIds),
    [items, filters, searchLabels, recentIds]
  );
  const visible = filtered.slice(0, visibleCount);

  const isInitialLoading = status === 'loading' && items.length === 0;
  const isEmptyLibrary = status === 'ready' && items.length === 0;
  const isNoMatches = status === 'ready' && items.length > 0 && filtered.length === 0;
  const isLikedEmpty = isNoMatches && filters.likedOnly;
  const isAuthorEmpty = isNoMatches && !filters.likedOnly && filters.author !== null;
  const isBlockingError = status === 'error' && items.length === 0;
  const isOffline =
    isBlockingError &&
    error?.kind === 'network' &&
    typeof navigator !== 'undefined' &&
    !navigator.onLine;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="community-gallery-tab">
      <GalleryToolbar />

      <div
        ref={scrollRef}
        data-testid="community-gallery-scroll"
        className="flex-1 overflow-y-auto scrollbar-thin p-3 md:p-4"
      >
        {status === 'error' && items.length > 0 && (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 text-sm text-content-secondary"
          >
            <span>{t('community.gallery.error.refresh')}</span>
            <Button
              variant="ghost"
              onClick={() => void refreshIndex()}
              className="shrink-0 text-sm"
            >
              {t('community.gallery.error.retry')}
            </Button>
          </div>
        )}

        {isInitialLoading && (
          <>
            <span className="sr-only" role="status">
              {t('community.gallery.loading')}
            </span>
            <GallerySkeletons />
          </>
        )}

        {isOffline && (
          <EmptyState
            icon={<AlertTriangleIcon />}
            iconStyle="circle"
            tint="warning"
            title={t('community.gallery.offline.title')}
            description={t('community.gallery.offline.subtitle')}
            actions={
              <Button variant="secondary" className="min-h-11" onClick={() => void refreshIndex()}>
                {t('community.gallery.error.retry')}
              </Button>
            }
          />
        )}

        {isBlockingError && !isOffline && (
          <EmptyState
            icon={<AlertTriangleIcon />}
            iconStyle="circle"
            tint="error"
            title={t('community.gallery.error.title')}
            actions={
              <Button variant="secondary" className="min-h-11" onClick={() => void refreshIndex()}>
                {t('community.gallery.error.retry')}
              </Button>
            }
          />
        )}

        {isEmptyLibrary && (
          <EmptyState
            icon={<LayoutGridIcon />}
            iconStyle="circle"
            title={t('community.gallery.empty.title')}
            description={t('community.gallery.empty.subtitle')}
            actions={
              <Button variant="primary" className="min-h-11" onClick={handleGoToDesigner}>
                {hasLocalDesigns()
                  ? t('community.gallery.empty.publishCta')
                  : t('community.gallery.empty.designCta')}
              </Button>
            }
          />
        )}

        {isLikedEmpty && (
          <EmptyState
            icon={<HeartGlyph className="h-8 w-8" />}
            iconStyle="circle"
            title={t('community.gallery.likedEmpty.title')}
            description={t('community.gallery.likedEmpty.subtitle')}
          />
        )}

        {isAuthorEmpty && (
          <EmptyState
            icon={<SearchIcon />}
            iconStyle="circle"
            title={t('community.gallery.authorEmpty.title', {
              author:
                filters.author.name !== ''
                  ? filters.author.name
                  : t('community.gallery.authorFallback'),
            })}
            description={t('community.gallery.authorEmpty.subtitle')}
            actions={
              <Button variant="secondary" className="min-h-11" onClick={() => setAuthor(null)}>
                {t('community.gallery.showAllDesigns')}
              </Button>
            }
          />
        )}

        {isNoMatches && !isLikedEmpty && !isAuthorEmpty && (
          <EmptyState
            icon={<SearchIcon />}
            iconStyle="circle"
            title={t('community.gallery.noMatches.title')}
            description={t('community.gallery.noMatches.subtitle')}
            actions={
              <Button variant="secondary" className="min-h-11" onClick={clearFilters}>
                {t('community.gallery.clearFilters')}
              </Button>
            }
          />
        )}

        {visible.length > 0 && (
          <>
            {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
            {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
            <ul role="list" className={GRID_CLASS} aria-label={t('community.gallery.gridLabel')}>
              {visible.map((card, index) => (
                <li key={card.id}>
                  <CommunityCard
                    card={card}
                    onSelect={handleSelect}
                    onSelectAuthor={handleSelectAuthor}
                    index={index}
                  />
                </li>
              ))}
            </ul>
            {visibleCount < filtered.length && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" className="min-h-11" onClick={showMore}>
                  {t('community.gallery.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {(status === 'ready' || items.length > 0) && (
        <div
          aria-live="polite"
          className="flex shrink-0 items-center justify-between gap-2 border-t border-stroke-subtle px-3 py-1.5 text-xs text-content-tertiary"
        >
          <span>{t('community.gallery.countLabel', { count: filtered.length })}</span>
          {capped && (
            <span>
              {t('community.gallery.capNotice', { count: COMMUNITY_INDEX_CAP.toLocaleString() })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
