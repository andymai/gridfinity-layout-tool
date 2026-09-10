import { Button, EmptyState } from '@/design-system';
import { AlertTriangleIcon, LayoutGridIcon, SearchIcon } from '@/design-system/Icon';
import { useGapFitStore } from '@/core/store/gapFit';
import type { CommunityGalleryTabProps } from '@/shared/types/communityGalleryTab';
import { COMMUNITY_INDEX_CAP } from '../../api/client';
import { CommunityCard } from '../CommunityCard';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { formatUnits } from '../CommunityCard/cardDims';
import { MineCard } from '../CommunityCard/MineCard';
import { AuthorSummary } from '../AuthorSummary';
import { MineDigestSummary } from '../MineDigestSummary';
import { FilterRail } from './FilterRail';
import { GalleryToolbar } from './GalleryToolbar';
import { countPanelFilters } from './galleryFilterOptions';
import { hasLocalDesigns } from './hasLocalDesigns';
import { MobileFilterView } from './MobileFilterView';
import { ResultsHeader } from './ResultsHeader';
import { ShelfLanding } from './ShelfLanding';

export { GALLERY_PAGE_SIZE } from '../../store/browseStore';
import { useCommunityGalleryTab } from './useCommunityGalleryTab';

/** Target for the route's skip link; exported so the two cannot drift apart. */
export const GALLERY_RESULTS_ID = 'community-results';

const SKELETON_COUNT = 10;

// Tracks the space available rather than the viewport class: the rail opening
// or closing changes the grid's width without changing the breakpoint, and a
// fixed column count then sizes cards to a width that is no longer there.
// The track minimums are chosen to reproduce the column counts the fixed
// breakpoints gave (2 up to sm, 5 on a 1440 window with the rail open) while
// deriving them from the space actually available: the rail is 240px wide, so
// opening it changes the room for cards without changing the breakpoint.
const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] md:gap-4';

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

export function CommunityGalleryTab(props: CommunityGalleryTabProps) {
  const { onOwnDesignUnpublished } = props;
  const {
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
  } = useCommunityGalleryTab(props);

  if (mobileFiltersOpen) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" data-testid="community-gallery-tab">
        <MobileFilterView
          items={activeItems}
          counts={facetCounts}
          onBack={() => filterPanel.close()}
          headingLevel={sectionHeadingLevel}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="community-gallery-tab">
      <GalleryToolbar
        panelOpen={panelOpen}
        filtersAvailable={filtersAvailable}
        onTogglePanel={handleTogglePanel}
        activeFilterCount={countPanelFilters(filters)}
      />

      <div className="flex min-h-0 min-w-0 flex-1">
        {panelOpen && (
          <FilterRail
            items={activeItems}
            counts={facetCounts}
            onCollapse={() => filterPanel.close()}
            headingLevel={sectionHeadingLevel}
          />
        )}

        {/* One scroller for the landing rails and the grid together. Two of
            them split the height between a permanent band of rails and
            whatever was left for the results, which on a short window was a
            single clipped row of cards.

            min-w-0 on it is load-bearing, not tidying: a flex item defaults to
            min-width:auto, so without it this column refuses to shrink below
            the widest card's min-content and sizes the grid to that instead of
            to the viewport. Because overflow-y-auto makes overflow-x compute to
            auto, the result is a silently side-scrolling grid with columns
            wider than the screen rather than a visibly broken page. */}
        <div
          ref={scrollRef}
          tabIndex={-1}
          onScroll={handleGridScroll}
          data-testid="community-gallery-scroll"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto scrollbar-thin focus-visible:outline-none"
        >
          {shelvesVisible && (
            <ShelfLanding
              items={items}
              onSelect={handleSelect}
              onSelectAuthor={handleSelectAuthor}
            />
          )}

          {/* Everything that frames the results and scrolls away above them.
              empty:hidden rather than a condition on the wrapper: the digest
              summary renders nothing when there are no unseen deltas, which
              nothing out here can know. */}
          <div className="px-3 pt-3 empty:hidden md:px-4 md:pt-4">
            {/* Opening Mine is what consumes the since-last-visit digest, so the
            summary mounts only inside the Mine branch: browsing the public
            grid keeps the deltas unseen. */}
            {mineActive && <MineDigestSummary />}

            {/* Sits above the grid rather than replacing it: the author filter is
            still a gallery view, and the portrait is context for it. */}
            {!mineActive && filters.author !== null && (
              <AuthorSummary
                items={items}
                authorPublicId={filters.author.id}
                authorName={
                  filters.author.name !== ''
                    ? filters.author.name
                    : t('community.gallery.authorFallback')
                }
                indexCapped={capped}
              />
            )}

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
          </div>

          {filtersAvailable && (
            <ResultsHeader
              count={filtered.length}
              // Named only where rails sit above it and the grid needs marking
              // off as its own section. Over a narrowed view the count is the
              // whole story and "All designs" would contradict it.
              title={shelvesVisible ? t('community.gallery.allDesigns') : undefined}
              headingLevel={sectionHeadingLevel}
            />
          )}

          <div
            id={GALLERY_RESULTS_ID}
            // Focusable only as a skip-link destination: without it the jump
            // moves the viewport but leaves focus behind in the filter rail,
            // so the next Tab returns there. It is the grid that carries the
            // id, not the scroller, or the jump would land on the rails the
            // link exists to skip.
            tabIndex={-1}
            className="p-3 focus-visible:outline-none md:p-4"
          >
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
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => void refreshActive()}
                  >
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
                  <Button
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => void refreshActive()}
                  >
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

            {isAuthorEmpty && filters.author !== null && (
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
                <ul
                  role="list"
                  className={GRID_CLASS}
                  aria-label={t('community.gallery.gridLabel')}
                >
                  {visible.map((card, index) => (
                    <li key={card.id} className="min-w-0">
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

            {/* Under the last card rather than pinned to the bottom of the
                gallery: the cap only means anything once you have reached the
                end of what it let through. That includes reaching the end at
                zero results, where "we only loaded the newest N" is the most
                useful thing the gallery can say about a search that found
                nothing. */}
            {!mineActive && capped && visibleCount >= filtered.length && (
              <p className="mt-4 text-center text-xs text-content-tertiary">
                {t('community.gallery.capNotice', {
                  count: COMMUNITY_INDEX_CAP.toLocaleString(),
                })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
