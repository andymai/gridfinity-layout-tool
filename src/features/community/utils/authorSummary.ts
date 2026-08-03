/**
 * Derived portrait of an author, computed from the loaded card index.
 *
 * Everything here is derived. There is no self-authored bio by design: a bio
 * is a new moderation surface that answers "how does this person present
 * themselves", where the useful question is "what do they make, and does it
 * work". Those are answerable from data the gallery already has.
 */

import type { CommunityCard, CommunityCategory } from '@/shared/types/community';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';

export interface AuthorSummary {
  readonly designCount: number;
  /** Earliest publish among the loaded cards, or null when there are none. */
  readonly firstPublishedAt: number | null;
  /** Up to two categories they publish in most, most-used first. */
  readonly topCategories: readonly CommunityCategory[];
  /** Up to three techniques they reach for most, most-used first. */
  readonly topTechniques: readonly ExampleTechnique[];
  /** Times their designs have been built upon. */
  readonly remixesOfTheirWork: number;
  /** Distinct printers across their designs, the unfarmable signal. */
  readonly printsOfTheirWork: number;
}

const MAX_CATEGORIES = 2;
const MAX_TECHNIQUES = 3;

/**
 * Most frequent values first, ties broken by first appearance.
 *
 * The input is ordered newest-first, so a tie resolves toward recent practice,
 * which is the more useful answer to "what do they make" than an arbitrary one.
 */
function topBy<T>(values: readonly T[], limit: number): T[] {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export function buildAuthorSummary(
  items: readonly CommunityCard[],
  authorPublicId: string
): AuthorSummary {
  const own = items.filter(
    (card) => card.authorPublicId === authorPublicId && card.status === 'live'
  );

  if (own.length === 0) {
    return {
      designCount: 0,
      firstPublishedAt: null,
      topCategories: [],
      topTechniques: [],
      remixesOfTheirWork: 0,
      printsOfTheirWork: 0,
    };
  }

  return {
    designCount: own.length,
    firstPublishedAt: own.reduce(
      (earliest, card) => Math.min(earliest, card.createdAt),
      own[0].createdAt
    ),
    topCategories: topBy(
      own.map((card) => card.category),
      MAX_CATEGORIES
    ),
    topTechniques: topBy(
      own.flatMap((card) => [...card.techniques]),
      MAX_TECHNIQUES
    ),
    remixesOfTheirWork: own.reduce((total, card) => total + card.counts.remixes, 0),
    printsOfTheirWork: own.reduce((total, card) => total + (card.counts.prints ?? 0), 0),
  };
}
