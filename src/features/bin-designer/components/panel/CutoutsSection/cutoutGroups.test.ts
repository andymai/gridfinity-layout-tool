import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import {
  expandSelectionToGroups,
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
