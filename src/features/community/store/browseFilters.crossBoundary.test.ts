/**
 * Cross-boundary equality test for the card-order mirror: the gallery fetches
 * the index once and re-sorts it locally, so the client's order for every
 * server sort must match `compareCards` in `api/lib/communityList.ts`,
 * tie-breaks included. api/ cannot import from src/, so only this test holds
 * the two copies together.
 */
import { describe, expect, it } from 'vitest';

import { compareCards as compareServerCards } from '../../../../api/lib/communityList.js';
import type { CommunityCardRecord } from '../../../../api/lib/communityStore.js';
import { COMMUNITY_INDEX_SORTS } from '@/shared/types/community';
import type { CommunityCard, CommunityDesignCounts } from '@/shared/types/community';

import { INITIAL_BROWSE_FILTERS, filterAndSortCards } from './browseFilters';

function card(id: string, counts: CommunityDesignCounts, createdAt: number): CommunityCard {
  return {
    id,
    name: `Bin ${id}`,
    authorName: 'Andy',
    authorPublicId: 'a'.repeat(32),
    category: 'hardware',
    techniques: [],
    metrics: { width: 83.5, depth: 125.5, height: 42, gridUnitMm: 42 },
    thumbnailUrl: `https://blob/${id}.webp`,
    isRemix: false,
    featured: false,
    counts,
    createdAt,
    updatedAt: createdAt,
    status: 'live',
  };
}

function toServerRecord(item: CommunityCard): CommunityCardRecord {
  return {
    id: item.id,
    name: item.name,
    authorPublicId: item.authorPublicId,
    authorName: item.authorName,
    category: item.category,
    techniques: [],
    width: item.metrics.width,
    depth: item.metrics.depth,
    height: item.metrics.height,
    gridUnitMm: item.metrics.gridUnitMm,
    thumbnailUrl: item.thumbnailUrl,
    isRemix: item.isRemix,
    parentId: '',
    featured: item.featured,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    status: item.status,
    likes: item.counts.likes,
    remixes: item.counts.remixes,
    exports: item.counts.exports,
    ...(item.counts.prints !== undefined && { prints: item.counts.prints }),
  };
}

// Ties on every count and on createdAt, fed in an order no sort produces, so
// a side that leans on input order instead of an explicit tie-break shows up.
const CARDS: readonly CommunityCard[] = [
  card('e', { likes: 3, remixes: 1, exports: 0, prints: 2 }, 3000),
  card('c', { likes: 1, remixes: 1, exports: 0, prints: 2 }, 3000),
  card('a', { likes: 3, remixes: 1, exports: 0, prints: 2 }, 1000),
  card('b', { likes: 3, remixes: 0, exports: 0 }, 3000),
  card('d', { likes: 1, remixes: 2, exports: 0, prints: 0 }, 2000),
];

describe('card order (cross-boundary mirror)', () => {
  it.each(COMMUNITY_INDEX_SORTS)('orders the %s sort exactly as the server does', (sort) => {
    const client = filterAndSortCards(CARDS, { ...INITIAL_BROWSE_FILTERS, sort }).map(
      (item) => item.id
    );
    const server = CARDS.map(toServerRecord)
      .sort((x, y) => compareServerCards(x, y, sort))
      .map((record) => record.id);
    expect(client).toEqual(server);
  });
});
