import { describe, expect, it } from 'vitest';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  DEFAULT_PART_TRANSFORM,
  MAX_ASSEMBLY_DEPTH,
  MAX_ASSEMBLY_PARTS,
} from '@/shared/items/assembly/descriptor';
import {
  collectAssemblyIds,
  countAssemblyParts,
  findAssemblyPart,
  withAssemblyPartAdded,
  withAssemblyPartRemoved,
  withAssemblyPartReparented,
  withAssemblyPartUpdated,
} from '@/features/bin-designer/utils/assemblyTree';

function post(id: string, children: AssemblyPartNode[] = []): AssemblyPartNode {
  return { ...createAssemblyPartNode('post', id, { ...DEFAULT_PART_TRANSFORM }), children };
}

const tree = (): AssemblyPartNode[] => [
  post('a', [post('a1'), post('a2', [post('a2x')])]),
  post('b'),
];

describe('findAssemblyPart / countAssemblyParts / collectAssemblyIds', () => {
  it('finds nested nodes and reports null for strangers', () => {
    const parts = tree();
    expect(findAssemblyPart(parts, 'a2x')?.id).toBe('a2x');
    expect(findAssemblyPart(parts, 'nope')).toBeNull();
    expect(countAssemblyParts(parts)).toBe(5);
    expect(collectAssemblyIds(parts)).toEqual(['a', 'a1', 'a2', 'a2x', 'b']);
  });
});

describe('withAssemblyPartAdded', () => {
  it('appends to the roots and to a nested parent', () => {
    const parts = tree();
    const atRoot = withAssemblyPartAdded(parts, null, post('c'));
    expect(atRoot?.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    const nested = withAssemblyPartAdded(parts, 'a2x', post('deep'));
    expect(findAssemblyPart(nested ?? [], 'deep')).not.toBeNull();
    expect(parts[0]?.children).toHaveLength(2);
  });

  it('refuses a missing parent, the count cap, and the depth cap', () => {
    expect(withAssemblyPartAdded(tree(), 'nope', post('c'))).toBeNull();
    const full = Array.from({ length: MAX_ASSEMBLY_PARTS }, (_, i) => post(`p${i}`));
    expect(withAssemblyPartAdded(full, null, post('one-too-many'))).toBeNull();
    let chain = post('d1');
    for (let i = 2; i <= MAX_ASSEMBLY_DEPTH; i += 1) chain = post(`d${i}`, [chain]);
    expect(withAssemblyPartAdded([chain], 'd1', post('too-deep'))).toBeNull();
    expect(withAssemblyPartAdded([chain], `d${MAX_ASSEMBLY_DEPTH}`, post('beside'))).not.toBeNull();
  });
});

describe('withAssemblyPartRemoved', () => {
  it('removes a subtree and reports null for strangers', () => {
    const next = withAssemblyPartRemoved(tree(), 'a2');
    expect(collectAssemblyIds(next ?? [])).toEqual(['a', 'a1', 'b']);
    expect(withAssemblyPartRemoved(tree(), 'nope')).toBeNull();
  });
});

describe('withAssemblyPartUpdated', () => {
  it('updates in place and shares untouched branches', () => {
    const parts = tree();
    const next = withAssemblyPartUpdated(parts, 'a1', (n) => ({
      ...n,
      transform: { ...n.transform, x: 10 },
    }));
    expect(findAssemblyPart(next ?? [], 'a1')?.transform.x).toBe(10);
    expect(next?.[1]).toBe(parts[1]);
    expect(withAssemblyPartUpdated(parts, 'nope', (n) => n)).toBeNull();
  });
});

describe('withAssemblyPartReparented', () => {
  it('moves a subtree to a new parent and to the floor', () => {
    const toB = withAssemblyPartReparented(tree(), 'a2', 'b');
    expect(findAssemblyPart(toB ?? [], 'b')?.children.map((n) => n.id)).toEqual(['a2']);
    expect(findAssemblyPart(toB ?? [], 'a2x')).not.toBeNull();
    const toFloor = withAssemblyPartReparented(tree(), 'a2x', null);
    expect(toFloor?.map((n) => n.id)).toEqual(['a', 'b', 'a2x']);
  });

  it('refuses self, descendants, and depth-cap violations', () => {
    expect(withAssemblyPartReparented(tree(), 'a', 'a')).toBeNull();
    expect(withAssemblyPartReparented(tree(), 'a', 'a2x')).toBeNull();
    let chain = post('d1');
    for (let i = 2; i <= MAX_ASSEMBLY_DEPTH; i += 1) chain = post(`d${i}`, [chain]);
    const parts = [chain, post('mover', [post('mover-child')])];
    expect(withAssemblyPartReparented(parts, 'mover', 'd2')).toBeNull();
  });
});
