/**
 * Turn curated id lists into renderable shelves against the loaded index.
 *
 * The curated file is a list of intentions; this is where those meet reality.
 * A design can be removed, hidden, or simply sit outside the capped index, and
 * none of those should require editing the curation.
 */

import type { CommunityCard } from '@/shared/types/community';
import type { CommunityCollection } from '../data/collections';

export interface ResolvedCollection {
  readonly id: string;
  readonly titleKey: string;
  readonly blurbKey: string;
  readonly cards: readonly CommunityCard[];
  /**
   * Curated ids with no live card in the loaded index. Surfaced so a curator
   * can tell "nobody has published this yet" from "my ids are wrong", rather
   * than watching a shelf silently shrink.
   */
  readonly missingIds: readonly string[];
}

/**
 * Resolve one collection. Order follows the curation, not the index: the
 * sequence is part of the editorial judgement, so it is preserved exactly.
 */
export function resolveCollection(
  collection: CommunityCollection,
  items: readonly CommunityCard[]
): ResolvedCollection {
  const live = new Map(
    items.filter((card) => card.status === 'live').map((card) => [card.id, card])
  );

  const cards: CommunityCard[] = [];
  const missingIds: string[] = [];
  // Guard against a duplicated id in the curated list rendering twice.
  const seen = new Set<string>();

  for (const id of collection.designIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const card = live.get(id);
    if (card === undefined) {
      missingIds.push(id);
      continue;
    }
    cards.push(card);
  }

  return {
    id: collection.id,
    titleKey: collection.titleKey,
    blurbKey: collection.blurbKey,
    cards,
    missingIds,
  };
}

/**
 * Resolve every collection, dropping those with nothing left to show.
 *
 * An empty shelf is worse than no shelf: it advertises a grouping and then
 * fails to deliver it. Curation never needs undoing because a design went away.
 */
export function resolveCollections(
  collections: readonly CommunityCollection[],
  items: readonly CommunityCard[]
): ResolvedCollection[] {
  return collections
    .map((collection) => resolveCollection(collection, items))
    .filter((resolved) => resolved.cards.length > 0);
}
