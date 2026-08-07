import { Button, IconButton } from '@/design-system';
import { ArrowLeftIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { CommunityCard } from '@/shared/types/community';
import { FilterPanel } from './FilterPanel';
import type { FacetCounts } from './facetCounts';

export interface MobileFilterViewProps {
  items: readonly CommunityCard[];
  counts: FacetCounts;
  onBack: () => void;
  /** Host-dependent title depth. See {@link FilterRailProps.headingLevel}. */
  headingLevel: 2 | 3;
}

/**
 * Mobile filter surface. Takes over the gallery body in place instead of
 * opening a sheet: the gallery is already a fullscreen dialog, and a second
 * one stacks a focus trap and a scroll lock on top of the first.
 */
export function MobileFilterView({ items, counts, onBack, headingLevel }: MobileFilterViewProps) {
  const t = useTranslation();
  const Heading = `h${headingLevel}` as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="community-mobile-filters">
      <div className="flex shrink-0 items-center gap-2 border-b border-stroke-subtle px-2 py-2">
        <IconButton
          variant="ghost"
          touchTarget
          aria-label={t('community.gallery.backToResults')}
          onClick={onBack}
          data-testid="community-mobile-filters-back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </IconButton>
        <Heading className="min-w-0 flex-1 truncate text-base font-semibold text-content">
          {t('community.gallery.filterSheetTitle')}
        </Heading>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <FilterPanel items={items} counts={counts} touchSize />
      </div>

      {/* The results are behind this view, so the count is the only feedback a
          filter change gives until you go back — which is what this button
          does, live count and all. */}
      <div className="shrink-0 border-t border-stroke-subtle px-3 py-2">
        <Button
          variant="primary"
          className="min-h-11 w-full justify-center"
          onClick={onBack}
          data-testid="community-mobile-filters-apply"
        >
          {t('community.gallery.showResults', { count: counts.total })}
        </Button>
      </div>
    </div>
  );
}
