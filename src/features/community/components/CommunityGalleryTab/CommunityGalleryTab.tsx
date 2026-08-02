import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, EmptyState } from '@/design-system';
import { AlertTriangleIcon, LayoutGridIcon, SearchIcon } from '@/design-system/Icon';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useGapFitStore } from '@/core/store/gapFit';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import type { CommunityGalleryTabProps } from '@/shared/types/communityGalleryTab';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { COMMUNITY_INDEX_CAP } from '../../api/client';
import {
  filterAndSortCards,
  hasActiveBrowseFilters,
  useBrowseStore,
} from '../../store/browseStore';
import { useMineStore } from '../../store/mineStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { loadRecentlyViewedIds } from '../../utils/recentlyViewed';
import { CommunityCard } from '../CommunityCard';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { formatUnits } from '../CommunityCard/cardDims';
import { MineCard } from '../CommunityCard/MineCard';
import { MineDigestSummary } from '../MineDigestSummary';
import { GalleryToolbar } from './GalleryToolbar';
import { hasLocalDesigns } from './hasLocalDesigns';
import { ShelfLanding } from './ShelfLanding';
import { SHELF_LANDING_MIN_DESIGNS } from './shelfData';

export { GALLERY_PAGE_SIZE } from '../../store/browseStore';

const SKELETON_COUNT = 10;

const NO_ITEMS: readonly CommunityCardData[] = [];

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
  onEditOwnDesign,
  onOwnDesignUnpublished,
  surface = 'tab',
}: CommunityGalleryTabProps) {
  const t = useTranslation();

  const { status, items, capped, error, filters, fitsGapContext, visibleCount } = useBrowseStore(
    useShallow((s) => ({
      status: s.status,
      items: s.items,
      capped: s.capped,
      error: s.error,
      filters: s.filters,
      fitsGapContext: s.fitsGapContext,
      visibleCount: s.visibleCount,
    }))
  );
  const ensureIndex = useBrowseStore((s) => s.ensureIndex);
  const refreshIndex = useBrowseStore((s) => s.refreshIndex);
  const clearFilters = useBrowseStore((s) => s.clearFilters);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const setMineOnly = useBrowseStore((s) => s.setMineOnly);
  const setFitsGapContext = useBrowseStore((s) => s.setFitsGapContext);
  const setSort = useBrowseStore((s) => s.setSort);
  const showMore = useBrowseStore((s) => s.showMore);
  const {
    status: mineStatus,
    items: mineItems,
    error: mineError,
    forUserId: mineForUserId,
  } = useMineStore(
    useShallow((s) => ({
      status: s.status,
      items: s.items,
      error: s.error,
      forUserId: s.forUserId,
    }))
  );
  const ensureMineIndex = useMineStore((s) => s.ensureIndex);
  const refreshMineIndex = useMineStore((s) => s.refreshIndex);
  const openDetail = useCommunityDetailStore((s) => s.open);
  const detailRequest = useCommunityDetailStore((s) => s.request);
  const addToast = useToastStore((s) => s.addToast);
  const sessionStatus = useSessionStore((s) => s.status);
  const sessionUserId = useSessionStore((s) =>
    s.status === 'authenticated' ? (s.user?.userId ?? null) : null
  );

  // The Mine chip is only rendered while authenticated; gating the branch on
  // the session too means a mid-session sign-out falls back to the public
  // view instead of stranding an empty filter with no visible chip.
  const mineActive = filters.mineOnly && sessionStatus === 'authenticated';

  const [mineEditBusy, setMineEditBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent('community_gallery_opened', { surface });
  }, [surface]);

  useEffect(() => {
    void ensureIndex();
  }, [ensureIndex]);

  // Mirror the core gapFit handoff into the browse store on mount: the grid
  // editor cannot import this feature, so it records the gap in
  // core/store/gapFit and this sync applies the dimension bounds plus the
  // best-fit sort.
  // A cleared handoff (gallery closed, bin placed) drops the ambient context
  // on the next mount so the route surface never inherits a stale gap.
  useEffect(() => {
    const constraint = useGapFitStore.getState().constraint;
    const current = useBrowseStore.getState().fitsGapContext;
    if (constraint === null) {
      if (current !== null) setFitsGapContext(null);
      return;
    }
    const unchanged =
      current !== null &&
      current.widthMax === constraint.maxWidth &&
      current.depthMax === constraint.maxDepth &&
      current.maxHeight === constraint.maxHeight &&
      current.gridUnitMm === constraint.gridUnitMm &&
      current.gridUnitMmY === constraint.gridUnitMmY &&
      current.heightUnitMm === constraint.heightUnitMm;
    if (unchanged) return;
    setFitsGapContext({
      widthMax: constraint.maxWidth,
      depthMax: constraint.maxDepth,
      maxHeight: constraint.maxHeight,
      gridUnitMm: constraint.gridUnitMm,
      gridUnitMmY: constraint.gridUnitMmY,
      heightUnitMm: constraint.heightUnitMm,
    });
    setSort('best-fit');
  }, [setFitsGapContext, setSort]);

  useEffect(() => {
    if (mineActive) {
      trackEvent('community_mine_viewed', { surface });
      void ensureMineIndex();
    }
  }, [mineActive, ensureMineIndex, surface]);

  useEffect(() => {
    if (sessionStatus === 'anonymous' && filters.mineOnly) setMineOnly(false);
  }, [sessionStatus, filters.mineOnly, setMineOnly]);

  // An account switch that never passed through the anonymous state (another
  // tab's sign-in broadcast) leaves the previous owner's cards cached until
  // ensureMineIndex clears them; gating on the stamped owner keeps them from
  // painting for the wrong account even for that first render.
  const mineOwnedByViewer = mineForUserId === null || mineForUserId === sessionUserId;
  const activeStatus = mineActive ? (mineOwnedByViewer ? mineStatus : 'loading') : status;
  const activeError = mineActive ? (mineOwnedByViewer ? mineError : null) : error;
  const activeItems = mineActive ? (mineOwnedByViewer ? mineItems : NO_ITEMS) : items;
  const refreshActive = mineActive ? refreshMineIndex : refreshIndex;

  const reconnectAttempt = useRetryOnReconnect(activeStatus === 'error');
  useEffect(() => {
    if (reconnectAttempt > 0) void refreshActive();
  }, [reconnectAttempt, refreshActive]);

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

  const handleMineEdit = useCallback(
    (card: CommunityCardData) => {
      if (onEditOwnDesign === undefined || mineEditBusy) return;
      setMineEditBusy(true);
      void onEditOwnDesign({ id: card.id })
        .then((outcome) => {
          if (outcome === 'opened') {
            window.dispatchEvent(new Event('switch-to-designer'));
            onRequestClose();
            return;
          }
          if (outcome === 'missing') {
            // The lost-local-design trap: no local copy carries this
            // publishedId. The detail view's owner actions (Duplicate as new)
            // are the recovery path, so open it instead of a dead end.
            addToast(t('community.mine.editMissing'), 'info');
            openDetail(card.id, card);
            return;
          }
          addToast(t('community.detail.editOriginalFailed'), 'error');
        })
        .finally(() => {
          setMineEditBusy(false);
        });
    },
    [addToast, mineEditBusy, onEditOwnDesign, onRequestClose, openDetail, t]
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

  // The toolbar's search/category/technique filters still apply within Mine;
  // mineOnly itself is not a predicate (the source switch above handles it).
  const filtered = useMemo(
    () => filterAndSortCards(activeItems, filters, searchLabels, recentIds, fitsGapContext),
    [activeItems, filters, searchLabels, recentIds, fitsGapContext]
  );
  const visible = filtered.slice(0, visibleCount);

  const isInitialLoading = activeStatus === 'loading' && activeItems.length === 0;
  const isEmptyLibrary = !mineActive && status === 'ready' && items.length === 0;
  const isMineEmpty = mineActive && mineStatus === 'ready' && mineItems.length === 0;
  const isNoMatches = activeStatus === 'ready' && activeItems.length > 0 && filtered.length === 0;
  // The ambient gap bound is the likeliest cause of an empty result while it
  // is active, and clearFilters deliberately preserves it, so it needs its
  // own empty state whose action actually clears the gap.
  const isFitsGapEmpty = isNoMatches && fitsGapContext !== null;
  const isLikedEmpty = isNoMatches && !isFitsGapEmpty && filters.likedOnly;
  const isAuthorEmpty =
    isNoMatches && !isFitsGapEmpty && !filters.likedOnly && filters.author !== null;
  const isBlockingError = activeStatus === 'error' && activeItems.length === 0;
  const isOffline =
    isBlockingError &&
    activeError?.kind === 'network' &&
    typeof navigator !== 'undefined' &&
    !navigator.onLine;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="community-gallery-tab">
      <GalleryToolbar />

      {/* Landing affordance for the public index only: hidden in Mine, over
          non-ready states, and once the visitor has stated any filter intent.
          Sits outside the scrollRef div so shelf scrolling never pollutes the
          persisted grid scrollTop. */}
      {!mineActive &&
        status === 'ready' &&
        items.length >= SHELF_LANDING_MIN_DESIGNS &&
        fitsGapContext === null &&
        !hasActiveBrowseFilters(filters) && (
          <ShelfLanding items={items} onSelect={handleSelect} onSelectAuthor={handleSelectAuthor} />
        )}

      <div
        ref={scrollRef}
        data-testid="community-gallery-scroll"
        className="flex-1 overflow-y-auto scrollbar-thin p-3 md:p-4"
      >
        {/* Opening Mine is what consumes the since-last-visit digest, so the
            summary mounts only inside the Mine branch: browsing the public
            grid keeps the deltas unseen. */}
        {mineActive && <MineDigestSummary />}

        {activeStatus === 'error' && activeItems.length > 0 && (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2 text-sm text-content-secondary"
          >
            <span>{t('community.gallery.error.refresh')}</span>
            <Button
              variant="ghost"
              onClick={() => void refreshActive()}
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
              <Button variant="secondary" className="min-h-11" onClick={() => void refreshActive()}>
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
              <Button variant="secondary" className="min-h-11" onClick={() => void refreshActive()}>
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

        {isMineEmpty && (
          <EmptyState
            icon={<LayoutGridIcon />}
            iconStyle="circle"
            title={t('community.gallery.mineEmpty.title')}
            description={t('community.gallery.mineEmpty.subtitle')}
            actions={
              <Button
                variant="primary"
                className="min-h-11"
                onClick={handleGoToDesigner}
                data-testid="community-mine-empty-cta"
              >
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

        {isNoMatches && fitsGapContext !== null && (
          <EmptyState
            icon={<SearchIcon />}
            iconStyle="circle"
            title={t('community.gallery.fitsGapEmpty.title', {
              width: formatUnits(fitsGapContext.widthMax),
              depth: formatUnits(fitsGapContext.depthMax),
            })}
            description={t('community.gallery.fitsGapEmpty.subtitle')}
            actions={
              <Button
                variant="secondary"
                className="min-h-11"
                onClick={() => {
                  setFitsGapContext(null);
                  useGapFitStore.getState().clear();
                }}
                data-testid="community-fits-gap-empty-clear"
              >
                {t('community.gallery.clearFitsGap')}
              </Button>
            }
          />
        )}

        {isNoMatches && !isFitsGapEmpty && !isLikedEmpty && !isAuthorEmpty && (
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
                  {mineActive ? (
                    <MineCard
                      card={card}
                      onSelect={handleSelect}
                      onEdit={handleMineEdit}
                      onUnpublished={onOwnDesignUnpublished}
                      editBusy={mineEditBusy}
                      index={index}
                    />
                  ) : (
                    <CommunityCard
                      card={card}
                      onSelect={handleSelect}
                      onSelectAuthor={handleSelectAuthor}
                      index={index}
                    />
                  )}
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

      {(activeStatus === 'ready' || activeItems.length > 0) && (
        <div
          aria-live="polite"
          className="flex shrink-0 items-center justify-between gap-2 border-t border-stroke-subtle px-3 py-1.5 text-xs text-content-tertiary"
        >
          <span>{t('community.gallery.countLabel', { count: filtered.length })}</span>
          {!mineActive && capped && (
            <span>
              {t('community.gallery.capNotice', { count: COMMUNITY_INDEX_CAP.toLocaleString() })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
