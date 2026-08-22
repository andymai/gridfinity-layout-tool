import { describe, expect, it } from 'vitest';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import {
  resolvePlacedParts,
  snapCoord,
  worldToParentLocal,
  sceneToStore,
  storeToScene,
} from './workshopPlacement';

function part(
  type: 'post' | 'block',
  id: string,
  transform: Partial<AssemblyPartNode['transform']>,
  extra: Partial<AssemblyPartNode> = {}
): AssemblyPartNode {
  return {
    ...createAssemblyPartNode(type, id, { ...DEFAULT_PART_TRANSFORM, ...transform }),
    ...extra,
  } as AssemblyPartNode;
}

function structureWith(parts: AssemblyPartNode[]): AssemblyStructure {
  return { ...DEFAULT_ASSEMBLY_STRUCTURE, parts };
}

describe('resolvePlacedParts', () => {
  it('seats a child on its parent top face, in the parent frame', () => {
    const block = part('block', 'b', { x: 60, y: 30, rotZDeg: 90 });
    const post = part('post', 'p', { x: 10, y: 0 });
    const placed = resolvePlacedParts(structureWith([{ ...block, children: [post] }]));
    const child = placed.find((p) => p.selectId === 'p');
    expect(child?.z).toBe(20);
    expect(child?.rotZDeg).toBe(90);
    expect(child?.x).toBeCloseTo(60);
    expect(child?.y).toBeCloseTo(40);
    expect(child?.parentId).toBe('b');
  });

  it('applies seatZ relative to the parent top, not the floor', () => {
    const block = part('block', 'b', {});
    const sunk = part('post', 'p', { seatZ: -5 });
    const placed = resolvePlacedParts(structureWith([{ ...block, children: [sunk] }]));
    expect(placed.find((p) => p.selectId === 'p')?.z).toBe(15);
  });

  it('expands a linear array with unique keys and one shared selectId', () => {
    const arrayed = part('post', 'p', { x: 10 }, { array: { count: 3, dx: 20, dy: 0 } });
    const placed = resolvePlacedParts(structureWith([arrayed]));
    expect(placed).toHaveLength(3);
    expect(placed.map((p) => p.x)).toEqual([10, 30, 50]);
    expect(new Set(placed.map((p) => p.key)).size).toBe(3);
    expect(new Set(placed.map((p) => p.selectId))).toEqual(new Set(['p']));
  });
});

describe('coordinate helpers', () => {
  it('snaps to the 3.5mm sub-grid and to fine steps', () => {
    expect(snapCoord(5.1, false)).toBeCloseTo(3.5);
    expect(snapCoord(5.3, false)).toBeCloseTo(7);
    expect(snapCoord(5.13, true)).toBeCloseTo(5.1);
  });

  it('round-trips scene and store frames', () => {
    expect(sceneToStore(storeToScene(30, 168), 168)).toBeCloseTo(30);
  });

  it('inverts a rotated parent frame', () => {
    const placed = resolvePlacedParts(
      structureWith([part('block', 'b', { x: 50, y: 50, rotZDeg: 90 })])
    );
    const parent = placed[0];
    if (!parent) throw new Error('unreachable');
    const local = worldToParentLocal({ x: 50, y: 60 }, parent);
    expect(local.x).toBeCloseTo(10);
    expect(local.y).toBeCloseTo(0);
  });
});
