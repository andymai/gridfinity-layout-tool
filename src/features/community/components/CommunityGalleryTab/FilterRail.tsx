import { IconButton } from '@/design-system';
import { ChevronDownIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { CommunityCard } from '@/shared/types/community';
import { FilterPanel } from './FilterPanel';
import type { FacetCounts } from './facetCounts';

export interface FilterRailProps {
  items: readonly CommunityCard[];
  counts: FacetCounts;
  onCollapse: () => void;
  /**
   * Depth of this section's title, which depends on the host: under the
   * gallery dialog's own h2 title it is an h3, under the /community route's
   * h1 it is an h2. Hardcoding either one flattens or skips a level in the
   * other surface.
   */
  headingLevel: 2 | 3;
}

/**
 * Desktop filter column. Sits inside the gallery body rather than over it, so
 * results stay visible and there is no second focus trap, overlay or scroll
 * lock on top of the gallery dialog.
 */
export function FilterRail({ items, counts, onCollapse, headingLevel }: FilterRailProps) {
  const t = useTranslation();
  const Heading = `h${headingLevel}` as const;

  return (
    <aside
      aria-label={t('community.gallery.filterPanelLabel')}
      className="hidden w-60 shrink-0 flex-col border-r border-stroke-subtle md:flex"
      data-testid="community-filter-rail"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stroke-subtle px-3 py-2">
        <Heading className="text-sm font-semibold text-content">
          {t('community.gallery.filterPanelLabel')}
        </Heading>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={t('community.gallery.hideFilters')}
          onClick={onCollapse}
          data-testid="community-filter-rail-collapse"
        >
          <ChevronDownIcon className="h-4 w-4 rotate-90" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <FilterPanel items={items} counts={counts} />
      </div>
    </aside>
  );
}
