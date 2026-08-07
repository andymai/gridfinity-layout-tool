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
    const featuredCards = shelves.find((shelf) => shelf.id === 'featured');
    expect(featuredCards).toBeDefined();
    expect(featuredCards?.cards).toHaveLength(SHELF_CARD_LIMIT);
    expect(featuredCards?.cards.every((c) => c.featured)).toBe(true);
    expect(featuredCards?.cards[0].id).toBe('design009');
    expect(featuredCards?.cards.map((c) => c.createdAt)).toEqual(
      [...(featuredCards?.cards ?? [])].map((c) => c.createdAt).sort((a, b) => b - a)
    );
  });

  it('omits staff picks entirely when nothing is featured', () => {
    const shelves = buildShelves(manyCards(20), NOW);
    expect(shelves.find((shelf) => shelf.id === 'featured')).toBeUndefined();
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
    // Three in-window cards, the oldest of them exactly on the boundary: the
    // shelf is never padded with older designs, and SHELF_MIN_CARDS keeps a
    // one-card rail from rendering at all.
    const items = manyCards(12, (i) => ({
      createdAt: i === 0 ? NOW - 7 * DAY_MS : i < 3 ? NOW - i * DAY_MS : NOW - (20 + i) * DAY_MS,
    }));
    const shelves = buildShelves(items, NOW);
    const newThisWeek = shelves.find((shelf) => shelf.id === 'new-this-week');
    expect(newThisWeek?.cards.map((c) => c.id)).toContain('design000');
    expect(newThisWeek?.cards).toHaveLength(3);
  });

  it('drops a rail that cannot fill a row', () => {
    // Two in-window cards is not a shelf, it is two cards in an empty row.
    // They still reach the grid below, which is the point of the rule.
    const items = manyCards(12, (i) => ({
      createdAt: i < 2 ? NOW - i * DAY_MS : NOW - (20 + i) * DAY_MS,
    }));
    expect(buildShelves(items, NOW).map((s) => s.id)).not.toContain('new-this-week');
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

  it('de-duplicates designs that would otherwise qualify for more than one shelf', () => {
    // Group A (0-7): staff picks, old, no remixes.
    // Group B (8-14): published this week AND the highest remix counts, so
    // without dedup it would also dominate "Most remixed".
    // Group C (15-19): old, lower remix counts, the only pool left for
    // "Most remixed" once A and B are excluded.
    const items = manyCards(20, (i) => {
      if (i < 8) {
        return {
          featured: true,
          createdAt: NOW - 30 * DAY_MS - i,
          counts: { likes: 0, remixes: 0, exports: 0 },
        };
      }
      if (i < 15) {
        return {
          featured: false,
          createdAt: NOW - (i - 8) * 3600_000,
          counts: { likes: 0, remixes: 50, exports: 0 },
        };
      }
      return {
        featured: false,
        createdAt: NOW - 40 * DAY_MS - i,
        counts: { likes: 0, remixes: 10, exports: 0 },
      };
    });
    const shelves = buildShelves(items, NOW);
    expect(shelves.map((shelf) => shelf.id)).toEqual(['featured', 'new-this-week', 'most-remixed']);
    const [featuredCards, newThisWeek, mostRemixed] = shelves;
    expect(featuredCards.cards).toHaveLength(8);
    expect(newThisWeek.cards).toHaveLength(7);
    expect(mostRemixed.cards).toHaveLength(5);
    // The highest-remix group was already shown under "New this week" and
    // must not resurface under "Most remixed".
    expect(mostRemixed.cards.every((c) => c.counts.remixes === 10)).toBe(true);
    const allIds = shelves.flatMap((shelf) => shelf.cards.map((c) => c.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  describe('proven shelf', () => {
    it('is absent when nothing has been printed', () => {
      const items = Array.from({ length: 12 }, (_, i) => card(`d${i}`));
      expect(buildShelves(items, NOW).map((s) => s.id)).not.toContain('proven');
    });

    it('surfaces printed designs ordered by printer count', () => {
      const items = [
        ...Array.from({ length: 12 }, (_, i) => card(`d${i}`)),
        card('printed-low', { counts: { likes: 0, remixes: 0, exports: 0, prints: 1 } }),
        card('printed-mid', { counts: { likes: 0, remixes: 0, exports: 0, prints: 4 } }),
        card('printed-high', { counts: { likes: 0, remixes: 0, exports: 0, prints: 9 } }),
      ];

      const proven = buildShelves(items, NOW).find((s) => s.id === 'proven');
      expect(proven?.cards.map((c) => c.id)).toEqual([
        'printed-high',
        'printed-mid',
        'printed-low',
      ]);
    });

    it('is absent when too few designs have been printed to fill a row', () => {
      const items = [
        ...Array.from({ length: 12 }, (_, i) => card(`d${i}`)),
        card('printed', { counts: { likes: 0, remixes: 0, exports: 0, prints: 3 } }),
      ];
      expect(buildShelves(items, NOW).map((s) => s.id)).not.toContain('proven');
    });

    it('ranks above new-this-week, since proof outranks recency', () => {
      const items = [
        ...Array.from({ length: 12 }, (_, i) => card(`d${i}`, { createdAt: NOW })),
        ...Array.from({ length: 3 }, (_, i) =>
          card(`printed${i}`, { counts: { likes: 0, remixes: 0, exports: 0, prints: 3 } })
        ),
      ];

      const ids = buildShelves(items, NOW).map((s) => s.id);
      expect(ids.indexOf('proven')).toBeLessThan(ids.indexOf('new-this-week'));
    });

    it('does not repeat a design already shown in staff picks', () => {
      const items = [
        ...Array.from({ length: 12 }, (_, i) => card(`d${i}`)),
        // Enough featured designs for a featured rail to exist at all.
        ...Array.from({ length: 2 }, (_, i) => card(`feat${i}`, { featured: true })),
        card('both', {
          featured: true,
          counts: { likes: 0, remixes: 0, exports: 0, prints: 5 },
        }),
        ...Array.from({ length: 2 }, (_, i) =>
          card(`printed${i}`, { counts: { likes: 0, remixes: 0, exports: 0, prints: 2 } })
        ),
      ];

      const proven = buildShelves(items, NOW).find((s) => s.id === 'proven');
      expect(proven?.cards.map((c) => c.id) ?? []).not.toContain('both');
    });
  });
});
