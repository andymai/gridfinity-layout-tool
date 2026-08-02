import { describe, it, expect } from 'vitest';
import type { CommunityCard, CommunityDesign } from '@/shared/types/community';
import { SIMILAR_DESIGNS_MAX, findSimilarDesigns } from './similarDesigns';

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: ['compartments'],
    metrics: { width: 84, depth: 126, height: 42, gridUnitMm: 42 },
    thumbnailUrl: `https://blob/${id}.webp`,
    isRemix: false,
    featured: false,
    counts: { likes: 0, remixes: 0, exports: 0 },
    createdAt: 1000,
    updatedAt: 1000,
    status: 'live',
    ...overrides,
  };
}

const target: Pick<CommunityDesign, 'id' | 'category' | 'techniques' | 'metrics'> = {
  id: 'target123456',
  category: 'hardware',
  techniques: ['compartments', 'scoop'],
  metrics: { width: 84, depth: 126, height: 42, gridUnitMm: 42 },
};

describe('findSimilarDesigns', () => {
  it('excludes the target itself', () => {
    const result = findSimilarDesigns(target, [card('target123456'), card('other')]);
    expect(result.map((c) => c.id)).toEqual(['other']);
  });

  it('excludes non-live designs', () => {
    const result = findSimilarDesigns(target, [
      card('hidden1', { status: 'hidden' }),
      card('removed1', { status: 'removed' }),
      card('live1'),
    ]);
    expect(result.map((c) => c.id)).toEqual(['live1']);
  });

  it('requires at least two signals; any pair of category/technique/footprint qualifies', () => {
    const categoryAndTechnique = card('cat-tech', {
      category: 'hardware',
      techniques: ['scoop'],
      metrics: { width: 420, depth: 420, height: 42, gridUnitMm: 42 },
    });
    const techniqueAndFootprint = card('tech-foot', {
      category: 'kitchen',
      techniques: ['scoop'],
      metrics: { width: 126, depth: 168, height: 42, gridUnitMm: 42 },
    });
    const categoryAndFootprint = card('cat-foot', {
      category: 'hardware',
      techniques: ['slotted'],
      metrics: { width: 126, depth: 168, height: 42, gridUnitMm: 42 },
    });
    // Plan 2.4 defines similarity as intersecting signals: one shared signal
    // (a category alone, a technique alone, a footprint alone) is not enough.
    const categoryOnly = card('cat', {
      category: 'hardware',
      techniques: ['slotted'],
      metrics: { width: 420, depth: 420, height: 42, gridUnitMm: 42 },
    });
    const techniqueOnly = card('tech', {
      category: 'kitchen',
      techniques: ['scoop'],
      metrics: { width: 420, depth: 420, height: 42, gridUnitMm: 42 },
    });
    const footprintOnly = card('foot', {
      category: 'kitchen',
      techniques: ['slotted'],
      metrics: { width: 126, depth: 168, height: 42, gridUnitMm: 42 },
    });
    const result = findSimilarDesigns(target, [
      categoryAndTechnique,
      techniqueAndFootprint,
      categoryAndFootprint,
      categoryOnly,
      techniqueOnly,
      footprintOnly,
    ]);
    expect(result.map((c) => c.id).sort()).toEqual(['cat-foot', 'cat-tech', 'tech-foot']);
  });

  it('requires the footprint to be within one grid unit on each axis', () => {
    const withinBoth = card('within', {
      category: 'kitchen',
      techniques: ['scoop'],
      metrics: { width: 126, depth: 84, height: 42, gridUnitMm: 42 },
    });
    const widthTooFar = card('wide', {
      category: 'kitchen',
      techniques: ['scoop'],
      metrics: { width: 168.5, depth: 126, height: 42, gridUnitMm: 42 },
    });
    const result = findSimilarDesigns(target, [withinBoth, widthTooFar]);
    expect(result.map((c) => c.id)).toEqual(['within']);
  });

  it('compares footprints in grid units, not raw millimeters', () => {
    // 2x3 on a 42mm grid vs 2x3 on a 32mm grid: same shape, different mm.
    const smallGrid = card('small', {
      category: 'kitchen',
      techniques: ['scoop'],
      metrics: { width: 64, depth: 96, height: 32, gridUnitMm: 32 },
    });
    const result = findSimilarDesigns(target, [smallGrid]);
    expect(result.map((c) => c.id)).toEqual(['small']);
  });

  it('ranks by signal count, then recency, then id, deterministically', () => {
    const threeSignals = card('all3', { createdAt: 1 });
    const twoSignalsNewer = card('two-newer', {
      techniques: ['slotted'],
      createdAt: 900,
    });
    const twoSignalsOlder = card('two-older', {
      techniques: ['slotted'],
      createdAt: 100,
    });
    const tiedA = card('aaa', {
      category: 'kitchen',
      techniques: ['scoop'],
      createdAt: 50,
    });
    const tiedB = card('bbb', {
      category: 'kitchen',
      techniques: ['scoop'],
      createdAt: 50,
    });
    const shuffles: CommunityCard[][] = [
      [tiedB, twoSignalsOlder, threeSignals, tiedA, twoSignalsNewer],
      [threeSignals, tiedA, tiedB, twoSignalsNewer, twoSignalsOlder],
      [twoSignalsNewer, tiedB, tiedA, threeSignals, twoSignalsOlder],
    ];
    for (const index of shuffles) {
      expect(findSimilarDesigns(target, index).map((c) => c.id)).toEqual([
        'all3',
        'two-newer',
        'two-older',
        'aaa',
        'bbb',
      ]);
    }
  });

  it('returns at most six designs by default', () => {
    const index = Array.from({ length: 10 }, (_, i) => card(`match-${i}`, { createdAt: i }));
    const result = findSimilarDesigns(target, index);
    expect(result).toHaveLength(SIMILAR_DESIGNS_MAX);
    expect(result[0].id).toBe('match-9');
  });

  it('returns an empty list when nothing shares a signal', () => {
    const unrelated = card('none', {
      category: 'kitchen',
      techniques: ['slotted'],
      metrics: { width: 420, depth: 420, height: 42, gridUnitMm: 42 },
    });
    expect(findSimilarDesigns(target, [unrelated])).toEqual([]);
  });
});
