import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge, Button, IconButton, Input, Select, cn } from '@/design-system';
import { SearchIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useGapFitStore } from '@/core/store/gapFit';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import { useResponsive } from '@/shared/hooks/useResponsive';
import {
  hasActiveBrowseFilters,
  hasDimensionConstraints,
  useBrowseStore,
} from '../../store/browseStore';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { formatUnits } from '../CommunityCard/cardDims';
import { CommunitySignInPrompt } from '../SignInPrompt';
import { FilterSheet } from './FilterSheet';
import { summariseDimensionFilters } from './dimensionSummary';
import { browseSortOptions, isBrowseSort } from './galleryFilterOptions';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';

function UserGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.121 17.804A9 9 0 0112 15a9 9 0 016.879 2.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function GalleryToolbar() {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [likedSignInOpen, setLikedSignInOpen] = useState(false);

  const { filters, fitsGapContext } = useBrowseStore(
    useShallow((s) => ({ filters: s.filters, fitsGapContext: s.fitsGapContext }))
  );
  const setSearchText = useBrowseStore((s) => s.setSearchText);
  const setCategory = useBrowseStore((s) => s.setCategory);
  const setTechnique = useBrowseStore((s) => s.setTechnique);
  const setSort = useBrowseStore((s) => s.setSort);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const setLikedOnly = useBrowseStore((s) => s.setLikedOnly);
  const setRecentOnly = useBrowseStore((s) => s.setRecentOnly);
  const setFeaturedOnly = useBrowseStore((s) => s.setFeaturedOnly);
  const setMineOnly = useBrowseStore((s) => s.setMineOnly);
  const setWidthMin = useBrowseStore((s) => s.setWidthMin);
  const setWidthMax = useBrowseStore((s) => s.setWidthMax);
  const setDepthMin = useBrowseStore((s) => s.setDepthMin);
  const setDepthMax = useBrowseStore((s) => s.setDepthMax);
  const setMaxHeight = useBrowseStore((s) => s.setMaxHeight);
  const setFitsGapContext = useBrowseStore((s) => s.setFitsGapContext);
  const clearFilters = useBrowseStore((s) => s.clearFilters);
  const sessionStatus = useSessionStore((s) => s.status);
  const signedIn = sessionStatus === 'authenticated';

  // Clearing the banner ends the whole fits-gap context, core handoff
  // included: browsing returns to normal and the detail view's "Place in
  // layout" action disappears with it.
  const handleClearFitsGap = useCallback(() => {
    setFitsGapContext(null);
    useGapFitStore.getState().clear();
  }, [setFitsGapContext]);

  const activeSheetFilterCount =
    (filters.category !== null ? 1 : 0) +
    (filters.technique !== null ? 1 : 0) +
    (filters.widthMin !== null ? 1 : 0) +
    (filters.widthMax !== null ? 1 : 0) +
    (filters.depthMin !== null ? 1 : 0) +
    (filters.depthMax !== null ? 1 : 0) +
    (filters.maxHeight !== null ? 1 : 0);
  const hasActiveFilters = hasActiveBrowseFilters(filters);
  const bestFitAvailable = hasDimensionConstraints(filters) || fitsGapContext !== null;

  const chipClass = (active: boolean): string =>
    cn(
      'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150',
      active
        ? 'bg-accent text-on-dark shadow-sm hover:bg-accent hover:text-on-dark'
        : 'bg-surface text-content-secondary hover:bg-surface-hover hover:text-content'
    );

  const authorLabel =
    filters.author !== null && filters.author.name !== ''
      ? filters.author.name
      : t('community.gallery.authorFallback');

  const dimensionSummary = summariseDimensionFilters(filters, {
    width: t('community.gallery.widthAbbrev'),
    depth: t('community.gallery.depthAbbrev'),
    height: t('community.gallery.heightAbbrev'),
  });

  const clearDimensions = () => {
    setWidthMin(null);
    setWidthMax(null);
    setDepthMin(null);
    setDepthMax(null);
    setMaxHeight(null);
  };

  // Category, technique and size live behind the filter disclosure now, so
  // each active one needs a chip out here. Otherwise closing the panel hides
  // the reason the grid is short, and a filtered gallery reads as an empty
  // one.
  const activeFilterChips = (
    <>
      {filters.category !== null && (
        <Badge
          tone="accent"
          shape="pill"
          size="sm"
          className="inline-flex items-center gap-1"
          data-testid="community-category-chip"
        >
          {t(CATEGORY_LABEL_KEYS[filters.category])}
          <IconButton
            aria-label={t('community.gallery.clearCategoryFilter')}
            size="sm"
            touchTarget={isMobile}
            onClick={() => setCategory(null)}
          >
            <XIcon className="h-3 w-3" />
          </IconButton>
        </Badge>
      )}
      {filters.technique !== null && (
        <Badge
          tone="accent"
          shape="pill"
          size="sm"
          className="inline-flex items-center gap-1"
          data-testid="community-technique-chip"
        >
          {t(TECHNIQUE_CONFIG[filters.technique].labelKey)}
          <IconButton
            aria-label={t('community.gallery.clearTechniqueFilter')}
            size="sm"
            touchTarget={isMobile}
            onClick={() => setTechnique(null)}
          >
            <XIcon className="h-3 w-3" />
          </IconButton>
        </Badge>
      )}
      {dimensionSummary !== null && (
        <Badge
          tone="accent"
          shape="pill"
          size="sm"
          className="inline-flex items-center gap-1"
          data-testid="community-size-chip"
        >
          {dimensionSummary}
          <IconButton
            aria-label={t('community.gallery.clearSizeFilter')}
            size="sm"
            touchTarget={isMobile}
            onClick={clearDimensions}
          >
            <XIcon className="h-3 w-3" />
          </IconButton>
        </Badge>
      )}
    </>
  );

  const filterChips = (
    <div className="flex flex-wrap items-center gap-2">
      {fitsGapContext !== null && (
        <Badge
          tone="accent"
          shape="pill"
          size="sm"
          className="inline-flex items-center gap-1"
          data-testid="community-fits-gap-chip"
        >
          {t('community.gallery.fitsGapBanner', {
            width: formatUnits(fitsGapContext.widthMax),
            depth: formatUnits(fitsGapContext.depthMax),
          })}
          <IconButton
            aria-label={t('community.gallery.clearFitsGap')}
            size="sm"
            touchTarget={isMobile}
            onClick={handleClearFitsGap}
          >
            <XIcon className="h-3 w-3" />
          </IconButton>
        </Badge>
      )}
      {/* featuredOnly has no toolbar toggle of its own (the shelf landing's
          "See all Staff picks" sets it), so while active it needs a visible,
          clearable chip or the narrowed state is invisible. */}
      {filters.featuredOnly && (
        <Badge
          tone="accent"
          shape="pill"
          size="sm"
          className="inline-flex items-center gap-1"
          data-testid="community-featured-chip"
        >
          {t('community.shelves.staffPicks')}
          <IconButton
            aria-label={t('community.gallery.clearFeaturedFilter')}
            size="sm"
            touchTarget={isMobile}
            onClick={() => setFeaturedOnly(false)}
          >
            <XIcon className="h-3 w-3" />
          </IconButton>
        </Badge>
      )}
      {/* No signed-out prompt branch, unlike Liked: a signed-out visitor
          structurally has no published designs, so the chip simply is not
          rendered. */}
      {signedIn && (
        <Button
          variant="ghost"
          aria-pressed={filters.mineOnly}
          onClick={() => setMineOnly(!filters.mineOnly)}
          className={chipClass(filters.mineOnly)}
          data-testid="community-mine-chip"
        >
          <UserGlyph />
          {t('community.gallery.mineFilter')}
        </Button>
      )}
      <Button
        variant="ghost"
        aria-pressed={filters.likedOnly}
        onClick={() => {
          // Signed out, the chip explains itself via the sign-in prompt (the
          // like/report pattern): a disabled control with only a title
          // tooltip is an unexplained dead control on touch devices.
          if (!signedIn) {
            trackEvent('community_signin_prompt_shown', { intent: 'liked-filter' });
            setLikedSignInOpen(true);
            return;
          }
          setLikedOnly(!filters.likedOnly);
        }}
        className={chipClass(filters.likedOnly)}
        data-testid="community-liked-chip"
      >
        <HeartGlyph filled={filters.likedOnly} />
        {t('community.gallery.likedFilter')}
      </Button>
      <CommunitySignInPrompt
        open={likedSignInOpen}
        message={t('community.gallery.likedFilterSignedOut')}
        onClose={() => setLikedSignInOpen(false)}
      />
      <Button
        variant="ghost"
        aria-pressed={filters.recentOnly}
        onClick={() => setRecentOnly(!filters.recentOnly)}
        className={chipClass(filters.recentOnly)}
        data-testid="community-recent-chip"
      >
        <ClockGlyph />
        {t('community.gallery.recentFilter')}
      </Button>
      {activeFilterChips}
      {filters.author !== null && (
        <Badge
          tone="accent"
          shape="pill"
          size="sm"
          className="inline-flex items-center gap-1"
          data-testid="community-author-chip"
        >
          {t('community.gallery.filteredByAuthor', { author: authorLabel })}
          <IconButton
            aria-label={t('community.gallery.clearAuthorFilter')}
            size="sm"
            // On mobile this chip is the main way out of the author view, so
            // the dismiss target keeps the 44px hit area.
            touchTarget={isMobile}
            onClick={() => setAuthor(null)}
          >
            <XIcon className="h-3 w-3" />
          </IconButton>
        </Badge>
      )}
    </div>
  );

  const searchField = (
    <Input
      type="search"
      value={filters.searchText}
      onChange={(e) => setSearchText(e.target.value)}
      placeholder={t('community.gallery.searchPlaceholder')}
      aria-label={t('community.gallery.searchLabel')}
      leftIcon={<SearchIcon aria-hidden="true" className="h-4 w-4" />}
      rightIcon={
        filters.searchText !== '' ? (
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t('community.gallery.clearSearch')}
            onClick={() => setSearchText('')}
          >
            <XIcon className="h-3.5 w-3.5" />
          </IconButton>
        ) : undefined
      }
      wrapperClassName="min-w-0 flex-1"
    />
  );

  const filterButton = (
    <Button
      variant="secondary"
      onClick={() => setSheetOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={sheetOpen}
      className={cn('shrink-0', isMobile && 'min-h-11')}
      data-testid="community-filter-button"
    >
      {t('community.gallery.filters')}
      {activeSheetFilterCount > 0 && (
        <Badge tone="accent" shape="pill" size="sm" className="ml-1.5">
          <span aria-hidden="true">{activeSheetFilterCount}</span>
          <span className="sr-only">
            {t('community.gallery.activeFilterCount', { count: activeSheetFilterCount })}
          </span>
        </Badge>
      )}
    </Button>
  );

  const sortField = (
    <Select
      options={browseSortOptions(t, bestFitAvailable)}
      value={filters.sort}
      onValueChange={(value) => {
        if (isBrowseSort(value)) setSort(value);
      }}
      aria-label={t('community.gallery.sortLabel')}
      className={isMobile ? 'w-32' : 'w-40'}
    />
  );

  if (isMobile) {
    return (
      <div className="shrink-0 space-y-2 border-b border-stroke-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          {searchField}
          {sortField}
          {filterButton}
        </div>
        {filterChips}
        <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </div>
    );
  }

  // Desktop and mobile now share one shape: a single control row, then the
  // chips. The five size selects and ten technique pills were three permanent
  // rows of chrome — roughly a third of a short window spent on filters
  // nobody had asked for yet — so they sit behind the same disclosure mobile
  // already used, and whatever is active comes back as a chip.
  return (
    <div className="shrink-0 space-y-2 border-b border-stroke-subtle px-4 py-2">
      <div className="flex items-center gap-2">
        {searchField}
        {sortField}
        {filterButton}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="shrink-0 text-sm">
            {t('community.gallery.clearFilters')}
          </Button>
        )}
      </div>
      {filterChips}
      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
