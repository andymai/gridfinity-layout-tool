import supportersData from '../data/supporters.json';

export interface SupporterBin {
  id: string;
  /** Display name, or null for supporters who gave no name (rendered as "Anonymous"). */
  name: string | null;
}

/** Named supporters + a count of those who gave no name. Served by `/api/supporters`. */
export interface SupportersData {
  named: string[];
  anonymousCount: number;
}

/**
 * The list baked into the bundle at build time.
 *
 * Only a fallback now that Redis is the source of truth — it keeps the page
 * showing a plausible baseplate if `/api/supporters` is unreachable, rather
 * than an empty one.
 */
export const FALLBACK_SUPPORTERS: SupportersData = {
  named: supportersData.named,
  anonymousCount: supportersData.anonymousCount,
};

/** Total number of supporters (named + anonymous). */
export function getSupporterCount(data: SupportersData = FALLBACK_SUPPORTERS): number {
  return data.named.length + data.anonymousCount;
}

/**
 * Build the full list of supporter bins, shuffled so no one is first or last.
 * Accepts an injectable RNG so tests can assert deterministically.
 */
export function buildSupporterBins(
  data: SupportersData = FALLBACK_SUPPORTERS,
  rng: () => number = Math.random
): SupporterBin[] {
  const bins: SupporterBin[] = [
    ...data.named.map((name, i) => ({ id: `named-${i}`, name })),
    ...Array.from({ length: data.anonymousCount }, (_, i) => ({
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

/** Narrow an unknown API response to `SupportersData`. */
export function isSupportersData(value: unknown): value is SupportersData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SupportersData>;
  return (
    Array.isArray(candidate.named) &&
    candidate.named.every((name) => typeof name === 'string') &&
    typeof candidate.anonymousCount === 'number' &&
    Number.isFinite(candidate.anonymousCount) &&
    candidate.anonymousCount >= 0
  );
}
