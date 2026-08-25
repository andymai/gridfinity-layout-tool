import { describe, it, expect } from 'vitest';
import { groupByLineage, branchesOf } from './designLineage';
import type { SavedDesign } from '@/features/bin-designer/types';
import { designId } from '@/core/types';

function design(id: string, parent?: string): SavedDesign {
  return {
    id: designId(id),
    name: id,
    params: undefined,
    thumbnail: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    exportFileNameConfig: null,
    ...(parent ? { parentDesignId: designId(parent) } : {}),
  };
}

const NONE = new Set<string>();

describe('groupByLineage', () => {
  it('leaves a flat library flat', () => {
    const rows = groupByLineage([design('a'), design('b')], NONE);
    expect(rows.map((r) => r.design.id)).toEqual(['a', 'b']);
    expect(rows.every((r) => r.depth === 0)).toBe(true);
  });

  it('counts branches on the parent without showing them collapsed', () => {
    const rows = groupByLineage(
      [design('parent'), design('x', 'parent'), design('y', 'parent')],
      NONE
    );

    expect(rows.map((r) => r.design.id)).toEqual(['parent']);
    expect(rows[0].childCount).toBe(2);
  });

  it('shows branches under their parent when expanded', () => {
    const rows = groupByLineage(
      [design('parent'), design('x', 'parent'), design('y', 'parent')],
      new Set(['parent'])
    );

    expect(rows.map((r) => r.design.id)).toEqual(['parent', 'x', 'y']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1]);
  });

  // A branch pulled out from under its parent is still a real design; hiding it
  // would make the sort look like it lost rows.
  it('keeps a branch adjacent to its parent regardless of the incoming order', () => {
    const rows = groupByLineage(
      [design('a'), design('x', 'parent'), design('parent'), design('b')],
      new Set(['parent'])
    );

    expect(rows.map((r) => r.design.id)).toEqual(['a', 'parent', 'x', 'b']);
  });

  // Otherwise a search that excludes the parent silently swallows its branches.
  it('promotes a branch whose parent is not in the list', () => {
    const rows = groupByLineage([design('x', 'missing')], NONE);

    expect(rows).toHaveLength(1);
    expect(rows[0].depth).toBe(0);
    expect(rows[0].childCount).toBe(0);
  });

  it('promotes a branch whose parent was deleted', () => {
    const rows = groupByLineage([design('a'), design('orphan', 'gone')], new Set(['gone']));

    expect(rows.map((r) => r.design.id)).toEqual(['a', 'orphan']);
  });

  // Two levels of indent read as noise in a list this dense.
  it('flattens a branch of a branch to one level', () => {
    const rows = groupByLineage(
      [design('root'), design('mid', 'root'), design('leaf', 'mid')],
      new Set(['root', 'mid'])
    );

    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1]);
    expect(rows.map((r) => r.design.id)).toEqual(['root', 'mid', 'leaf']);
  });

  // A corrupted record pointing at itself must not vanish or recurse.
  it('treats a design parented to itself as a root', () => {
    const rows = groupByLineage([design('self', 'self')], NONE);

    expect(rows).toHaveLength(1);
    expect(rows[0].depth).toBe(0);
  });

  it('never nests a row under a collapsed parent', () => {
    const rows = groupByLineage(
      [design('p1'), design('c1', 'p1'), design('p2'), design('c2', 'p2')],
      new Set(['p2'])
    );

    expect(rows.map((r) => r.design.id)).toEqual(['p1', 'p2', 'c2']);
  });
});

describe('branchesOf', () => {
  it('lists the designs that hang off one design', () => {
    const all = [design('p'), design('a', 'p'), design('b', 'p'), design('c', 'other')];

    expect(branchesOf(all, 'p').map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('returns nothing for a design with no branches', () => {
    expect(branchesOf([design('p'), design('q')], 'p')).toEqual([]);
  });
});
