import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import {
  cutoutPatternBounds,
  expandSelectionToGroups,
  selectionVisualBounds,
  toArrangeUnits,
  unitsBounds,
  unitWidth,
  unitDepth,
} from './cutoutGroups';

const cutout = (id: string, overrides: Partial<Cutout> = {}): Cutout => ({
  id,
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
  ...overrides,
});

describe('expandSelectionToGroups', () => {
  it('returns the selection unchanged when nothing is grouped', () => {
    const all = [cutout('a'), cutout('b')];
    const selected = [all[0]];
    expect(expandSelectionToGroups(all, selected)).toBe(selected);
  });

  it('pulls in the unselected members of a touched group', () => {
    const all = [
      cutout('a', { groupId: 'g1' }),
      cutout('b', { groupId: 'g1' }),
      cutout('c', { groupId: 'g1' }),
      cutout('d'),
    ];
    const expanded = expandSelectionToGroups(all, [all[0]]);
    expect(expanded.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('leaves ungrouped cutouts in the selection alone', () => {
    const all = [cutout('a', { groupId: 'g1' }), cutout('b', { groupId: 'g1' }), cutout('c')];
    const expanded = expandSelectionToGroups(all, [all[0], all[2]]);
    expect(expanded.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not duplicate members already selected', () => {
    const all = [cutout('a', { groupId: 'g1' }), cutout('b', { groupId: 'g1' })];
    expect(expandSelectionToGroups(all, all)).toHaveLength(2);
  });
});

describe('toArrangeUnits', () => {
  it('makes one unit per ungrouped cutout', () => {
    const units = toArrangeUnits([cutout('a'), cutout('b')]);
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.members.length === 1)).toBe(true);
  });

  it('collapses a group into a single unit', () => {
    const units = toArrangeUnits([
      cutout('a', { groupId: 'g1', x: 0 }),
      cutout('b', { groupId: 'g1', x: 30 }),
      cutout('c'),
    ]);
    expect(units).toHaveLength(2);
    expect(units[0].members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(units[1].members.map((m) => m.id)).toEqual(['c']);
  });

  it('spans every member in the unit bounds', () => {
    const [unit] = toArrangeUnits([
      cutout('a', { groupId: 'g1', x: 0, y: 0, width: 10, depth: 10 }),
      cutout('b', { groupId: 'g1', x: 30, y: 20, width: 10, depth: 10 }),
    ]);
    expect(unit.bounds).toEqual({ minX: 0, minY: 0, maxX: 40, maxY: 30 });
    expect(unitWidth(unit)).toBe(40);
    expect(unitDepth(unit)).toBe(30);
  });

  it('uses the rotated silhouette, not the unrotated box', () => {
    const [unit] = toArrangeUnits([
      cutout('a', { x: 0, y: 0, width: 20, depth: 10, rotation: 90 }),
    ]);
    // A 20x10 box turned 90° occupies 10 wide by 20 deep, centred where it was.
    expect(unitWidth(unit)).toBeCloseTo(10);
    expect(unitDepth(unit)).toBeCloseTo(20);
  });

  it('spans every repeat instance, not just the master', () => {
    const [unit] = toArrangeUnits([
      cutout('a', {
        x: 10,
        y: 10,
        width: 10,
        depth: 10,
        array: {
          mode: 'grid',
          cols: 3,
          rows: 2,
          pitchX: 20,
          pitchY: 15,
          count: 6,
          radius: 20,
          startAngle: 0,
          rotateToCenter: false,
        },
      }),
    ]);
    // Grid grows +X/+Y from the master: 2 extra columns at 20mm and 1 extra
    // row at 15mm past the master's 10x10 box.
    expect(unit.bounds).toEqual({ minX: 10, minY: 10, maxX: 60, maxY: 35 });
  });

  it('marks a unit locked when any member is locked', () => {
    const [unit] = toArrangeUnits([
      cutout('a', { groupId: 'g1' }),
      cutout('b', { groupId: 'g1', locked: true }),
    ]);
    expect(unit.locked).toBe(true);
  });

  it('keeps first-appearance order', () => {
    const units = toArrangeUnits([
      cutout('a'),
      cutout('b', { groupId: 'g1' }),
      cutout('c'),
      cutout('d', { groupId: 'g1' }),
    ]);
    expect(units.map((u) => u.members[0].id)).toEqual(['a', 'b', 'c']);
  });
});

describe('selectionVisualBounds', () => {
  it('spans rotated silhouettes and repeat instances', () => {
    const bounds = selectionVisualBounds([
      cutout('a', { x: 0, y: 5, width: 20, depth: 10, rotation: 90 }),
      cutout('b', {
        x: 30,
        y: 0,
        width: 10,
        depth: 10,
        array: {
          mode: 'grid',
          cols: 2,
          rows: 1,
          pitchX: 20,
          pitchY: 20,
          count: 2,
          radius: 20,
          startAngle: 0,
          rotateToCenter: false,
        },
      }),
    ]);
    // a's turned bar spans [5..15] x [0..20]; b's pattern spans [30..60].
    expect(bounds.minX).toBeCloseTo(5);
    expect(bounds.minY).toBeCloseTo(0);
    expect(bounds.maxX).toBeCloseTo(60);
    expect(bounds.maxY).toBeCloseTo(20);
  });

  it('matches the plain box for an unrotated, unrepeated cutout', () => {
    expect(cutoutPatternBounds(cutout('a', { x: 3, y: 4 }))).toEqual({
      minX: 3,
      minY: 4,
      maxX: 13,
      maxY: 14,
    });
  });

  it('returns a zero box for an empty selection', () => {
    expect(selectionVisualBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});

describe('unitsBounds', () => {
  it('spans every unit', () => {
    const units = toArrangeUnits([
      cutout('a', { x: 5, y: 5 }),
      cutout('b', { x: 40, y: 30, width: 20, depth: 20 }),
    ]);
    expect(unitsBounds(units)).toEqual({ minX: 5, minY: 5, maxX: 60, maxY: 50 });
  });

  it('returns a zero box for an empty list', () => {
    expect(unitsBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});

describe('arrange units with nested groups', () => {
  /**
   * Three assemblies, each a container over one boolean pair, laid out left to
   * right with a deliberate 5mm internal gap:
   *
   *   asmN = { gN: [ x, x+15 ] }
   */
  const assembly = (n: number, originX: number): Cutout[] => [
    cutout(`a${n}`, { groupId: `g${n}`, parentGroups: [`asm${n}`], x: originX }),
    cutout(`b${n}`, { groupId: `g${n}`, parentGroups: [`asm${n}`], x: originX + 15 }),
  ];
  const design = (): Cutout[] => [...assembly(1, 0), ...assembly(2, 60), ...assembly(3, 120)];

  it('treats a whole assembly as one unit at the top level', () => {
    const units = toArrangeUnits(design());
    expect(units).toHaveLength(3);
    // Each unit spans its pair: 10 wide at x, plus 10 wide at x+15 => 25.
    expect(unitWidth(units[0])).toBe(25);
    expect(units.map((u) => u.members.map((m) => m.id))).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
      ['a3', 'b3'],
    ]);
  });

  it('splits an assembly into its children once drilled into it', () => {
    const units = toArrangeUnits(design(), ['asm1']);
    // Only asm1's branch is in scope, and inside it g1 is the single unit.
    expect(units).toHaveLength(1);
    expect(units[0].members.map((m) => m.id)).toEqual(['a1', 'b1']);
  });

  it('separates loose children of a container into their own units', () => {
    const cutouts = [
      cutout('a', { groupId: 'gA', parentGroups: ['outer'] }),
      cutout('b', { groupId: 'gA', parentGroups: ['outer'] }),
      cutout('hex', { parentGroups: ['outer'], x: 40 }),
      cutout('slot', { parentGroups: ['outer'], x: 60 }),
    ];
    const units = toArrangeUnits(cutouts, ['outer']);
    // gA is one unit; the two loose children are one each, never merged.
    expect(units.map((u) => u.members.map((m) => m.id))).toEqual([['a', 'b'], ['hex'], ['slot']]);
  });

  it('expands a partial selection to the whole assembly at the top level', () => {
    const all = design();
    const expanded = expandSelectionToGroups(all, [all[0]]);
    expect(expanded.map((c) => c.id).sort()).toEqual(['a1', 'b1']);
  });

  it('expands only to the subgroup once drilled in', () => {
    const cutouts = [
      cutout('a', { groupId: 'gA', parentGroups: ['outer'] }),
      cutout('b', { groupId: 'gA', parentGroups: ['outer'] }),
      cutout('hex', { parentGroups: ['outer'] }),
    ];
    const expanded = expandSelectionToGroups(cutouts, [cutouts[0]], ['outer']);
    expect(expanded.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('never pulls in a loose sibling, which is its own unit', () => {
    const cutouts = [
      cutout('hex', { parentGroups: ['outer'] }),
      cutout('slot', { parentGroups: ['outer'] }),
    ];
    const selected = [cutouts[0]];
    expect(expandSelectionToGroups(cutouts, selected, ['outer'])).toBe(selected);
  });

  it('ignores cutouts outside the entered branch', () => {
    const cutouts = [...design(), cutout('stray', { x: 200 })];
    const units = toArrangeUnits(cutouts, ['asm2']);
    expect(units.flatMap((u) => u.members.map((m) => m.id))).toEqual(['a2', 'b2']);
  });
});
