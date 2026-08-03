import type { CommunityCard } from '@/shared/types/community';

export const SHELF_LANDING_MIN_DESIGNS = 12;

export const SHELF_CARD_LIMIT = 8;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ShelfId = 'staff-picks' | 'proven' | 'new-this-week' | 'most-remixed';

export interface Shelf {
  readonly id: ShelfId;
  readonly cards: readonly CommunityCard[];
}

function byNewest(a: CommunityCard, b: CommunityCard): number {
  return b.createdAt - a.createdAt;
}

export function buildShelves(items: readonly CommunityCard[], now: number): Shelf[] {
  if (items.length < SHELF_LANDING_MIN_DESIGNS) return [];
  const shelves: Shelf[] = [];
  // A design already surfaced in an upper shelf is skipped in every lower
  // shelf, so a small library doesn't show the same card three times.
  const shownIds = new Set<string>();

  const staffPicks = items
    .filter((card) => card.featured)
    .sort(byNewest)
    .slice(0, SHELF_CARD_LIMIT);
  if (staffPicks.length > 0) {
    shelves.push({ id: 'staff-picks', cards: staffPicks });
    for (const card of staffPicks) shownIds.add(card.id);
  }

  // Sits directly under staff picks, above recency: a design other people
  // have actually printed is the strongest recommendation the library has,
  // and it is the one signal here that nobody can inflate by posting.
  const proven = [...items]
    .filter((card) => (card.counts.prints ?? 0) > 0 && !shownIds.has(card.id))
    .sort((a, b) => {
      const delta = (b.counts.prints ?? 0) - (a.counts.prints ?? 0);
      return delta !== 0 ? delta : byNewest(a, b);
    })
    .slice(0, SHELF_CARD_LIMIT);
  if (proven.length > 0) {
    shelves.push({ id: 'proven', cards: proven });
    for (const card of proven) shownIds.add(card.id);
  }

  const newest = [...items].sort(byNewest);
  const thisWeek = newest.filter(
    (card) => now - card.createdAt <= SEVEN_DAYS_MS && !shownIds.has(card.id)
  );
  // Only genuinely-new designs belong under the "New this week" heading: a
  // thin week shows a short shelf, a dead week shows none, never months-old
  // designs relabeled as new.
  if (thisWeek.length > 0) {
    const cards = thisWeek.slice(0, SHELF_CARD_LIMIT);
    shelves.push({ id: 'new-this-week', cards });
    for (const card of cards) shownIds.add(card.id);
  }

  const mostRemixed = [...items]
    .filter((card) => !shownIds.has(card.id))
    .sort((a, b) =>
      b.counts.remixes !== a.counts.remixes ? b.counts.remixes - a.counts.remixes : byNewest(a, b)
    )
    .slice(0, SHELF_CARD_LIMIT);
  // An all-zero "Most remixed" rail would just repeat "New this week".
  if (mostRemixed.some((card) => card.counts.remixes > 0)) {
    shelves.push({ id: 'most-remixed', cards: mostRemixed });
  }

  return shelves;
}
