import { useMemo } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { useBrowseStore } from '../../store/browseStore';
import { CommunityCard } from '../CommunityCard';
import type { ShelfId } from './shelfData';
import { buildShelves } from './shelfData';

const SHELF_TITLE_KEYS: Record<ShelfId, string> = {
  'staff-picks': 'community.shelves.staffPicks',
  'new-this-week': 'community.shelves.newThisWeek',
  'most-remixed': 'community.shelves.mostRemixed',
};

export interface ShelfLandingProps {
  items: readonly CommunityCardData[];
  onSelect: (card: CommunityCardData) => void;
  onSelectAuthor: (card: CommunityCardData) => void;
}

export function ShelfLanding({ items, onSelect, onSelectAuthor }: ShelfLandingProps) {
  const t = useTranslation();
  const setFeaturedOnly = useBrowseStore((s) => s.setFeaturedOnly);
  const setSort = useBrowseStore((s) => s.setSort);
  // The index fetch time is the pure render-safe "now": the 7-day window can
  // only be as fresh as the loaded cards anyway.
  const fetchedAt = useBrowseStore((s) => s.fetchedAt);

  const shelves = useMemo(() => buildShelves(items, fetchedAt ?? 0), [items, fetchedAt]);
  if (shelves.length === 0) return null;

  // Deliberately not clearFilters(): if a filter raced in from another tab,
  // "See all" should apply this one change, not silently wipe the rest.
  // New-this-week has no action: the grid below already shows newest-first,
  // so its "See all" would be a visible no-op.
  const handleSeeAll = (id: ShelfId): void => {
    if (id === 'staff-picks') {
      setFeaturedOnly(true);
    } else if (id === 'most-remixed') {
      setSort('remixes');
    }
  };

  return (
    <div
      className="shrink-0 space-y-2 border-b border-stroke-subtle px-3 pt-2 md:px-4"
      data-testid="community-shelves"
    >
      {shelves.map((shelf) => (
        <section key={shelf.id} aria-labelledby={`community-shelf-${shelf.id}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 id={`community-shelf-${shelf.id}`} className="text-sm font-semibold text-content">
              {t(SHELF_TITLE_KEYS[shelf.id])}
            </h3>
            {shelf.id !== 'new-this-week' && (
              <Button
                variant="ghost"
                onClick={() => handleSeeAll(shelf.id)}
                className="shrink-0 text-sm"
                data-testid={`community-shelf-see-all-${shelf.id}`}
              >
                {t('community.shelves.seeAll', { shelf: t(SHELF_TITLE_KEYS[shelf.id]) })}
              </Button>
            )}
          </div>
          {/* motion-reduce disables the snap yank outright, not just the timing:
              scroll-snap can still animate into place without scroll-behavior. */}
          {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
          <ul
            role="list"
            aria-label={t(SHELF_TITLE_KEYS[shelf.id])}
            className="flex list-none snap-x snap-mandatory gap-3 overflow-x-auto pb-2 motion-reduce:snap-none motion-reduce:scroll-auto"
          >
            {shelf.cards.map((card, index) => (
              <li key={card.id} className="w-40 shrink-0 snap-start sm:w-44">
                <CommunityCard
                  card={card}
                  onSelect={onSelect}
                  onSelectAuthor={onSelectAuthor}
                  index={index}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
