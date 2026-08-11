import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge, Button, IconButton, Input, cn } from '@/design-system';
import { SearchIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useGapFitStore } from '@/core/store/gapFit';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { hasActiveBrowseFilters, useBrowseStore } from '../../store/browseStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { formatUnits } from '../CommunityCard/cardDims';
import { summariseDimensionFilters } from './dimensionSummary';

export interface GalleryToolbarProps {
  /** Whether the filter surface (desktop rail or mobile view) is showing. */
  panelOpen: boolean;
  /**
   * Whether there is anything to narrow. False over an empty index, where the
   * panel would be nothing but disabled controls.
   */
  filtersAvailable?: boolean;
  onTogglePanel: () => void;
  activeFilterCount: number;
}

export function GalleryToolbar({
  panelOpen,
  filtersAvailable = true,
  onTogglePanel,
  activeFilterCount,
}: GalleryToolbarProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();

  const { filters, fitsGapContext } = useBrowseStore(
    useShallow((s) => ({ filters: s.filters, fitsGapContext: s.fitsGapContext }))
  );
  const setSearchText = useBrowseStore((s) => s.setSearchText);
  const setCategory = useBrowseStore((s) => s.setCategory);
  const setTechnique = useBrowseStore((s) => s.setTechnique);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const setLikedOnly = useBrowseStore((s) => s.setLikedOnly);
  const setRecentOnly = useBrowseStore((s) => s.setRecentOnly);
  const setFeaturedOnly = useBrowseStore((s) => s.setFeaturedOnly);
  const setMineOnly = useBrowseStore((s) => s.setMineOnly);
  const setFitsGapContext = useBrowseStore((s) => s.setFitsGapContext);
  const clearDimensionFilters = useBrowseStore((s) => s.clearDimensionFilters);

  // Clearing the banner ends the whole fits-gap context, core handoff
  // included: browsing returns to normal and the detail view's "Place in
  // layout" action disappears with it.
  const handleClearFitsGap = useCallback(() => {
    setFitsGapContext(null);
    useGapFitStore.getState().clear();
  }, [setFitsGapContext]);

  const authorLabel =
    filters.author !== null && filters.author.name !== ''
      ? filters.author.name
      : t('community.gallery.authorFallback');

  const dimensionSummary = summariseDimensionFilters(filters, {
    width: t('community.gallery.widthAbbrev'),
    depth: t('community.gallery.depthAbbrev'),
    height: t('community.gallery.heightAbbrev'),
  });

  const chip = (testId: string, label: ReactNode, clearLabel: string, onClear: () => void) => (
    <Badge
      key={testId}
      tone="accent"
      shape="pill"
      size="sm"
      className="inline-flex items-center gap-1"
      data-testid={testId}
    >
      {label}
      <IconButton
        aria-label={clearLabel}
        size="sm"
        // On mobile the chips are the main way out of a narrowed view, so the
        // dismiss target keeps its 44px hit area.
        touchTarget={isMobile}
        onClick={onClear}
      >
        <XIcon className="h-3 w-3" />
      </IconButton>
    </Badge>
  );

  // The panel shows every one of these as a checked control, so the chips only
  // earn their row once it is out of sight. Without them a collapsed rail
  // would hide the reason the grid is short, and a filtered gallery reads as
  // an empty one.
  const chips: ReactNode[] = [];
  if (fitsGapContext !== null) {
    chips.push(
      chip(
        'community-fits-gap-chip',
        t('community.gallery.fitsGapBanner', {
          width: formatUnits(fitsGapContext.widthMax),
          depth: formatUnits(fitsGapContext.depthMax),
        }),
        t('community.gallery.clearFitsGap'),
        handleClearFitsGap
      )
    );
  }
  if (filters.author !== null) {
    chips.push(
      chip(
        'community-author-chip',
        t('community.gallery.filteredByAuthor', { author: authorLabel }),
        t('community.gallery.clearAuthorFilter'),
        () => setAuthor(null)
      )
    );
  }
  const clearLabelFor = (label: string): string =>
    t('community.gallery.clearNamedFilter', { label });
  if (filters.mineOnly) {
    const label = t('community.gallery.mineFilter');
    chips.push(chip('community-mine-chip', label, clearLabelFor(label), () => setMineOnly(false)));
  }
  if (filters.likedOnly) {
    const label = t('community.gallery.likedFilter');
    chips.push(
      chip('community-liked-chip', label, clearLabelFor(label), () => setLikedOnly(false))
    );
  }
  if (filters.recentOnly) {
    const label = t('community.gallery.recentFilter');
    chips.push(
      chip('community-recent-chip', label, clearLabelFor(label), () => setRecentOnly(false))
    );
  }
  if (filters.featuredOnly) {
    chips.push(
      chip(
        'community-featured-chip',
        t('community.shelves.featured'),
        t('community.gallery.clearFeaturedFilter'),
        () => setFeaturedOnly(false)
      )
    );
  }
  if (filters.category !== null) {
    chips.push(
      chip(
        'community-category-chip',
        t(CATEGORY_LABEL_KEYS[filters.category]),
        t('community.gallery.clearCategoryFilter'),
        () => setCategory(null)
      )
    );
  }
  if (filters.technique !== null) {
    chips.push(
      chip(
        'community-technique-chip',
        t(TECHNIQUE_CONFIG[filters.technique].labelKey),
        t('community.gallery.clearTechniqueFilter'),
        () => setTechnique(null)
      )
    );
  }
  if (dimensionSummary !== null) {
    chips.push(
      chip(
        'community-size-chip',
        dimensionSummary,
        t('community.gallery.clearSizeFilter'),
        clearDimensionFilters
      )
    );
  }

  return (
    <div className="shrink-0 space-y-2 border-b border-stroke-subtle px-3 py-2 md:px-4">
      {/* Search shares this row with the filter button alone: sort moved down
          to the results header, which is what freed the width that used to
          push search onto a row of its own on a phone. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* An open rail carries its own collapse control in its header, so a
            second one here would sit two inches away doing the same thing. */}
        {filtersAvailable && (isMobile || !panelOpen) && (
          <Button
            variant="secondary"
            onClick={onTogglePanel}
            aria-expanded={panelOpen}
            className={cn('shrink-0', isMobile && 'min-h-11')}
            data-testid="community-filter-button"
          >
            {t('community.gallery.filters')}
            {activeFilterCount > 0 && (
              <Badge tone="accent" shape="pill" size="sm" className="ml-1.5">
                <span aria-hidden="true">{activeFilterCount}</span>
                <span className="sr-only">
                  {t('community.gallery.activeFilterCount', { count: activeFilterCount })}
                </span>
              </Badge>
            )}
          </Button>
        )}
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
      </div>

      {!panelOpen && chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips}
          {hasActiveBrowseFilters(filters) && (
            <Button
              variant="ghost"
              onClick={() => {
                useBrowseStore.getState().clearFilters();
                handleClearFitsGap();
              }}
              className="shrink-0 text-sm"
            >
              {t('community.gallery.clearFilters')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
