import { useShallow } from 'zustand/react/shallow';
import { Select } from '@/design-system';
import { useTranslation } from '@/i18n';
import { hasDimensionConstraints, useBrowseStore } from '../../store/browseStore';
import { browseSortOptions, isBrowseSort } from './galleryFilterOptions';

export interface ResultsHeaderProps {
  /** Designs matching the active filters, not the size of the index. */
  count: number;
  /**
   * Section title. Supplied only when the shelf landing sits above this row
   * and the grid needs naming as a distinct section; on a narrowed view the
   * count is the whole story and a title would contradict it.
   */
  title?: string;
  /** Host-dependent title depth. See {@link FilterRailProps.headingLevel}. */
  headingLevel: 2 | 3;
}

/**
 * The boundary between the landing rails and the grid, and the grid's own
 * controls. Sticks to the top of the shared scroller so sort and the live
 * result count stay reachable once the rails have scrolled away: they are the
 * two things a visitor reaches for from deep in a long grid.
 */
export function ResultsHeader({ count, title, headingLevel }: ResultsHeaderProps) {
  const t = useTranslation();
  const Heading = `h${headingLevel}` as const;

  const { filters, fitsGapContext } = useBrowseStore(
    useShallow((s) => ({ filters: s.filters, fitsGapContext: s.fitsGapContext }))
  );
  const setSort = useBrowseStore((s) => s.setSort);

  const bestFitAvailable = hasDimensionConstraints(filters) || fitsGapContext !== null;

  return (
    // z-20, not z-10: a card's author button and stat row are z-10 within this
    // same stacking context and come later in DOM order, so at equal depth
    // they would scroll over this bar rather than under it.
    <div
      className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stroke-subtle bg-surface px-3 py-2 md:px-4"
      data-testid="community-results-header"
    >
      {/* Announced rather than silent: a filter change repaints the grid below
          the fold, so for a screen reader this count is the only report that
          anything happened. Beside the heading it shows as a bare number
          (because "All designs · 12 designs" says "designs" twice), while the
          announced text stays the full label, which has to stand on its own. */}
      <div className="flex min-w-0 items-baseline gap-2">
        {title !== undefined && (
          <Heading className="truncate text-sm font-semibold text-content">{title}</Heading>
        )}
        <span aria-live="polite" className="shrink-0 text-xs tabular-nums text-content-tertiary">
          {title !== undefined ? (
            <>
              <span aria-hidden="true">{count}</span>
              <span className="sr-only">{t('community.gallery.countLabel', { count })}</span>
            </>
          ) : (
            t('community.gallery.countLabel', { count })
          )}
        </span>
      </div>
      <Select
        options={browseSortOptions(t, bestFitAvailable)}
        value={filters.sort}
        onValueChange={(value) => {
          if (isBrowseSort(value)) setSort(value);
        }}
        aria-label={t('community.gallery.sortLabel')}
        className="w-36 shrink-0 md:w-40"
      />
    </div>
  );
}
