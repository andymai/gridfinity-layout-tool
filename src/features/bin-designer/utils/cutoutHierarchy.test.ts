import { beforeEach, describe, expect, it } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import { MAX_GROUP_DEPTH, MAX_PARENT_GROUPS } from '@/features/bin-designer/types';
import {
  canNestDeeper,
  countUnits,
  groupChain,
  groupDepth,
  groupMembers,
  insertGroupAt,
  isBooleanGroup,
  isContainer,
  isWithin,
  outermostGroup,
  parentGroups,
  referencedGroupIds,
  remapGroupChain,
  removeGroup,
  sameChain,
  unitKey,
  unitTag,
  unitTagGroupId,
  withGroupChain,
} from './cutoutHierarchy';

function cut(overrides: Partial<Cutout> & { id: string }): Cutout {
  return {
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
  };
}

/**
 * The tree every test below reads against:
 *
 *   outer
 *   ├─ gA (boolean)  a1, a2
 *   ├─ gB (boolean)  b1
 *   └─ hex           (loose child of outer)
 *   loose            (top level)
 */
const design = (): Cutout[] => [
  cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] }),
  cut({ id: 'a2', groupId: 'gA', parentGroups: ['outer'] }),
  cut({ id: 'b1', groupId: 'gB', parentGroups: ['outer'] }),
  cut({ id: 'hex', groupId: null, parentGroups: ['outer'] }),
  cut({ id: 'loose', groupId: null }),
];

describe('groupChain / groupDepth / outermostGroup', () => {
  it('orders ancestors outermost first with the boolean group last', () => {
    expect(groupChain(cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] }))).toEqual([
      'outer',
      'gA',
    ]);
    expect(groupChain(cut({ id: 'hex', parentGroups: ['outer'] }))).toEqual(['outer']);
    expect(groupChain(cut({ id: 'loose' }))).toEqual([]);
    expect(groupChain(cut({ id: 'flat', groupId: 'g' }))).toEqual(['g']);
  });

  it('counts a loose child of a container as one level deep', () => {
    expect(groupDepth(cut({ id: 'hex', parentGroups: ['outer'] }))).toBe(1);
    expect(groupDepth(cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] }))).toBe(2);
    expect(groupDepth(cut({ id: 'loose' }))).toBe(0);
  });

  it('reports the outermost group, not the boolean one', () => {
    expect(outermostGroup(cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] }))).toBe('outer');
    expect(outermostGroup(cut({ id: 'flat', groupId: 'gA' }))).toBe('gA');
    expect(outermostGroup(cut({ id: 'loose' }))).toBeNull();
  });

  it('treats a missing parentGroups as no ancestors', () => {
    expect(parentGroups(cut({ id: 'loose' }))).toEqual([]);
  });
});

describe('isWithin', () => {
  it('matches on path prefix, not mere membership', () => {
    const a1 = cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] });
    expect(isWithin(a1, [])).toBe(true);
    expect(isWithin(a1, ['outer'])).toBe(true);
    expect(isWithin(a1, ['outer', 'gA'])).toBe(true);
    expect(isWithin(a1, ['gA'])).toBe(false);
    expect(isWithin(a1, ['other'])).toBe(false);
    expect(isWithin(a1, ['outer', 'gA', 'deeper'])).toBe(false);
  });

  it('puts every cutout inside the empty context', () => {
    expect(design().every((c) => isWithin(c, []))).toBe(true);
  });
});

describe('unitKey', () => {
  it('names the child of the context a cutout descends through', () => {
    const cutouts = design();
    const byId = (id: string): Cutout => {
      const found = cutouts.find((c) => c.id === id);
      if (!found) throw new Error(id);
      return found;
    };

    // At the top level, everything under `outer` is one unit.
    expect(unitKey(byId('a1'), [])).toBe('outer');
    expect(unitKey(byId('hex'), [])).toBe('outer');
    expect(unitKey(byId('loose'), [])).toBeNull();

    // Inside `outer`, the subgroups and the loose child are separate units.
    expect(unitKey(byId('a1'), ['outer'])).toBe('gA');
    expect(unitKey(byId('a2'), ['outer'])).toBe('gA');
    expect(unitKey(byId('b1'), ['outer'])).toBe('gB');
    expect(unitKey(byId('hex'), ['outer'])).toBeNull();
  });

  it('separates "its own unit" from "not in this branch"', () => {
    // null means a direct loose child; undefined means outside the context.
    expect(unitKey(cut({ id: 'hex', parentGroups: ['outer'] }), ['outer'])).toBeNull();
    expect(unitKey(cut({ id: 'loose' }), ['outer'])).toBeUndefined();
  });
});

describe('unitTag / unitTagGroupId', () => {
  it('tags a grouped cutout by its unit and a loose one by its own id', () => {
    const a1 = cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] });
    expect(unitTag(a1, [])).toBe('group:outer');
    expect(unitTag(a1, ['outer'])).toBe('group:gA');
    expect(unitTag(cut({ id: 'hex', parentGroups: ['outer'] }), ['outer'])).toBe('shape:hex');
  });

  it('gives loose siblings DISTINCT tags', () => {
    // Sharing one tag would make an operation on either sweep in the other.
    const one = cut({ id: 'hex', parentGroups: ['outer'] });
    const two = cut({ id: 'slot', parentGroups: ['outer'] });
    expect(unitTag(one, ['outer'])).not.toBe(unitTag(two, ['outer']));
  });

  it('returns null for a cutout outside the branch', () => {
    expect(unitTag(cut({ id: 'loose' }), ['outer'])).toBeNull();
  });

  it('reads the group back out of a tag, and null for a shape tag', () => {
    expect(unitTagGroupId('group:gA')).toBe('gA');
    expect(unitTagGroupId('shape:a1')).toBeNull();
  });
});

describe('countUnits', () => {
  it('counts direct children, not descendants', () => {
    // `outer` holds gA (2 cutouts), gB (1) and hex — three units, four cutouts.
    expect(countUnits(design(), ['outer'])).toBe(3);
  });

  it('counts the top level, where a whole assembly is one unit', () => {
    expect(countUnits(design(), [])).toBe(2);
  });

  it('is zero for a group the design does not have', () => {
    expect(countUnits(design(), ['nope'])).toBe(0);
  });
});

describe('sameChain', () => {
  it('compares order, not just membership', () => {
    expect(sameChain(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameChain(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameChain([], [])).toBe(true);
    expect(sameChain(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('groupMembers / isBooleanGroup / isContainer', () => {
  it('collects members of a container at every depth', () => {
    const cutouts = design();
    expect(groupMembers(cutouts, 'outer').map((c) => c.id)).toEqual(['a1', 'a2', 'b1', 'hex']);
    expect(groupMembers(cutouts, 'gA').map((c) => c.id)).toEqual(['a1', 'a2']);
  });

  it('keeps boolean groups and containers disjoint', () => {
    const cutouts = design();
    expect(isBooleanGroup(cutouts, 'gA')).toBe(true);
    expect(isContainer(cutouts, 'gA')).toBe(false);
    expect(isContainer(cutouts, 'outer')).toBe(true);
    expect(isBooleanGroup(cutouts, 'outer')).toBe(false);
  });
});

describe('withGroupChain', () => {
  it('omits parentGroups entirely at the top level', () => {
    const wrapped = withGroupChain(cut({ id: 'a', groupId: 'gA' }), ['outer', 'gA']);
    expect(wrapped.parentGroups).toEqual(['outer']);

    const unwrapped = withGroupChain(wrapped, ['gA']);
    expect(unwrapped.groupId).toBe('gA');
    expect('parentGroups' in unwrapped).toBe(false);
  });

  it('keeps a loose cutout loose, storing the whole chain as parents', () => {
    const hex = withGroupChain(cut({ id: 'hex' }), ['outer', 'inner']);
    expect(hex.groupId).toBeNull();
    expect(hex.parentGroups).toEqual(['outer', 'inner']);
  });

  it('drops parentGroups when a loose cutout returns to the top level', () => {
    const hex = withGroupChain(cut({ id: 'hex', parentGroups: ['outer'] }), []);
    expect(hex.groupId).toBeNull();
    expect('parentGroups' in hex).toBe(false);
  });
});

describe('insertGroupAt', () => {
  it('wraps a flat boolean group without disturbing its groupId', () => {
    const wrapped = insertGroupAt(cut({ id: 'a', groupId: 'gA' }), 'outer', 0);
    expect(wrapped.groupId).toBe('gA');
    expect(wrapped.parentGroups).toEqual(['outer']);
  });

  it('wraps a loose shape into a container', () => {
    const wrapped = insertGroupAt(cut({ id: 'hex' }), 'outer', 0);
    expect(wrapped.groupId).toBeNull();
    expect(wrapped.parentGroups).toEqual(['outer']);
  });

  it('inserts at depth, wrapping only from that level down', () => {
    const deep = insertGroupAt(cut({ id: 'a', groupId: 'gA', parentGroups: ['outer'] }), 'mid', 1);
    expect(deep.parentGroups).toEqual(['outer', 'mid']);
    expect(deep.groupId).toBe('gA');
  });

  it('caps a LOOSE shape one level lower, where the whole chain is stored', () => {
    // A loose cutout keeps every level in `parentGroups`, which the schema and
    // the server cap at MAX_PARENT_GROUPS. Guarding on depth alone would mint a
    // design that edits fine and is then rejected by sync.
    const atCap = cut({ id: 'hex', parentGroups: Array.from({ length: 9 }, (_, i) => `g${i}`) });
    expect(insertGroupAt(atCap, 'more', 0)).toBe(atCap);
    expect(canNestDeeper([atCap])).toBe(false);

    const oneBelow = cut({ id: 'hex', parentGroups: Array.from({ length: 8 }, (_, i) => `g${i}`) });
    expect(canNestDeeper([oneBelow])).toBe(true);
    expect(insertGroupAt(oneBelow, 'more', 0).parentGroups).toHaveLength(9);
  });

  it('never mints a chain the schema would reject', () => {
    for (const parents of [8, 9]) {
      const loose = cut({
        id: 'hex',
        parentGroups: Array.from({ length: parents }, (_, i) => `g${i}`),
      });
      const after = insertGroupAt(loose, 'more', 0);
      expect((after.parentGroups ?? []).length).toBeLessThanOrEqual(MAX_PARENT_GROUPS);
    }
  });

  it('refuses to exceed the depth cap', () => {
    const parents = Array.from({ length: MAX_GROUP_DEPTH - 1 }, (_, i) => `g${i}`);
    const atCap = cut({ id: 'a', groupId: 'leaf', parentGroups: parents });
    expect(groupDepth(atCap)).toBe(MAX_GROUP_DEPTH);
    expect(insertGroupAt(atCap, 'more', 0)).toBe(atCap);
  });
});

describe('removeGroup', () => {
  it('peels a container and leaves the boolean group intact', () => {
    const peeled = removeGroup(cut({ id: 'a', groupId: 'gA', parentGroups: ['outer'] }), 'outer');
    expect(peeled.groupId).toBe('gA');
    expect('parentGroups' in peeled).toBe(false);
  });

  it('does not promote the enclosing container when the boolean group goes', () => {
    // Removing the cutout's OWN group must leave it loose inside its container,
    // never turn that container into the new boolean group.
    const peeled = removeGroup(cut({ id: 'a', groupId: 'gA', parentGroups: ['outer'] }), 'gA');
    expect(peeled.groupId).toBeNull();
    expect(peeled.parentGroups).toEqual(['outer']);
  });

  it('leaves a cutout the group does not enclose untouched', () => {
    const loose = cut({ id: 'loose' });
    expect(removeGroup(loose, 'outer')).toBe(loose);
  });

  it('removes a mid-chain container, closing the gap', () => {
    const peeled = removeGroup(
      cut({ id: 'a', groupId: 'gA', parentGroups: ['outer', 'mid'] }),
      'mid'
    );
    expect(peeled.parentGroups).toEqual(['outer']);
    expect(peeled.groupId).toBe('gA');
  });
});

describe('canNestDeeper', () => {
  it('refuses once any member is already at the cap', () => {
    const parents = Array.from({ length: MAX_GROUP_DEPTH - 1 }, (_, i) => `g${i}`);
    expect(canNestDeeper([cut({ id: 'a', groupId: 'leaf', parentGroups: parents })])).toBe(false);
    expect(canNestDeeper([cut({ id: 'a', groupId: 'leaf', parentGroups: parents.slice(1) })])).toBe(
      true
    );
    expect(canNestDeeper(design())).toBe(true);
  });
});

describe('referencedGroupIds', () => {
  it('spans containers, boolean groups and both cutout arrays', () => {
    const lid = [cut({ id: 'l1', groupId: 'lidGroup' })];
    expect([...referencedGroupIds(design(), lid)].sort()).toEqual([
      'gA',
      'gB',
      'lidGroup',
      'outer',
    ]);
  });

  it('is empty for a design with nothing grouped', () => {
    expect(referencedGroupIds([cut({ id: 'a' }), cut({ id: 'b' })]).size).toBe(0);
  });
});

describe('remapGroupChain', () => {
  let next = 0;
  const mint = (): string => `new${next++}`;
  beforeEach(() => {
    next = 0;
  });

  it('keeps a copy internally intact while detaching it from the original', () => {
    const map = new Map<string, string>();
    const a1 = remapGroupChain(
      cut({ id: 'a1', groupId: 'gA', parentGroups: ['outer'] }),
      map,
      mint
    );
    const a2 = remapGroupChain(
      cut({ id: 'a2', groupId: 'gA', parentGroups: ['outer'] }),
      map,
      mint
    );
    const hex = remapGroupChain(cut({ id: 'hex', parentGroups: ['outer'] }), map, mint);

    // Sharing the map is what keeps the copy one assembly rather than three.
    expect(a1.groupId).toBe(a2.groupId);
    expect(a1.parentGroups).toEqual(a2.parentGroups);
    expect(hex.parentGroups).toEqual(a1.parentGroups);

    // And nothing points back at what it was copied from.
    expect(a1.groupId).not.toBe('gA');
    expect(a1.parentGroups).not.toContain('outer');
  });

  it('returns a top-level cutout untouched rather than re-minting it', () => {
    const loose = cut({ id: 'loose' });
    expect(remapGroupChain(loose, new Map(), mint)).toBe(loose);
  });

  it('mints with the generator the caller supplies', () => {
    const remapped = remapGroupChain(cut({ id: 'a', groupId: 'gA' }), new Map(), () => 'minted');
    expect(remapped.groupId).toBe('minted');
  });
});
