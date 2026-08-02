import { describe, it, expect } from 'vitest';
import type { CommunityCard } from '@/shared/types/community';
import { SHELF_CARD_LIMIT, SHELF_LANDING_MIN_DESIGNS, buildShelves } from './shelfData';

const DAY_MS = 24 * 60 * 60 * 1000;

const NOW = 100 * DAY_MS;

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: '',
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

function manyCards(
  count: number,
  overrides: (index: number) => Partial<CommunityCard> = () => ({})
): CommunityCard[] {
  return Array.from({ length: count }, (_, i) =>
    card(`design${String(i).padStart(3, '0')}`, { createdAt: 1000 + i, ...overrides(i) })
  );
}

describe('buildShelves', () => {
  it('returns nothing below the landing threshold', () => {
    expect(buildShelves(manyCards(SHELF_LANDING_MIN_DESIGNS - 1), NOW)).toEqual([]);
    expect(buildShelves([], NOW)).toEqual([]);
  });

  it('builds shelves once the index reaches the threshold', () => {
    const shelves = buildShelves(
      manyCards(SHELF_LANDING_MIN_DESIGNS, () => ({ createdAt: NOW - DAY_MS })),
      NOW
    );
    expect(shelves.map((shelf) => shelf.id)).toEqual(['new-this-week']);
  });

  it('staff picks holds featured cards newest-first, capped at the shelf limit', () => {
    const items = manyCards(20, (i) => ({ featured: i < 10 }));
    const shelves = buildShelves(items, NOW);
    const staffPicks = shelves.find((shelf) => shelf.id === 'staff-picks');
    expect(staffPicks).toBeDefined();
    expect(staffPicks?.cards).toHaveLength(SHELF_CARD_LIMIT);
    expect(staffPicks?.cards.every((c) => c.featured)).toBe(true);
    expect(staffPicks?.cards[0].id).toBe('design009');
    expect(staffPicks?.cards.map((c) => c.createdAt)).toEqual(
      [...(staffPicks?.cards ?? [])].map((c) => c.createdAt).sort((a, b) => b - a)
    );
  });

  it('omits staff picks entirely when nothing is featured', () => {
    const shelves = buildShelves(manyCards(20), NOW);
    expect(shelves.find((shelf) => shelf.id === 'staff-picks')).toBeUndefined();
  });

  it('new this week keeps cards inside the 7-day window, newest first', () => {
    const items = manyCards(20, (i) => ({
      createdAt: i < 10 ? NOW - (10 - i) * DAY_MS : NOW - i * 3600_000,
    }));
    const shelves = buildShelves(items, NOW);
    const newThisWeek = shelves.find((shelf) => shelf.id === 'new-this-week');
    expect(newThisWeek?.cards).toHaveLength(SHELF_CARD_LIMIT);
    expect(newThisWeek?.cards.every((c) => NOW - c.createdAt <= 7 * DAY_MS)).toBe(true);
  });

  it('a card exactly 7 days old still counts as this week', () => {
    const items = manyCards(12, (i) => ({
      createdAt: i === 0 ? NOW - 7 * DAY_MS : NOW - (20 + i) * DAY_MS,
    }));
    // Only one in-window card: a short shelf, never padded with old designs.
    const shelves = buildShelves(items, NOW);
    const newThisWeek = shelves.find((shelf) => shelf.id === 'new-this-week');
    expect(newThisWeek?.cards.map((c) => c.id)).toEqual(['design000']);
  });

  it('a thin week shows only the genuinely-new designs', () => {
    const items = manyCards(20, (i) => ({
      createdAt: i < 17 ? NOW - (20 + i) * DAY_MS : NOW - (20 - i) * 3600_000,
    }));
    const shelves = buildShelves(items, NOW);
    const newThisWeek = shelves.find((shelf) => shelf.id === 'new-this-week');
    expect(newThisWeek?.cards).toHaveLength(3);
    expect(newThisWeek?.cards.every((c) => NOW - c.createdAt <= 7 * DAY_MS)).toBe(true);
  });

  it('omits new this week entirely when nothing was published this week', () => {
    const shelves = buildShelves(manyCards(20), NOW);
    expect(shelves.find((shelf) => shelf.id === 'new-this-week')).toBeUndefined();
  });

  it('most remixed sorts by remix count with newest breaking ties, capped', () => {
    const items = manyCards(20, (i) => ({ counts: { likes: 0, remixes: i % 5, exports: 0 } }));
    const shelves = buildShelves(items, NOW);
    const mostRemixed = shelves.find((shelf) => shelf.id === 'most-remixed');
    expect(mostRemixed?.cards).toHaveLength(SHELF_CARD_LIMIT);
    expect(mostRemixed?.cards[0].counts.remixes).toBe(4);
    expect(mostRemixed?.cards[0].id).toBe('design019');
    expect(mostRemixed?.cards[1].id).toBe('design014');
  });

  it('omits most remixed when every card has zero remixes', () => {
    const shelves = buildShelves(manyCards(20), NOW);
    expect(shelves.find((shelf) => shelf.id === 'most-remixed')).toBeUndefined();
  });
});
