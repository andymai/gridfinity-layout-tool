/**
 * Pair semantics for two-piece designs (a knife block and its handle rest):
 * two ordinary bins share a `pairId`, and every operation that acts on a SET
 * of bins expands that set to whole pairs first. Collision, snapping and
 * rendering never see the pair — only two rectangles — so the gap between the
 * pieces stays ordinary free grid space.
 */

import type { Bin, BinId } from '@/core/types';

/** The other half of a paired bin, or undefined for unpaired/orphaned bins. */
export function pairPartner(bin: Bin, bins: readonly Bin[]): Bin | undefined {
  if (bin.pairId === undefined) return undefined;
  return bins.find((b) => b.pairId === bin.pairId && b.id !== bin.id);
}

/**
 * Expand a set of bin ids to whole pairs: any id whose bin carries a pairId
 * pulls its partner in. Returns the same set instance when nothing was added,
 * so callers can cheaply detect "no pairs involved".
 */
export function expandPairIds(ids: ReadonlySet<BinId>, bins: readonly Bin[]): ReadonlySet<BinId> {
  let expanded: Set<BinId> | null = null;
  for (const bin of bins) {
    if (bin.pairId === undefined || !ids.has(bin.id)) continue;
    const partner = pairPartner(bin, bins);
    if (partner && !ids.has(partner.id) && !(expanded?.has(partner.id) ?? false)) {
      expanded ??= new Set(ids);
      expanded.add(partner.id);
    }
  }
  return expanded ?? ids;
}

/**
 * Strip pairing from bins whose partner is gone (deleted by an older client,
 * dropped in import salvage): a dangling pairId would make every set
 * operation silently no-op its expansion. Returns the same array when every
 * pair is whole.
 */
export function dropOrphanedPairs<T extends { pairId?: string; pairRole?: 'block' | 'rest' }>(
  bins: readonly T[]
): readonly T[] {
  const counts = new Map<string, number>();
  for (const bin of bins) {
    if (bin.pairId !== undefined) counts.set(bin.pairId, (counts.get(bin.pairId) ?? 0) + 1);
  }
  let anyOrphan = false;
  for (const n of counts.values()) if (n !== 2) anyOrphan = true;
  if (!anyOrphan) return bins;
  return bins.map((bin) => {
    if (bin.pairId === undefined || counts.get(bin.pairId) === 2) return bin;
    const { pairId: _pairId, pairRole: _pairRole, ...rest } = bin;
    return rest as T;
  });
}
