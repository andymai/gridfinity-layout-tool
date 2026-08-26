import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import {
  buildShapeList,
  flattenNodes,
  nodeIds,
  derivedLabel,
  allSelected,
  partiallySelected,
  type ShapeListGroup,
} from './shapeListModel';

function cutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c-1',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    depth: 15,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const ids = (nodes: readonly { id: string }[]): string[] => nodes.map((n) => n.id);

describe('buildShapeList', () => {
  it('orders topmost first', () => {
    const list = buildShapeList([
      cutout({ id: 'bottom', zIndex: 0 }),
      cutout({ id: 'top', zIndex: 2 }),
      cutout({ id: 'middle', zIndex: 1 }),
    ]);
    expect(ids(list)).toEqual(['top', 'middle', 'bottom']);
  });

  it('breaks same-layer ties by area, like the renderer', () => {
    // zLayer.ts puts the smaller shape on top within a layer, so the list has to
    // agree or it would show one order while the canvas drew another.
    const list = buildShapeList([
      cutout({ id: 'big', width: 40, depth: 40 }),
      cutout({ id: 'small', width: 5, depth: 5 }),
      cutout({ id: 'mid', width: 20, depth: 20 }),
    ]);
    expect(ids(list)).toEqual(['small', 'mid', 'big']);
  });

  it('falls back to array order for equal-area shapes', () => {
    const list = buildShapeList([cutout({ id: 'a' }), cutout({ id: 'b' }), cutout({ id: 'c' })]);
    expect(ids(list)).toEqual(['c', 'b', 'a']);
  });

  it('returns nothing for an empty design', () => {
    expect(buildShapeList([])).toEqual([]);
  });

  describe('groups', () => {
    const grouped = [
      cutout({ id: 'loose', zIndex: 3 }),
      cutout({ id: 'g-a', groupId: 'g1', zIndex: 2 }),
      cutout({ id: 'g-b', groupId: 'g1', zIndex: 1 }),
      cutout({ id: 'under', zIndex: 0 }),
    ];

    it('collapses members into one group row', () => {
      const list = buildShapeList(grouped);
      expect(ids(list)).toEqual(['loose', 'group:g1', 'under']);
    });

    it('positions a group at its topmost member', () => {
      const list = buildShapeList([
        cutout({ id: 'mid', zIndex: 5 }),
        cutout({ id: 'g-a', groupId: 'g1', zIndex: 9 }),
        cutout({ id: 'g-b', groupId: 'g1', zIndex: 1 }),
      ]);
      expect(ids(list)).toEqual(['group:g1', 'mid']);
    });

    it('lists members topmost first', () => {
      const list = buildShapeList(grouped);
      const group = list.find((n) => n.kind === 'group') as ShapeListGroup;
      expect(ids(group.children)).toEqual(['g-a', 'g-b']);
      expect(group.children.every((m) => m.kind === 'shape' && m.nested)).toBe(true);
    });

    it('marks a group locked only when every member is', () => {
      const partial = buildShapeList([
        cutout({ id: 'a', groupId: 'g1', locked: true }),
        cutout({ id: 'b', groupId: 'g1' }),
      ])[0] as ShapeListGroup;
      expect(partial.locked).toBe(false);

      const all = buildShapeList([
        cutout({ id: 'a', groupId: 'g1', locked: true }),
        cutout({ id: 'b', groupId: 'g1', locked: true }),
      ])[0] as ShapeListGroup;
      expect(all.locked).toBe(true);
    });

    it('marks a group hidden only when every member is', () => {
      const partial = buildShapeList([
        cutout({ id: 'a', groupId: 'g1', hidden: true }),
        cutout({ id: 'b', groupId: 'g1' }),
      ])[0] as ShapeListGroup;
      expect(partial.hidden).toBe(false);
    });

    it('keeps separate groups separate', () => {
      const list = buildShapeList([
        cutout({ id: 'a', groupId: 'g1', zIndex: 3 }),
        cutout({ id: 'b', groupId: 'g2', zIndex: 2 }),
      ]);
      expect(ids(list)).toEqual(['group:g1', 'group:g2']);
    });
  });
});

describe('nodeIds', () => {
  it('returns the shape itself for a leaf', () => {
    const [leaf] = buildShapeList([cutout({ id: 'solo' })]);
    expect(nodeIds(leaf)).toEqual(['solo']);
  });

  it('returns every member for a group', () => {
    const [group] = buildShapeList([
      cutout({ id: 'a', groupId: 'g1', zIndex: 1 }),
      cutout({ id: 'b', groupId: 'g1', zIndex: 0 }),
    ]);
    expect(nodeIds(group)).toEqual(['a', 'b']);
  });
});

describe('derivedLabel', () => {
  it('reports width and depth for a rectangle', () => {
    expect(derivedLabel(cutout({ width: 20, depth: 15 }))).toEqual({
      key: 'binDesigner.shapeList.derived.rectangle',
      values: { w: '20', d: '15' },
    });
  });

  it('reports a single diameter for a circle', () => {
    expect(derivedLabel(cutout({ shape: 'circle', width: 12, depth: 12 }))).toEqual({
      key: 'binDesigner.shapeList.derived.circle',
      values: { d: '12' },
    });
  });

  it('reports the side count for a polygon', () => {
    expect(derivedLabel(cutout({ shape: 'polygon', sides: 8, width: 10 })).values).toEqual({
      sides: '8',
      w: '10',
    });
  });

  it('defaults a polygon with no side count to six', () => {
    expect(derivedLabel(cutout({ shape: 'polygon', width: 10 })).values.sides).toBe('6');
  });

  it('rounds to 0.1mm without trailing zeros', () => {
    expect(derivedLabel(cutout({ width: 20.04, depth: 15.55 })).values).toEqual({
      w: '20',
      d: '15.6',
    });
  });

  it('has a key for every shape kind', () => {
    for (const shape of ['rectangle', 'circle', 'slot', 'polygon', 'path', 'mesh'] as const) {
      expect(derivedLabel(cutout({ shape })).key).toContain(shape);
    }
  });
});

describe('selection helpers', () => {
  it('allSelected is true only when every id is selected', () => {
    expect(allSelected(['a', 'b'], new Set(['a', 'b']))).toBe(true);
    expect(allSelected(['a', 'b'], new Set(['a']))).toBe(false);
  });

  it('allSelected is false for an empty row', () => {
    expect(allSelected([], new Set(['a']))).toBe(false);
  });

  it('partiallySelected is true only for a partial hit', () => {
    expect(partiallySelected(['a', 'b'], new Set(['a']))).toBe(true);
    expect(partiallySelected(['a', 'b'], new Set(['a', 'b']))).toBe(false);
    expect(partiallySelected(['a', 'b'], new Set())).toBe(false);
  });
});

describe('nested groups', () => {
  /**
   *   outer
   *   ├─ gA [subtract]  a1, a2
   *   └─ hex
   *   loose
   */
  const nested = (): Cutout[] => [
    cutout({ id: 'a1', groupId: 'gA', groupOp: 'subtract', parentGroups: ['outer'], zIndex: 4 }),
    cutout({ id: 'a2', groupId: 'gA', groupOp: 'subtract', parentGroups: ['outer'], zIndex: 3 }),
    cutout({ id: 'hex', parentGroups: ['outer'], zIndex: 2 }),
    cutout({ id: 'loose', zIndex: 1 }),
  ];

  it('nests a group row inside its container', () => {
    const list = buildShapeList(nested());
    expect(ids(list)).toEqual(['group:outer', 'loose']);

    const outer = list[0] as ShapeListGroup;
    expect(outer.groupKind).toBe('container');
    expect(outer.op).toBeUndefined();
    expect(ids(outer.children)).toEqual(['group:gA', 'hex']);

    const gA = outer.children[0] as ShapeListGroup;
    expect(gA.groupKind).toBe('boolean');
    expect(gA.op).toBe('subtract');
    expect(ids(gA.children)).toEqual(['a1', 'a2']);
  });

  it('indents by depth and carries each row its own context', () => {
    const outer = buildShapeList(nested())[0] as ShapeListGroup;
    expect(outer.depth).toBe(0);
    expect(outer.context).toEqual([]);
    const gA = outer.children[0] as ShapeListGroup;
    expect(gA.depth).toBe(1);
    expect(gA.context).toEqual(['outer']);
    expect(gA.children[0].depth).toBe(2);
    expect(gA.children[0].context).toEqual(['outer', 'gA']);
  });

  it('acts on every descendant from a container row', () => {
    const outer = buildShapeList(nested())[0] as ShapeListGroup;
    expect([...nodeIds(outer)].sort()).toEqual(['a1', 'a2', 'hex']);
  });

  it('uses a group name when the design supplies one', () => {
    const outer = buildShapeList(nested(), { outer: 'Socket tray' })[0] as ShapeListGroup;
    expect(outer.name).toBe('Socket tray');
    // A cleared name falls back to the derived label rather than showing ''.
    expect((buildShapeList(nested(), { outer: '' })[0] as ShapeListGroup).name).toBeUndefined();
  });

  it('marks a container locked only when every descendant is', () => {
    const partly = buildShapeList([
      cutout({ id: 'a1', groupId: 'gA', parentGroups: ['outer'], locked: true }),
      cutout({ id: 'hex', parentGroups: ['outer'] }),
    ])[0] as ShapeListGroup;
    expect(partly.locked).toBe(false);
  });
});

describe('flattenNodes', () => {
  it('walks the whole tree in display order', () => {
    const list = buildShapeList([
      cutout({ id: 'a1', groupId: 'gA', parentGroups: ['outer'], zIndex: 3 }),
      cutout({ id: 'hex', parentGroups: ['outer'], zIndex: 2 }),
      cutout({ id: 'loose', zIndex: 1 }),
    ]);
    expect(ids(flattenNodes(list))).toEqual(['group:outer', 'group:gA', 'a1', 'hex', 'loose']);
  });

  it('is empty for an empty list', () => {
    expect(flattenNodes([])).toEqual([]);
  });
});

describe('derivedLabel — text element', () => {
  it('names a text row by its caption, not its box', () => {
    const label = derivedLabel({
      id: 't1',
      shape: 'text',
      x: 0,
      y: 0,
      width: 12,
      depth: 10,
      cutDepth: 5,
      rotation: 0,
      cornerRadius: 0,
      label: ' M4 bolts ',
      groupId: null,
    });
    expect(label.key).toBe('binDesigner.shapeList.derived.text');
    expect(label.values).toEqual({ label: 'M4 bolts' });
  });
});
