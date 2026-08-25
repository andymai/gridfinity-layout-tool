/**
 * Grouping for the design list: branches render underneath the design they came
 * from instead of as peers scattered through the sort order.
 *
 * The result stays a FLAT array. The list's keyboard navigation addresses items
 * by index and its selection by id, so a real tree would have to be flattened
 * for rendering anyway; producing the flattened form directly keeps both
 * working untouched.
 */

import type { SavedDesign } from '@/features/bin-designer/types';

export interface LineageRow {
  readonly design: SavedDesign;
  /** 0 for a design shown at the top level, 1 for a branch shown under it. */
  readonly depth: 0 | 1;
  /** Branches hanging off this row. Always 0 at depth 1. */
  readonly childCount: number;
}

/**
 * Order `designs` so each branch follows its parent, and drop the children of
 * collapsed parents.
 *
 * Only one level is nested: a branch of a branch is shown beside its own parent
 * under their shared root, because two levels of indent in a list this dense
 * reads as noise long before it reads as a hierarchy.
 *
 * A design whose `parentDesignId` is not in `designs` is shown at the top level.
 * That covers a deleted parent and, importantly, a *filtered-out* one: hiding a
 * design because its parent failed the current search would make the search
 * look broken.
 */
export function groupByLineage(
  designs: readonly SavedDesign[],
  expanded: ReadonlySet<string>
): LineageRow[] {
  const byId = new Map(designs.map((d) => [String(d.id), d]));

  /**
   * The top-level design a row belongs under, walking up as far as the list
   * actually contains. Returns null when `design` is itself top level.
   *
   * Walking to the ROOT rather than stopping at the immediate parent is what
   * keeps a branch of a branch on screen: nesting only one level, a grandchild
   * whose parent is also nested would otherwise belong to no rendered row and
   * disappear from the list entirely.
   *
   * `seen` guards a parent cycle in corrupted data, which would otherwise spin
   * here forever.
   */
  const rootOf = (design: SavedDesign): string | null => {
    const seen = new Set<string>([String(design.id)]);
    let current = design;
    let root: string | null = null;
    for (;;) {
      const parentId = current.parentDesignId === undefined ? null : String(current.parentDesignId);
      if (parentId === null || seen.has(parentId)) return root;
      const parent = byId.get(parentId);
      if (parent === undefined) return root;
      root = parentId;
      seen.add(parentId);
      current = parent;
    }
  };

  const childrenOf = new Map<string, SavedDesign[]>();
  for (const design of designs) {
    const root = rootOf(design);
    if (root === null) continue;
    const siblings = childrenOf.get(root) ?? [];
    siblings.push(design);
    childrenOf.set(root, siblings);
  }

  const rows: LineageRow[] = [];
  for (const design of designs) {
    if (rootOf(design) !== null) continue;
    const children = childrenOf.get(String(design.id)) ?? [];
    rows.push({ design, depth: 0, childCount: children.length });
    if (children.length > 0 && expanded.has(String(design.id))) {
      for (const child of children) rows.push({ design: child, depth: 1, childCount: 0 });
    }
  }
  return rows;
}

/**
 * Designs that would disappear from the list if `id` were deleted, so the
 * confirmation can say so rather than silently orphaning them.
 */
export function branchesOf(designs: readonly SavedDesign[], id: string): readonly SavedDesign[] {
  return designs.filter((d) => d.parentDesignId === id && d.id !== id);
}
