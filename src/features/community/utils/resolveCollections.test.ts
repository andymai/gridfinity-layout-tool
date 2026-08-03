import { describe, expect, it } from 'vitest';
import type { CommunityCard } from '@/shared/types/community';
import type { CommunityCollection } from '../data/collections';
import { resolveCollection, resolveCollections } from './resolveCollections';

function card(id: string, overrides: Partial<CommunityCard> = {}): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Casey',
    authorPublicId: 'a'.repeat(32),
    category: 'tools',
    techniques: [],
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

function collection(designIds: string[]): CommunityCollection {
  return {
    id: 'starters',
    titleKey: 'community.collections.starters.title',
    blurbKey: 'community.collections.starters.blurb',
    designIds,
  };
}

describe('resolveCollection', () => {
  it('preserves the curated order rather than the index order', () => {
    const items = [card('c'), card('a'), card('b')];

    const resolved = resolveCollection(collection(['b', 'a', 'c']), items);

    // Sequence is part of the editorial judgement.
    expect(resolved.cards.map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('skips designs that are not live', () => {
    const items = [card('a'), card('b', { status: 'hidden' }), card('c', { status: 'removed' })];

    const resolved = resolveCollection(collection(['a', 'b', 'c']), items);

    expect(resolved.cards.map((c) => c.id)).toEqual(['a']);
    expect(resolved.missingIds).toEqual(['b', 'c']);
  });

  it('reports ids with no card at all', () => {
    const resolved = resolveCollection(collection(['a', 'ghost']), [card('a')]);

    // Lets a curator tell "not published yet" from "my ids are wrong".
    expect(resolved.missingIds).toEqual(['ghost']);
  });

  it('renders a duplicated id once', () => {
    const resolved = resolveCollection(collection(['a', 'a']), [card('a')]);
    expect(resolved.cards.map((c) => c.id)).toEqual(['a']);
  });

  it('carries the i18n keys through untouched', () => {
    const resolved = resolveCollection(collection(['a']), [card('a')]);
    expect(resolved).toMatchObject({
      id: 'starters',
      titleKey: 'community.collections.starters.title',
      blurbKey: 'community.collections.starters.blurb',
    });
  });

  it('resolves to nothing when the index is empty', () => {
    const resolved = resolveCollection(collection(['a']), []);
    expect(resolved.cards).toEqual([]);
    expect(resolved.missingIds).toEqual(['a']);
  });
});

describe('resolveCollections', () => {
  it('drops a collection with nothing left to show', () => {
    const items = [card('a')];
    const collections: CommunityCollection[] = [
      { ...collection(['a']), id: 'keeps' },
      { ...collection(['gone']), id: 'drops' },
    ];

    // An empty shelf advertises a grouping and then fails to deliver it.
    expect(resolveCollections(collections, items).map((c) => c.id)).toEqual(['keeps']);
  });

  it('keeps a collection that only partly resolved', () => {
    const collections = [collection(['a', 'gone'])];

    const resolved = resolveCollections(collections, [card('a')]);

    // Curation never has to be undone because one design went away.
    expect(resolved).toHaveLength(1);
    expect(resolved[0].cards.map((c) => c.id)).toEqual(['a']);
  });

  it('returns nothing when nothing is curated', () => {
    expect(resolveCollections([], [card('a')])).toEqual([]);
  });
});
