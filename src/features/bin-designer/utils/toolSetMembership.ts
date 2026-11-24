import type { BinParams, Cutout, ToolSetSpec } from '../types';

type ToolSets = Readonly<Record<string, ToolSetSpec>> | undefined;

/** `hasOwn`, not `in`: a group id like "constructor" must not name a set. */
function isSetIn(sets: ToolSets, id: string): boolean {
  return sets !== undefined && Object.hasOwn(sets, id);
}

function innermost(c: Cutout, isSet: (id: string) => boolean): string | null {
  const chain = c.parentGroups ?? [];
  for (let i = chain.length - 1; i >= 0; i--) if (isSet(chain[i])) return chain[i];
  return null;
}

/** The innermost tool set every one of `cutouts` sits in, or null. */
export function toolSetOf(cutouts: readonly Cutout[], sets: ToolSets): string | null {
  if (!sets || cutouts.length === 0) return null;
  // `parentGroups` runs outermost first.
  const innermostFirst = [...(cutouts[0].parentGroups ?? [])].reverse();
  return (
    innermostFirst.find(
      (id) => isSetIn(sets, id) && cutouts.every((c) => c.parentGroups?.includes(id) === true)
    ) ?? null
  );
}

/**
 * The cutouts a set generated: those with a part whose innermost set is
 * `setId`. A shape the user added, or a set nested inside, is not one of them.
 * `setId` counts as a set even when its recipe is gone, so a rebuild still
 * replaces its parts.
 */
export function partsOf(cutouts: readonly Cutout[], setId: string, sets: ToolSets): Cutout[] {
  const isSet = (id: string): boolean => id === setId || isSetIn(sets, id);
  return cutouts.filter((c) => c.toolSetPart !== undefined && innermost(c, isSet) === setId);
}

export function withoutPart(c: Cutout): Cutout {
  const { toolSetPart: _part, ...rest } = c;
  return rest;
}

/**
 * The bin cutouts after an edit, with the part dropped from every one whose set
 * changed since `base`: a part belongs to the set that made it, so a pocket
 * moved out of it (or into another set) is the user's shape from then on and a
 * rebuild leaves it. A loose part joining a set created in the same edit is a
 * copy getting its own recipe, not a move. Null when no part moved.
 */
export function releaseMovedParts(
  base: Pick<BinParams, 'cutouts' | 'cutoutToolSets'>,
  after: Pick<BinParams, 'cutouts' | 'cutoutToolSets'>
): Cutout[] | null {
  const owners = new Map<string, string | null>();
  for (const c of base.cutouts) {
    if (c.toolSetPart !== undefined) owners.set(c.id, toolSetOf([c], base.cutoutToolSets));
  }
  if (owners.size === 0) return null;
  const moved = (c: Cutout): boolean => {
    const before = owners.get(c.id);
    if (c.toolSetPart === undefined || before === undefined) return false;
    const now = toolSetOf([c], after.cutoutToolSets);
    if (now === before) return false;
    return before !== null || now === null || isSetIn(base.cutoutToolSets, now);
  };
  if (!after.cutouts.some(moved)) return null;
  return after.cutouts.map((c) => (moved(c) ? withoutPart(c) : c));
}

/**
 * Drops the part from each of `cloneIds` that did not land in one of
 * `copiedSets`: a pocket copied without its whole set has no recipe to be
 * rebuilt from.
 */
export function releaseClonedParts(
  cutouts: readonly Cutout[],
  cloneIds: ReadonlySet<string>,
  copiedSets: ReadonlySet<string>,
  sets: ToolSets
): Cutout[] | null {
  const stray = (c: Cutout): boolean => {
    if (c.toolSetPart === undefined || !cloneIds.has(c.id)) return false;
    const owner = toolSetOf([c], sets);
    return owner === null || !copiedSets.has(owner);
  };
  if (!cutouts.some(stray)) return null;
  return cutouts.map((c) => (stray(c) ? withoutPart(c) : c));
}

/**
 * The recipes whose set still has a part, or null when every one does. A set
 * is its parts: one whose last part is gone (deleted, moved out, copied apart)
 * is a plain container. Kept as an invariant so a recipe with members but no
 * parts can only come from a design saved before parts existed.
 */
export function setsWithParts(
  cutouts: readonly Cutout[],
  sets: ToolSets
): Record<string, ToolSetSpec> | undefined | null {
  if (!sets) return null;
  const kept = Object.entries(sets).filter(([id]) => partsOf(cutouts, id, sets).length > 0);
  if (kept.length === Object.keys(sets).length) return null;
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}
