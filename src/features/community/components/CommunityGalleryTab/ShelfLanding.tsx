import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Button, IconButton, cn } from '@/design-system';
import { ChevronDownIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { useBrowseStore } from '../../store/browseStore';
import { CommunityCard } from '../CommunityCard';
import type { ShelfId } from './shelfData';
import { COMMUNITY_COLLECTIONS } from '../../data/collections';
import { resolveCollections } from '../../utils/resolveCollections';
import { buildShelves, MAX_LANDING_RAILS } from './shelfData';
import { useScrollEdges } from './useScrollEdges';

const SHELF_TITLE_KEYS: Record<ShelfId, string> = {
  featured: 'community.shelves.featured',
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

  // Deliberately not clearFilters(): if a filter raced in from another tab,
  // "See all" should apply this one change, not silently wipe the rest.
  // New-this-week has no action: the grid below already shows newest-first,
  // so its "See all" would be a visible no-op.
  const handleSeeAll = (id: ShelfId): void => {
    if (id === 'featured') {
      setFeaturedOnly(true);
    } else if (id === 'most-remixed') {
      setSort('remixes');
    } else if (id === 'proven') {
      setSort('prints');
    }
  };

  // Curated collections lead: a human vouched for these, which is a stronger
  // claim than any of the derived shelves can make. The cap then falls on
  // whatever the weakest derived shelf is that day.
  const rails: RailProps[] = [
    ...collections.map((collection) => ({
      id: `collection-${collection.id}`,
      title: t(collection.titleKey),
      blurb: t(collection.blurbKey),
      cards: collection.cards,
      onSelect,
      onSelectAuthor,
    })),
    ...shelves.map((shelf) => ({
      id: shelf.id,
      title: t(SHELF_TITLE_KEYS[shelf.id]),
      cards: shelf.cards,
      onSelect,
      onSelectAuthor,
      // New-this-week has no action: the grid below is already newest-first,
      // so its "See all" would be a visible no-op.
      onSeeAll: shelf.id === 'new-this-week' ? undefined : () => handleSeeAll(shelf.id),
    })),
  ].slice(0, MAX_LANDING_RAILS);

  if (rails.length === 0) return null;

  return (
    <div className="space-y-3 px-3 pb-1 pt-3 md:px-4" data-testid="community-shelves">
      {rails.map((rail) => (
        <Rail key={rail.id} {...rail} />
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

/** One nudge moves most of a rail without overshooting what you were reading. */
const RAIL_SCROLL_FRACTION = 0.8;

function Rail({ id, title, blurb, cards, onSelect, onSelectAuthor, onSeeAll }: RailProps) {
  const t = useTranslation();
  const railRef = useRef<HTMLUListElement>(null);
  const { atStart, atEnd } = useScrollEdges(railRef, cards.length);

  const nudge = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * rail.clientWidth * RAIL_SCROLL_FRACTION,
      behavior: 'smooth',
    });
  }, []);

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

      {/* The fades and the buttons render only against an edge that actually
          hides something. A permanent gradient implies cards that are not
          there, and at the true end it veils the last card behind a hint that
          it is not the last card. */}
      <div className="relative">
        {/* motion-reduce disables the snap yank outright, not just the timing:
            scroll-snap can still animate into place without scroll-behavior. */}
        <ul
          ref={railRef}
          role="list"
          aria-label={title}
          className="flex list-none snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-thin motion-reduce:snap-none motion-reduce:scroll-auto"
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

        {atStart && <RailFade side="start" />}
        {atEnd && <RailFade side="end" />}

        {/* Touch scrolls by swiping and shows a scrollbar while it does; a
            mouse gets neither, and many have no horizontal wheel at all. */}
        {atStart && (
          <RailButton
            side="start"
            label={t('community.shelves.scrollBack', { shelf: title })}
            onClick={() => nudge(-1)}
          />
        )}
        {atEnd && (
          <RailButton
            side="end"
            label={t('community.shelves.scrollForward', { shelf: title })}
            onClick={() => nudge(1)}
          />
        )}
      </div>
    </section>
  );
}

function RailFade({ side }: { side: 'start' | 'end' }) {
  return (
    <div
      aria-hidden="true"
      data-testid={`community-shelf-fade-${side}`}
      className={cn(
        'pointer-events-none absolute inset-y-0 w-12',
        side === 'start'
          ? 'left-0 bg-gradient-to-r from-surface to-transparent'
          : 'right-0 bg-gradient-to-l from-surface to-transparent'
      )}
    />
  );
}

interface RailButtonProps {
  side: 'start' | 'end';
  label: string;
  onClick: () => void;
}

function RailButton({ side, label, onClick }: RailButtonProps) {
  return (
    <IconButton
      size="sm"
      aria-label={label}
      onClick={onClick}
      // Hidden from touch, where the swipe is the affordance, and hidden from
      // the tab order: keyboard users already scroll the rail by focusing the
      // cards inside it, so these would be two extra stops to nothing new.
      tabIndex={-1}
      className={cn(
        'absolute top-1/2 hidden -translate-y-1/2 border border-stroke-subtle bg-surface-elevated shadow-md md:flex',
        side === 'start' ? 'left-1' : 'right-1'
      )}
    >
      {/* Rotated rather than two more icons in the set; the chevron's own
          docs sanction it for directional variants. */}
      <ChevronDownIcon size="sm" className={side === 'start' ? 'rotate-90' : '-rotate-90'} />
    </IconButton>
  );
}
