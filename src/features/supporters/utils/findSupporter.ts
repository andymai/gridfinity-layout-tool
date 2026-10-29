import type { SupporterBin } from './supportersData';

export interface FoundSupporter {
  bin: SupporterBin & { name: string };
  /** How many supporters share exactly this name. */
  exactMatches: number;
}

/**
 * An exact (case-insensitive) name wins; only without one does a substring
 * match count. Both pools are sorted, so the pick is stable across the
 * per-load shuffle. Anonymous supporters carry no name and can't be found.
 */
export function findSupporter(bins: SupporterBin[], query: string): FoundSupporter | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return null;
  const named = bins.filter((b): b is SupporterBin & { name: string } => b.name !== null);
  const exact = named.filter((b) => b.name.toLowerCase() === needle);
  const pool =
    exact.length > 0
      ? exact
      : named
          .filter((b) => b.name.toLowerCase().includes(needle))
          .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name));
  const bin = pool.at(0);
  return bin ? { bin, exactMatches: exact.length } : null;
}
