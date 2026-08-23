/**
 * Detects which part ids are NEW between two renders of the placement list,
 * so only genuinely placed parts scan in — never the initial load, and never
 * parts that merely moved or re-parented.
 */
import type { PlacedPart } from '@/shared/types/assemblyPlacement';

export function diffNewPartIds(
  previous: ReadonlySet<string> | null,
  placements: readonly PlacedPart[]
): { ids: Set<string>; fresh: string[] } {
  const ids = new Set(placements.map((p) => p.selectId));
  if (previous === null) return { ids, fresh: [] };
  const fresh: string[] = [];
  for (const id of ids) {
    if (!previous.has(id)) fresh.push(id);
  }
  return { ids, fresh };
}
