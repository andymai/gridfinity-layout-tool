import type { YearBinRef, YearShortlistEntry, YearStats } from '../types';

/** How many of the highest-scored designs get a mesh, besides the longest print. */
const SHORTLIST_MESHES = 5;

export interface ComplicatedPick {
  readonly design: YearShortlistEntry;
  /** Null when no shortlisted design has a mesh yet. */
  readonly triangles: number | null;
}

/** The designs worth a mesh, the longest print first. */
export function meshCandidates(stats: YearStats): YearBinRef[] {
  const designs: YearBinRef[] = [];
  const seen = new Set<string>();
  for (const design of [
    stats.longestPrint,
    ...stats.complexityShortlist.slice(0, SHORTLIST_MESHES),
  ]) {
    if (!design || seen.has(design.id)) continue;
    seen.add(design.id);
    designs.push(design);
  }
  return designs;
}

/**
 * The shortlisted design with the most triangles, or the top-scored one when
 * no mesh is ready, which the card shows without a count.
 */
export function pickComplicated(
  shortlist: readonly YearShortlistEntry[],
  triangles: (id: string) => number | undefined
): ComplicatedPick | null {
  let best: ComplicatedPick | null = null;
  for (const design of shortlist) {
    const count = triangles(design.id);
    if (count !== undefined && (best?.triangles ?? -1) < count) best = { design, triangles: count };
  }
  if (best) return best;
  const top = shortlist.at(0);
  return top ? { design: top, triangles: null } : null;
}
