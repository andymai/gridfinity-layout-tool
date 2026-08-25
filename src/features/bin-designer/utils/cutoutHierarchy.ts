/**
 * The cutout group tree: reading it, moving through it, and rewriting it.
 *
 * A cutout carries its ancestry inline — `parentGroups` holds the enclosing
 * groups outermost-first and `groupId` holds the innermost one — so the tree is
 * derived from the flat `cutouts` array and nothing else. That is what lets
 * clone, paste, SVG/STL import and undo keep working by mapping the array,
 * exactly as they did when groups were flat.
 *
 * Two kinds of group live in that chain, and the distinction is load-bearing:
 *
 *  - A **boolean group** is named by `groupId`. It holds shapes directly, owns
 *    a `groupOp`, and is the only kind the generator ever sees.
 *  - A **container** appears only inside `parentGroups`. It binds subgroups and
 *    loose shapes into one rigid body for arranging and repeating, and carries
 *    no op.
 *
 * The two sets never overlap ({@link isBooleanGroup} / {@link isContainer}
 * decide by that rule). Keeping them disjoint is what makes nesting invisible
 * to `cutoutBuilder`: it still partitions on `groupId`, and a boolean group's
 * membership can never be changed by wrapping it in something.
 *
 * ## Context
 *
 * Most callers work relative to a **context** — the chain of groups the editor
 * has been drilled into, outermost-first, `[]` at the top level. Within a
 * context, the thing a click selects and the thing an arrange operation moves
 * is the *unit*: the child of the context that a cutout descends through
 * ({@link unitKey}). That single notion is what keeps canvas selection, the
 * shape list and the arrange math agreeing about what "one thing" means.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { MAX_GROUP_DEPTH, MAX_PARENT_GROUPS } from '@/features/bin-designer/types';

/** Ancestors of a cutout, outermost first, excluding its own group. */
export function parentGroups(cutout: Pick<Cutout, 'parentGroups'>): readonly string[] {
  return cutout.parentGroups ?? [];
}

/** Every group a cutout belongs to, outermost first, its own group last. */
export function groupChain(cutout: Pick<Cutout, 'groupId' | 'parentGroups'>): readonly string[] {
  const parents = parentGroups(cutout);
  return cutout.groupId === null ? parents : [...parents, cutout.groupId];
}

/** Whether two ancestry chains name the same groups in the same order. */
export function sameChain(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** How many groups enclose this cutout, its own included. */
export function groupDepth(cutout: Pick<Cutout, 'groupId' | 'parentGroups'>): number {
  return parentGroups(cutout).length + (cutout.groupId === null ? 0 : 1);
}

/** The outermost group a cutout belongs to, or null when it is top-level. */
export function outermostGroup(cutout: Pick<Cutout, 'groupId' | 'parentGroups'>): string | null {
  return groupChain(cutout)[0] ?? null;
}

/**
 * True when `cutout` sits inside every group of `context`, in order.
 *
 * A prefix test rather than a membership test: two different containers can
 * both hold a group called `g`'s worth of shapes only if `g` is the same group,
 * so matching the path from the outside in is what makes "inside THIS branch"
 * unambiguous.
 */
export function isWithin(
  cutout: Pick<Cutout, 'groupId' | 'parentGroups'>,
  context: readonly string[]
): boolean {
  if (context.length === 0) return true;
  const chain = groupChain(cutout);
  if (chain.length < context.length) return false;
  for (let i = 0; i < context.length; i++) {
    if (chain[i] !== context[i]) return false;
  }
  return true;
}

/**
 * The child of `context` that this cutout descends through — the group id when
 * it is inside one, `null` when the cutout is a direct loose child and so is
 * its own unit.
 *
 * Returns `undefined` for a cutout outside the context, which callers filter
 * out; `null` is a real answer and must stay distinguishable from it.
 */
export function unitKey(
  cutout: Pick<Cutout, 'groupId' | 'parentGroups'>,
  context: readonly string[]
): string | null | undefined {
  if (!isWithin(cutout, context)) return undefined;
  return groupChain(cutout)[context.length] ?? null;
}

/**
 * Stable identity of the unit a cutout belongs to within `context`, or `null`
 * when the cutout is outside that branch.
 *
 * A loose direct child tags by its own id rather than by the `null` that
 * {@link unitKey} returns for it — otherwise every loose child of the context
 * would share one key and an operation on any of them would sweep in the rest.
 * The prefixes keep a group id and a cutout id from ever colliding.
 */
export function unitTag(
  cutout: Pick<Cutout, 'id' | 'groupId' | 'parentGroups'>,
  context: readonly string[]
): string | null {
  const key = unitKey(cutout, context);
  if (key === undefined) return null;
  return key === null ? `${SHAPE_TAG}${cutout.id}` : `${GROUP_TAG}${key}`;
}

const GROUP_TAG = 'group:';
const SHAPE_TAG = 'shape:';

/** The tag naming a group as a whole unit. */
export function groupTag(groupId: string): string {
  return `${GROUP_TAG}${groupId}`;
}

/** The tag naming a loose shape as its own unit. */
export function shapeTag(cutoutId: string): string {
  return `${SHAPE_TAG}${cutoutId}`;
}

/** The group a {@link unitTag} names, or null when it tags a loose shape. */
export function unitTagGroupId(tag: string): string | null {
  return tag.startsWith(GROUP_TAG) ? tag.slice(GROUP_TAG.length) : null;
}

/** The cutout a {@link unitTag} names, or null when it tags a group. */
export function unitTagShapeId(tag: string): string | null {
  return tag.startsWith(SHAPE_TAG) ? tag.slice(SHAPE_TAG.length) : null;
}

/** The distinct units these cutouts occupy at `context`, skipping any outside it. */
export function unitTags(cutouts: readonly Cutout[], context: readonly string[]): Set<string> {
  const tags = new Set<string>();
  for (const cutout of cutouts) {
    const tag = unitTag(cutout, context);
    if (tag !== null) tags.add(tag);
  }
  return tags;
}

/** How many direct children a level has — groups count once, shapes once each. */
export function countUnits(cutouts: readonly Cutout[], context: readonly string[]): number {
  return unitTags(cutouts, context).size;
}

/**
 * Ids one click selects: every cutout sharing `cutout`'s unit at `context`, or
 * the cutout alone when it sits outside that branch.
 */
export function unitSelectionIds(
  cutouts: readonly Cutout[],
  cutout: Cutout,
  context: readonly string[]
): Set<string> {
  const tag = unitTag(cutout, context);
  if (tag === null) return new Set([cutout.id]);
  return new Set(cutouts.filter((c) => unitTag(c, context) === tag).map((c) => c.id));
}

/** Every cutout inside `groupId`, at any depth. */
export function groupMembers(cutouts: readonly Cutout[], groupId: string): readonly Cutout[] {
  return cutouts.filter((c) => groupChain(c).includes(groupId));
}

/** True when `groupId` reaches the generator and owns an op. */
export function isBooleanGroup(cutouts: readonly Cutout[], groupId: string): boolean {
  return cutouts.some((c) => c.groupId === groupId);
}

/** True when `groupId` names an arrange-only container. */
export function isContainer(cutouts: readonly Cutout[], groupId: string): boolean {
  return cutouts.some((c) => parentGroups(c).includes(groupId));
}

/**
 * Split a chain back into the two stored fields.
 *
 * `groupId` keeps the innermost entry only when that entry is a boolean group;
 * a chain that ends at a container belongs to a loose child, which stores the
 * whole chain in `parentGroups` and leaves `groupId` null.
 */
function toFields(
  chain: readonly string[],
  endsInBooleanGroup: boolean
): Pick<Cutout, 'groupId' | 'parentGroups'> {
  if (!endsInBooleanGroup) {
    return { groupId: null, parentGroups: chain.length > 0 ? [...chain] : undefined };
  }
  const parents = chain.slice(0, -1);
  return {
    groupId: chain[chain.length - 1] ?? null,
    parentGroups: parents.length > 0 ? parents : undefined,
  };
}

/**
 * Rewrite a cutout's ancestry to `chain`.
 *
 * `parentGroups` is dropped rather than set to `[]` when the cutout ends up
 * top-level, so a design that never nests serializes byte-identically to one
 * saved before nesting existed — the same reason every other optional cutout
 * field is omitted rather than defaulted.
 */
export function withGroupChain(
  cutout: Cutout,
  chain: readonly string[],
  endsInBooleanGroup: boolean = cutout.groupId !== null
): Cutout {
  const fields = toFields(chain, endsInBooleanGroup);
  const { parentGroups: _drop, ...rest } = cutout;
  return fields.parentGroups === undefined
    ? { ...rest, groupId: fields.groupId }
    : { ...rest, groupId: fields.groupId, parentGroups: fields.parentGroups };
}

/**
 * The longest ancestry chain this cutout can actually STORE.
 *
 * A grouped cutout spends its innermost level on `groupId`, so it gets the full
 * {@link MAX_GROUP_DEPTH}. A loose one keeps every level in `parentGroups`,
 * which the schema and the server cap one lower at {@link MAX_PARENT_GROUPS}.
 * Guarding on depth alone lets the editor mint a loose shape with ten ancestors
 * — a design that edits fine and is then rejected by sync and share.
 */
export function maxChainLength(cutout: Pick<Cutout, 'groupId'>): number {
  return cutout.groupId === null ? MAX_PARENT_GROUPS : MAX_GROUP_DEPTH;
}

/**
 * Insert `groupId` as a new container at `depth`, wrapping whatever the cutout
 * currently sits in from that level down.
 *
 * Refuses past {@link maxChainLength} by returning the cutout untouched;
 * callers gate on {@link canNestDeeper} first so the UI can explain itself
 * rather than silently doing nothing.
 */
export function insertGroupAt(cutout: Cutout, groupId: string, depth: number): Cutout {
  const chain = groupChain(cutout);
  if (chain.length + 1 > maxChainLength(cutout)) return cutout;
  const next = [...chain.slice(0, depth), groupId, ...chain.slice(depth)];
  return withGroupChain(cutout, next);
}

/**
 * Remove `groupId` from a cutout's ancestry, leaving the rest of the chain.
 *
 * Passes the boolean-group flag explicitly rather than letting
 * {@link withGroupChain} infer it: when the group being removed IS the
 * cutout's own, inference would read the still-set `groupId` as "ends in a
 * boolean group" and promote the enclosing container into that slot — turning
 * a container into a boolean group nothing asked for.
 */
export function removeGroup(cutout: Cutout, groupId: string): Cutout {
  const chain = groupChain(cutout);
  if (!chain.includes(groupId)) return cutout;
  return withGroupChain(
    cutout,
    chain.filter((id) => id !== groupId),
    cutout.groupId !== null && cutout.groupId !== groupId
  );
}

/**
 * Mint fresh ids for a copy's whole ancestry, reusing one map across the batch.
 *
 * Every level is remapped, containers included: carrying `parentGroups` through
 * unchanged would leave a duplicated assembly claiming the ORIGINAL container as
 * its parent, so the copy would land inside the thing it was copied from instead
 * of beside it. Sharing the map across the batch is what keeps the copy's own
 * internal structure intact.
 */
export function remapGroupChain(
  cutout: Cutout,
  groupMap: Map<string, string>,
  mint: () => string
): Cutout {
  const fresh = (id: string): string => {
    const mapped = groupMap.get(id);
    if (mapped !== undefined) return mapped;
    const minted = mint();
    groupMap.set(id, minted);
    return minted;
  };
  const chain = groupChain(cutout);
  if (chain.length === 0) return cutout;
  return withGroupChain(cutout, chain.map(fresh));
}

/** True when every cutout in `members` could take one more enclosing level. */
export function canNestDeeper(members: readonly Cutout[]): boolean {
  return members.every((m) => groupChain(m).length + 1 <= maxChainLength(m));
}

/**
 * The group ids a design still refers to — what a `cutoutGroupNames` sweep
 * keeps. Spans both cutout arrays, since one map serves the bin and its lid.
 */
export function referencedGroupIds(...arrays: readonly (readonly Cutout[])[]): Set<string> {
  const ids = new Set<string>();
  for (const cutouts of arrays) {
    for (const c of cutouts) {
      for (const id of groupChain(c)) ids.add(id);
    }
  }
  return ids;
}
