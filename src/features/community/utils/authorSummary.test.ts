import { describe, expect, it } from 'vitest';
import type { CommunityCard } from '@/shared/types/community';
import { buildAuthorSummary } from './authorSummary';

const AUTHOR = 'a'.repeat(32);
const OTHER = 'b'.repeat(32);

function card(overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id: 'abc123def456',
    name: 'Bin',
    authorName: 'Casey',
    authorPublicId: AUTHOR,
    category: 'tools',
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

describe('buildAuthorSummary', () => {
  it('reports an empty portrait when the author has nothing loaded', () => {
    expect(buildAuthorSummary([card({ authorPublicId: OTHER })], AUTHOR)).toEqual({
      designCount: 0,
      firstPublishedAt: null,
      topCategories: [],
      topTechniques: [],
      remixesOfTheirWork: 0,
      printsOfTheirWork: 0,
    });
  });

  it("counts only this author's designs", () => {
    const summary = buildAuthorSummary(
      [card({ id: 'a' }), card({ id: 'b' }), card({ id: 'c', authorPublicId: OTHER })],
      AUTHOR
    );
    expect(summary.designCount).toBe(2);
  });

  it('excludes non-live designs from the portrait', () => {
    const summary = buildAuthorSummary(
      [card({ id: 'a' }), card({ id: 'b', status: 'hidden' })],
      AUTHOR
    );
    // A moderated design must not pad someone's body of work.
    expect(summary.designCount).toBe(1);
  });

  it('takes the earliest publish date', () => {
    const summary = buildAuthorSummary(
      [card({ id: 'a', createdAt: 5000 }), card({ id: 'b', createdAt: 2000 })],
      AUTHOR
    );
    expect(summary.firstPublishedAt).toBe(2000);
  });

  it('ranks categories by how often they are used', () => {
    const summary = buildAuthorSummary(
      [
        card({ id: 'a', category: 'kitchen' }),
        card({ id: 'b', category: 'tools' }),
        card({ id: 'c', category: 'tools' }),
      ],
      AUTHOR
    );
    expect(summary.topCategories).toEqual(['tools', 'kitchen']);
  });

  it('caps categories at two and techniques at three', () => {
    const summary = buildAuthorSummary(
      [
        card({ id: 'a', category: 'kitchen', techniques: ['scoop', 'lid'] }),
        card({ id: 'b', category: 'tools', techniques: ['labelTab'] }),
        card({ id: 'c', category: 'office', techniques: ['handles'] }),
      ],
      AUTHOR
    );
    expect(summary.topCategories).toHaveLength(2);
    expect(summary.topTechniques).toHaveLength(3);
  });

  it('breaks a tie toward recent practice', () => {
    // The index arrives newest-first, so first-seen is the more recent one.
    const summary = buildAuthorSummary(
      [card({ id: 'a', category: 'office' }), card({ id: 'b', category: 'crafts' })],
      AUTHOR
    );
    expect(summary.topCategories[0]).toBe('office');
  });

  it('totals remixes and prints across their designs', () => {
    const summary = buildAuthorSummary(
      [
        card({ id: 'a', counts: { likes: 1, remixes: 2, exports: 0, prints: 3 } }),
        card({ id: 'b', counts: { likes: 0, remixes: 1, exports: 0, prints: 4 } }),
      ],
      AUTHOR
    );
    expect(summary.remixesOfTheirWork).toBe(3);
    expect(summary.printsOfTheirWork).toBe(7);
  });

  it('treats a card with no print count as zero rather than NaN', () => {
    const summary = buildAuthorSummary(
      [card({ counts: { likes: 0, remixes: 0, exports: 0 } })],
      AUTHOR
    );
    expect(summary.printsOfTheirWork).toBe(0);
  });
});
