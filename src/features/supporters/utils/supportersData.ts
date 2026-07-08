import supportersData from '../data/supporters.json';

export interface SupporterBin {
  id: string;
  /** Display name, or null for supporters who gave no name (rendered as "Anonymous"). */
  name: string | null;
}

/** Total number of supporters (named + anonymous). */
export function getSupporterCount(): number {
  return supportersData.named.length + supportersData.anonymousCount;
}

/**
 * Build the full list of supporter bins, shuffled so no one is first or last.
 * Accepts an injectable RNG so tests can assert deterministically.
 */
export function buildSupporterBins(rng: () => number = Math.random): SupporterBin[] {
  const bins: SupporterBin[] = [
    ...supportersData.named.map((name, i) => ({ id: `named-${i}`, name })),
    ...Array.from({ length: supportersData.anonymousCount }, (_, i) => ({
      id: `anon-${i}`,
      name: null,
    })),
  ];

  for (let i = bins.length - 1; i > 0; i--) {
    // Clamp so a stray RNG returning exactly 1 can't index out of bounds.
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [bins[i], bins[j]] = [bins[j], bins[i]];
  }

  return bins;
}
