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

import type { Cutout, CutoutShape, GroupOp } from '@/features/bin-designer/types';
import { DEFAULT_GROUP_OP } from '@/features/bin-designer/types';
import { groupTag, unitKey } from '@/features/bin-designer/utils/cutoutHierarchy';

/** A single cutout row. */
export interface ShapeListLeaf {
  readonly kind: 'shape';
  readonly id: string;
  readonly cutout: Cutout;
  /** True when this row sits inside a group. */
  readonly nested: boolean;
  /** How many groups enclose the row, for indentation. */
  readonly depth: number;
  /** Groups enclosing this row, outermost first. */
  readonly context: readonly string[];
}

/**
 * A group row and the rows beneath it, topmost first.
 *
 * `groupKind` is what the row is: a `boolean` group is the one the generator
 * fuses by its op, a `container` only binds its children for arranging. The
 * shape list is the one place both are visible at once, so it is the one place
 * the difference has to be legible.
 */
export interface ShapeListGroup {
  readonly kind: 'group';
  readonly id: string;
  readonly groupId: string;
  readonly groupKind: 'boolean' | 'container';
  /** The op fused by a boolean group; absent on a container. */
  readonly op?: GroupOp;
  /** User-chosen name, absent when the row falls back to a derived label. */
  readonly name?: string;
  /** Direct children, groups and shapes alike. */
  readonly children: readonly ShapeListNode[];
  /** Every cutout beneath this row, at any depth. */
  readonly cutouts: readonly Cutout[];
  /** Every descendant is locked. */
  readonly locked: boolean;
  /** Every descendant is hidden. */
  readonly hidden: boolean;
  /** How many groups enclose the row, for indentation. */
  readonly depth: number;
  /** Groups enclosing this row, outermost first — excludes `groupId` itself. */
  readonly context: readonly string[];
}

export type ShapeListNode = ShapeListGroup | ShapeListLeaf;

/** Ids a row acts on: itself for a shape, every descendant for a group. */
export function nodeIds(node: ShapeListNode): readonly string[] {
  return node.kind === 'group' ? node.cutouts.map((c) => c.id) : [node.id];
}

/** Every row beneath `node`, itself included, in display order. */
export function flattenNodes(nodes: readonly ShapeListNode[]): readonly ShapeListNode[] {
  const out: ShapeListNode[] = [];
  const walk = (list: readonly ShapeListNode[]): void => {
    for (const node of list) {
      out.push(node);
      if (node.kind === 'group') walk(node.children);
    }
  };
  walk(nodes);
  return out;
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
 *
 * Recurses one level per group: the cutouts of a group are re-partitioned
 * against a context one deeper, which is the same `unitKey` grouping the canvas
 * and the arrange math use. Sorting happens once at the top and the order is
 * carried down, so a nested row never re-sorts into a different position than
 * the stack it belongs to.
 */
export function buildShapeList(
  cutouts: readonly Cutout[],
  groupNames: Readonly<Record<string, string>> = {}
): readonly ShapeListNode[] {
  const sorted = [...cutouts].sort(byStackDesc(cutouts));

  const build = (
    list: readonly Cutout[],
    context: readonly string[],
    depth: number
  ): ShapeListNode[] => {
    const byUnit = new Map<string, Cutout[]>();
    // Rows in the order they are discovered: a loose cutout is its own row, a
    // group id holds the slot of its topmost member until every member of it
    // has been collected below.
    const order: (Cutout | string)[] = [];

    for (const c of list) {
      const key = unitKey(c, context);
      if (key === undefined) continue;
      if (key === null) {
        order.push(c);
        continue;
      }
      const members = byUnit.get(key);
      if (members) {
        members.push(c);
        continue;
      }
      byUnit.set(key, [c]);
      order.push(key);
    }

    return order.map((entry) => {
      if (typeof entry !== 'string') {
        return {
          kind: 'shape',
          id: entry.id,
          cutout: entry,
          nested: depth > 0,
          depth,
          context,
        } satisfies ShapeListLeaf;
      }
      const members = byUnit.get(entry) ?? [];
      const name = groupNames[entry];
      const booleanMember = members.find((m) => m.groupId === entry);
      return {
        kind: 'group',
        id: groupTag(entry),
        groupId: entry,
        groupKind: booleanMember ? 'boolean' : 'container',
        ...(booleanMember ? { op: booleanMember.groupOp ?? DEFAULT_GROUP_OP } : {}),
        ...(name ? { name } : {}),
        children: build(members, [...context, entry], depth + 1),
        cutouts: members,
        locked: members.every((m) => m.locked === true),
        hidden: members.every((m) => m.hidden === true),
        depth,
        context,
      } satisfies ShapeListGroup;
    });
  };

  return build(sorted, [], 0);
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
  knifeSlot: 'binDesigner.shapeList.derived.knifeSlot',
  text: 'binDesigner.shapeList.derived.text',
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
    // A text row is told apart by what it says, not by its box.
    case 'text':
      return { key, values: { label: cutout.label.trim() } };
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
