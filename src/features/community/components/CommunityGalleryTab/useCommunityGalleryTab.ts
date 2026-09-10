/** Store selections, derived listing state and handlers behind the gallery tab; the component keeps the markup. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import { useGapFitStore } from '@/core/store/gapFit';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import type { CommunityGalleryTabProps } from '@/shared/types/communityGalleryTab';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import {
  filterAndSortCards,
  hasActiveBrowseFilters,
  useBrowseStore,
} from '../../store/browseStore';
import { useMineStore } from '../../store/mineStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { loadRecentlyViewedIds } from '../../utils/recentlyViewed';
import { computeFacetCounts } from './facetCounts';
import { hasLocalDesigns } from './hasLocalDesigns';
import { SHELF_LANDING_MIN_DESIGNS } from './shelfData';
import { useFilterPanel } from './useFilterPanel';

export { GALLERY_PAGE_SIZE } from '../../store/browseStore';

export const NO_ITEMS: readonly CommunityCardData[] = [];

export function useCommunityGalleryTab({
  onRequestClose,
  onRequestPublish,
  onEditOwnDesign,
  onFilterViewChange,
  surface = 'tab',
}: CommunityGalleryTabProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();

  // 3 on both surfaces: the route's page title and the modal's dialog title
  // are each an h2, so the gallery's own sections nest one level under them.
  const sectionHeadingLevel = 3 as const;

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

  // Nothing loaded means nothing to narrow, and every control in the panel
  // would be a dead one: all counts zero, every category and technique
  // disabled, every size axis with an empty window. The empty state stands on
  // its own instead.
  const filtersAvailable = activeItems.length > 0;
  const filterPanel = useFilterPanel(isMobile, filtersAvailable);
  const panelOpen = filterPanel.open;
  const mobileFiltersOpen = isMobile && panelOpen;

  // The mobile filter view unmounts the grid, so returning from it lands on a
  // fresh scroll container. The offset was banked by handleTogglePanel while
  // the old one was still on screen.
  useEffect(() => {
    if (mobileFiltersOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = useBrowseStore.getState().scrollTop;
  }, [mobileFiltersOpen]);

  // The view is a full takeover of the gallery, so a host with chrome of its
  // own is told to stand down for it rather than sitting above a cramped list.
  useEffect(() => {
    onFilterViewChange?.(mobileFiltersOpen);
  }, [mobileFiltersOpen, onFilterViewChange]);

  const handleTogglePanel = useCallback(() => {
    // Read the offset while the grid is still mounted: once the filter view
    // has replaced it, the node is detached and reports 0.
    const el = scrollRef.current;
    if (el) useBrowseStore.getState().setScrollTop(el.scrollTop);
    filterPanel.toggle();
  }, [filterPanel]);

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

  // Tracked on every scroll rather than read when the detail opens: the
  // overlay collapses the grid's scroll height, and the browser clamps the
  // offset to 0 as a native consequence of that — no assignment to intercept,
  // and by the time an effect runs the offset is already gone.
  const offsetBeforeDetailRef = useRef(0);
  const handleGridScroll = useCallback(() => {
    if (useCommunityDetailStore.getState().request === null) {
      offsetBeforeDetailRef.current = scrollRef.current?.scrollTop ?? 0;
    }
  }, []);

  // Closing a detail returns to the grid, so it returns to where the grid was.
  useEffect(() => {
    if (detailRequest !== null) return;
    const el = scrollRef.current;
    const banked = offsetBeforeDetailRef.current;
    if (el !== null && banked > 0 && el.scrollTop === 0) el.scrollTop = banked;
  }, [detailRequest]);

  // The toolbar's search/category/technique filters still apply within Mine;
  // mineOnly itself is not a predicate (the source switch above handles it).
  const filtered = useMemo(
    () => filterAndSortCards(activeItems, filters, searchLabels, recentIds, fitsGapContext),
    [activeItems, filters, searchLabels, recentIds, fitsGapContext]
  );
  const visible = filtered.slice(0, visibleCount);

  // Six sweeps of the index (capped at 2,000 cards), running nine predicates
  // in total — one per facet, each with that facet's own selection
  // neutralised. Memoised on the same inputs as the grid so a keystroke costs
  // one recount, not one per rendered option.
  const facetCounts = useMemo(
    () =>
      computeFacetCounts({
        items: activeItems,
        filters,
        searchLabels,
        recentIds,
        fitsGapContext,
      }),
    [activeItems, filters, searchLabels, recentIds, fitsGapContext]
  );

  // The landing is for an undirected visit to the public index: it stands down
  // in Mine, over non-ready states, and the moment the visitor states any
  // filter intent.
  const shelvesVisible =
    !mineActive &&
    status === 'ready' &&
    items.length >= SHELF_LANDING_MIN_DESIGNS &&
    fitsGapContext === null &&
    !hasActiveBrowseFilters(filters);

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

  return {
    t,
    sectionHeadingLevel,
    items,
    capped,
    filters,
    fitsGapContext,
    visibleCount,
    clearFilters,
    setAuthor,
    setFitsGapContext,
    showMore,
    mineActive,
    mineEditBusy,
    scrollRef,
    activeStatus,
    activeItems,
    refreshActive,
    filtersAvailable,
    filterPanel,
    panelOpen,
    mobileFiltersOpen,
    handleTogglePanel,
    handleSelect,
    handleSelectAuthor,
    handleMineEdit,
    handleGoToDesigner,
    handleGridScroll,
    filtered,
    visible,
    facetCounts,
    shelvesVisible,
    isInitialLoading,
    isEmptyLibrary,
    isMineEmpty,
    isNoMatches,
    isFitsGapEmpty,
    isLikedEmpty,
    isAuthorEmpty,
    isBlockingError,
    isOffline,
  };
}
