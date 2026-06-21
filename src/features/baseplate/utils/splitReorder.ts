/**
 * Display reordering for split-baseplate chunk sizes — pure helpers that permute
 * an axis's piece sizes for presentation without changing the multiset (so the
 * bed-load count is unaffected): largest pieces at front/left, fractional edges
 * pinned to the requested end, and a palindromic layout under
 * `preferIdenticalPieces` so opposite outer positions match for 180°-rotation
 * dedup. Split out of the planner to keep that file focused on the search.
 */

/** Threshold for detecting a fractional half-unit (avoids floating-point noise). */
export const FRACTIONAL_THRESHOLD = 0.49;

export function isFractional(value: number): boolean {
  return value - Math.floor(value) >= FRACTIONAL_THRESHOLD;
}

/** Per-position grid-unit capacity caps for an axis (from `axisCapacity`). */
export interface AxisCaps {
  readonly maxFirst: number;
  readonly maxLast: number;
  readonly maxMiddle: number;
}

/**
 * Reorder sizes for display: largest pieces at lowest indices (front/left),
 * while respecting edge constraints and fractional edge placement.
 *
 * When `fractionAtStart` is true and a fractional piece exists, it is pinned to
 * position 0 with the remaining pieces sorted descending.
 *
 * When `preferIdenticalPieces` is true, the integer-sized pieces are arranged
 * palindromically so opposite outer positions have identical sizes — this lets
 * A1 ≡ C2 and A2 ≡ C1 share a canonical fingerprint under 180° rotation.
 */
export function reorderForDisplay(
  sizes: number[],
  caps: AxisCaps,
  fractionAtStart: boolean,
  preferIdenticalPieces: boolean
): number[] {
  if (sizes.length <= 1) return sizes;

  // `caps` come from the same axisCapacity used by partitionAxis, so dovetail
  // tongues are accounted for when reshuffling chunks across positions (#1498).
  const { maxFirst, maxLast, maxMiddle } = caps;
  const fracIdx = sizes.findIndex(isFractional);

  // Pin fractional piece to position 0 (only if it fits there).
  if (fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxFirst) {
    const rest = sizes.filter((_, i) => i !== fracIdx);
    const inner = preferIdenticalPieces
      ? palindromizeWithEdges(rest, maxMiddle, maxLast, maxMiddle)
      : sortDescWithEdges(rest, maxMiddle, maxLast);
    return [sizes[fracIdx], ...inner];
  }

  // Pin fractional piece to last position (prevents middle placement).
  if (!fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxLast) {
    const rest = sizes.filter((_, i) => i !== fracIdx);
    const inner = preferIdenticalPieces
      ? palindromizeWithEdges(rest, maxFirst, maxMiddle, maxMiddle)
      : sortDescWithEdges(rest, maxFirst, maxMiddle);
    return [...inner, sizes[fracIdx]];
  }

  if (preferIdenticalPieces) {
    return palindromizeWithEdges(sizes, maxFirst, maxLast, maxMiddle);
  }

  return sortDescWithEdges(sizes, maxFirst, maxLast);
}

/**
 * Arrange sizes palindromically (sizes[i] = sizes[n-1-i] where possible) while
 * respecting edge constraints. Pairs equal values at outermost positions first,
 * then works inward.
 *
 * Returns sortDescWithEdges' result if no palindromic arrangement satisfies the
 * edge caps — the fitting checker would otherwise reject the tiling.
 */
function palindromizeWithEdges(
  sizes: readonly number[],
  maxFirst: number,
  maxLast: number,
  maxMiddle: number
): number[] {
  if (sizes.length <= 1) return [...sizes];

  const n = sizes.length;

  // Collect every value that can participate in a true palindromic pair (it
  // appears 2+ times in the multiset). What's left over after pairing — the
  // odd-count remainders — must occupy middle slots since no slot at the
  // outer edges can be the half of a matching pair. This finds palindromes
  // even when the unique value is the largest: [5, 4, 4] → pairs [(4,4)],
  // leftovers [5] → result [4, 5, 4].
  const freq = new Map<number, number>();
  for (const s of sizes) freq.set(s, (freq.get(s) ?? 0) + 1);
  const pairs: number[] = [];
  const leftovers: number[] = [];
  for (const [value, count] of freq) {
    for (let i = 0; i < Math.floor(count / 2); i++) pairs.push(value);
    if (count % 2 === 1) leftovers.push(value);
  }
  pairs.sort((a, b) => b - a); // largest pairs at outermost slots
  leftovers.sort((a, b) => b - a);

  const result = new Array<number>(n);
  let left = 0;
  let right = n - 1;
  for (const value of pairs) {
    if (left >= right) break;
    result[left++] = value;
    result[right--] = value;
  }
  for (const value of leftovers) {
    if (left > right) break;
    result[left++] = value;
  }

  // Fall back to the baseline sort if the palindromic layout would overrun a
  // first/last edge cap OR a middle cap (middle slots can have stricter caps
  // than edges when both join sides claim tongue protrusion — only matters
  // for non-standard small gridUnitMm where floor(bed/gu) > floor((bed-P)/gu)).
  const middleOverflow = (): boolean => {
    for (let i = 1; i < n - 1; i++) if (result[i] > maxMiddle) return true;
    return false;
  };
  if (result[0] > maxFirst || result[n - 1] > maxLast || middleOverflow()) {
    return sortDescWithEdges([...sizes], maxFirst, maxLast);
  }
  return result;
}

/**
 * Sort sizes descending while ensuring position 0 fits within paddingFirst
 * and the last position fits within paddingLast.
 *
 * Falls back to the original order if constraints cannot be satisfied.
 */
function sortDescWithEdges(sizes: number[], maxFirst: number, maxLast: number): number[] {
  const pool = [...sizes].sort((a, b) => b - a);

  const firstIdx = pool.findIndex((v) => v <= maxFirst);
  if (firstIdx < 0) return sizes;
  const first = pool.splice(firstIdx, 1)[0];

  if (pool.length === 0 || pool[pool.length - 1] <= maxLast) {
    return [first, ...pool];
  }

  const validLastIdx = pool.findIndex((v) => v <= maxLast);
  if (validLastIdx < 0) return sizes;
  const lastPiece = pool.splice(validLastIdx, 1)[0];
  return [first, ...pool, lastPiece];
}
