/**
 * Tree model behind the cutout shape list.
 *
 * Turns the flat `cutouts` array into the rows the list renders: groups become
 * expandable parents holding their members, ungrouped shapes sit at the top
 * level, and everything is ordered top-of-stack first so the list reads the way
 * the canvas looks.
 *
 * Pure — no store, no React. The list component renders whatever this returns,
 * which keeps the ordering and cascade rules testable without a DOM.
 */

import type { Cutout, CutoutShape } from '@/features/bin-designer/types';

/** A single cutout row. */
export interface ShapeListLeaf {
  readonly kind: 'shape';
  readonly id: string;
  readonly cutout: Cutout;
  /** True when this row sits inside a group. */
  readonly nested: boolean;
}

/** A group row holding its members, topmost member first. */
export interface ShapeListGroup {
  readonly kind: 'group';
  readonly id: string;
  readonly groupId: string;
  readonly members: readonly ShapeListLeaf[];
  /** Every member is locked. */
  readonly locked: boolean;
  /** Every member is hidden. */
  readonly hidden: boolean;
}

export type ShapeListNode = ShapeListGroup | ShapeListLeaf;

/** Ids a row acts on: itself for a shape, every member for a group. */
export function nodeIds(node: ShapeListNode): readonly string[] {
  return node.kind === 'group' ? node.members.map((m) => m.id) : [node.id];
}

/**
 * Stack position, topmost first.
 *
 * Same-layer ties break by area (smaller on top), which is how the RENDERER
 * resolves them — see `renderer/zLayer.ts`. Mirroring the store's array-order
 * tiebreak instead would let the list show one shape above another while the
 * canvas drew and clicked the opposite, defeating the point of the list. Array
 * order is the final tiebreak so equal-area shapes still sort deterministically.
 */
function byStackDesc(cutouts: readonly Cutout[]): (a: Cutout, b: Cutout) => number {
  const indexById = new Map(cutouts.map((c, i) => [c.id, i]));
  const area = (c: Cutout): number => Math.max(c.width * c.depth, 1);
  return (a, b) =>
    (b.zIndex ?? 0) - (a.zIndex ?? 0) ||
    area(a) - area(b) ||
    (indexById.get(b.id) ?? 0) - (indexById.get(a.id) ?? 0);
}

/**
 * Build the list tree, topmost first.
 *
 * A group is positioned by its topmost member, so dragging one member above
 * another group moves the whole group's row — the alternative (ordering groups
 * by their lowest member, or by first appearance) makes rows jump in ways that
 * don't match what the canvas shows.
 */
export function buildShapeList(cutouts: readonly Cutout[]): readonly ShapeListNode[] {
  const cmp = byStackDesc(cutouts);
  const sorted = [...cutouts].sort(cmp);

  const groups = new Map<string, Cutout[]>();
  for (const c of sorted) {
    if (c.groupId === null) continue;
    const members = groups.get(c.groupId);
    if (members) members.push(c);
    else groups.set(c.groupId, [c]);
  }

  const nodes: ShapeListNode[] = [];
  const emittedGroups = new Set<string>();

  for (const c of sorted) {
    if (c.groupId === null) {
      nodes.push({ kind: 'shape', id: c.id, cutout: c, nested: false });
      continue;
    }
    // Emit the group at its topmost member's position, once.
    if (emittedGroups.has(c.groupId)) continue;
    emittedGroups.add(c.groupId);
    const members = groups.get(c.groupId) ?? [];
    nodes.push({
      kind: 'group',
      id: `group:${c.groupId}`,
      groupId: c.groupId,
      members: members.map((m) => ({ kind: 'shape', id: m.id, cutout: m, nested: true })),
      locked: members.every((m) => m.locked === true),
      hidden: members.every((m) => m.hidden === true),
    });
  }

  return nodes;
}

/** Round to 0.1mm, no trailing zeros — matches the editor's other readouts. */
function mm(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * i18n key for a shape's derived label, plus the values to interpolate.
 *
 * Returned rather than formatted so the caller supplies the translator; this
 * module stays pure and testable.
 */
export interface DerivedLabel {
  readonly key: string;
  readonly values: Record<string, string>;
}

const SHAPE_LABEL_KEYS: Record<CutoutShape, string> = {
  rectangle: 'binDesigner.shapeList.derived.rectangle',
  circle: 'binDesigner.shapeList.derived.circle',
  slot: 'binDesigner.shapeList.derived.slot',
  polygon: 'binDesigner.shapeList.derived.polygon',
  path: 'binDesigner.shapeList.derived.path',
  mesh: 'binDesigner.shapeList.derived.mesh',
};

/**
 * What a row shows when the user hasn't named it.
 *
 * Size-bearing shapes get their dimensions so two rectangles are told apart at
 * a glance; a circle reports one diameter rather than a square W×D, and a
 * polygon reports its side count, since that is what distinguishes it.
 */
export function derivedLabel(cutout: Cutout): DerivedLabel {
  const key = SHAPE_LABEL_KEYS[cutout.shape];
  switch (cutout.shape) {
    case 'circle':
      return { key, values: { d: mm(cutout.width) } };
    case 'polygon':
      return { key, values: { sides: String(cutout.sides ?? 6), w: mm(cutout.width) } };
    case 'path':
    case 'mesh':
      return { key, values: { w: mm(cutout.width), d: mm(cutout.depth) } };
    default:
      return { key, values: { w: mm(cutout.width), d: mm(cutout.depth) } };
  }
}

/** True when every id in `ids` is present in `selection`. */
export function allSelected(ids: readonly string[], selection: ReadonlySet<string>): boolean {
  return ids.length > 0 && ids.every((id) => selection.has(id));
}

/** True when some but not all of `ids` are selected. */
export function partiallySelected(ids: readonly string[], selection: ReadonlySet<string>): boolean {
  const hit = ids.filter((id) => selection.has(id)).length;
  return hit > 0 && hit < ids.length;
}
