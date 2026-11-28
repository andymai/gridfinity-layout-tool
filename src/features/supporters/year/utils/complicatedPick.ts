import type { YearBinRef, YearShortlistEntry, YearStats } from '../types';

export interface ComplicatedPick {
  readonly design: YearShortlistEntry;
  /** Null until the design's mesh is ready; the card then shows no count. */
  readonly triangles: number | null;
}

/** The designs worth a mesh: the longest print and the most complicated design, once each. */
export function meshCandidates(stats: YearStats): YearBinRef[] {
  const designs: YearBinRef[] = [];
  for (const design of [stats.longestPrint, stats.complexityShortlist.at(0)]) {
    if (design && !designs.some((each) => each.id === design.id)) designs.push(design);
  }
  return designs;
}

/**
 * The design with the most design work, which the shortlist lists first. Its
 * triangle count is a fact for the card, never the ranking: a pattern or
 * engraved text would otherwise win every year.
 */
export function pickComplicated(
  shortlist: readonly YearShortlistEntry[],
  triangles: (id: string) => number | undefined
): ComplicatedPick | null {
  const top = shortlist.at(0);
  return top ? { design: top, triangles: triangles(top.id) ?? null } : null;
}
