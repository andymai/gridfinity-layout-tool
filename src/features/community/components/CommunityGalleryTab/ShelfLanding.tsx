import { useEffect, useMemo } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { useBrowseStore } from '../../store/browseStore';
import { CommunityCard } from '../CommunityCard';
import type { ShelfId } from './shelfData';
import { COMMUNITY_COLLECTIONS } from '../../data/collections';
import { resolveCollections } from '../../utils/resolveCollections';
import { buildShelves } from './shelfData';

const SHELF_TITLE_KEYS: Record<ShelfId, string> = {
  'staff-picks': 'community.shelves.staffPicks',
  proven: 'community.shelves.proven',
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
  const collections = useMemo(() => resolveCollections(COMMUNITY_COLLECTIONS, items), [items]);

  // Curation happens by PR against a static file, so a typo has no other way
  // of announcing itself: without this the shelf just quietly shrinks. Dev
  // only, since in production an unresolved id is usually a design that was
  // moderated or has aged out of the capped index, not a mistake.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    for (const collection of collections) {
      if (collection.missingIds.length > 0) {
        console.warn(
          `[collections] "${collection.id}" has ids with no live design: ${collection.missingIds.join(', ')}`
        );
      }
    }
  }, [collections]);
  if (shelves.length === 0 && collections.length === 0) return null;

  // Deliberately not clearFilters(): if a filter raced in from another tab,
  // "See all" should apply this one change, not silently wipe the rest.
  // New-this-week has no action: the grid below already shows newest-first,
  // so its "See all" would be a visible no-op.
  const handleSeeAll = (id: ShelfId): void => {
    if (id === 'staff-picks') {
      setFeaturedOnly(true);
    } else if (id === 'most-remixed') {
      setSort('remixes');
    } else if (id === 'proven') {
      setSort('prints');
    }
  };

  return (
    <div
      className="shrink-0 space-y-2 border-b border-stroke-subtle px-3 pt-2 md:px-4"
      data-testid="community-shelves"
    >
      {/* Curated collections lead: a human vouched for these, which is a
          stronger claim than any of the derived shelves can make. */}
      {collections.map((collection) => (
        <Rail
          key={collection.id}
          id={`collection-${collection.id}`}
          title={t(collection.titleKey)}
          blurb={t(collection.blurbKey)}
          cards={collection.cards}
          onSelect={onSelect}
          onSelectAuthor={onSelectAuthor}
        />
      ))}

      {shelves.map((shelf) => (
        <Rail
          key={shelf.id}
          id={shelf.id}
          title={t(SHELF_TITLE_KEYS[shelf.id])}
          cards={shelf.cards}
          onSelect={onSelect}
          onSelectAuthor={onSelectAuthor}
          // New-this-week has no action: the grid below is already
          // newest-first, so its "See all" would be a visible no-op.
          onSeeAll={shelf.id === 'new-this-week' ? undefined : () => handleSeeAll(shelf.id)}
        />
      ))}
    </div>
  );
}

interface RailProps {
  id: string;
  title: string;
  /** Editorial one-liner; derived shelves have none, their titles say enough. */
  blurb?: string;
  cards: readonly CommunityCardData[];
  onSelect: (card: CommunityCardData) => void;
  onSelectAuthor: (card: CommunityCardData) => void;
  onSeeAll?: () => void;
}

function Rail({ id, title, blurb, cards, onSelect, onSelectAuthor, onSeeAll }: RailProps) {
  const t = useTranslation();
  return (
    <section aria-labelledby={`community-shelf-${id}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={`community-shelf-${id}`} className="text-sm font-semibold text-content">
          {title}
        </h3>
        {onSeeAll !== undefined && (
          <Button
            variant="ghost"
            onClick={onSeeAll}
            // The visible label does not repeat the heading it sits beside;
            // the accessible name still names the shelf, since a screen
            // reader may reach the button without the heading for context.
            aria-label={t('community.shelves.seeAllAria', { shelf: title })}
            className="shrink-0 text-sm"
            data-testid={`community-shelf-see-all-${id}`}
          >
            {t('community.shelves.seeAll')}
          </Button>
        )}
      </div>

      {blurb !== undefined && <p className="mb-1 text-xs text-content-secondary">{blurb}</p>}

      {/* motion-reduce disables the snap yank outright, not just the timing:
          scroll-snap can still animate into place without scroll-behavior. */}
      {/* role="list" restores list semantics that Safari/iOS VoiceOver strips when list-style:none is applied. */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
      <ul
        role="list"
        aria-label={title}
        className="flex list-none snap-x snap-mandatory gap-3 overflow-x-auto pb-2 motion-reduce:snap-none motion-reduce:scroll-auto"
      >
        {cards.map((card, index) => (
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
  );
}
