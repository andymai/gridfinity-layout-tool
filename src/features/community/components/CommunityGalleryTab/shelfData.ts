import type { CommunityCard } from '@/shared/types/community';

export const SHELF_LANDING_MIN_DESIGNS = 12;

export const SHELF_CARD_LIMIT = 8;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ShelfId = 'staff-picks' | 'new-this-week' | 'most-remixed';

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

  const staffPicks = items
    .filter((card) => card.featured)
    .sort(byNewest)
    .slice(0, SHELF_CARD_LIMIT);
  if (staffPicks.length > 0) shelves.push({ id: 'staff-picks', cards: staffPicks });

  const newest = [...items].sort(byNewest);
  const thisWeek = newest.filter((card) => now - card.createdAt <= SEVEN_DAYS_MS);
  // Only genuinely-new designs belong under the "New this week" heading: a
  // thin week shows a short shelf, a dead week shows none, never months-old
  // designs relabeled as new.
  if (thisWeek.length > 0) {
    shelves.push({ id: 'new-this-week', cards: thisWeek.slice(0, SHELF_CARD_LIMIT) });
  }

  const mostRemixed = [...items]
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
