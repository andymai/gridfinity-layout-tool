import { describe, expect, it } from 'vitest';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import { assemblyHeightUnits, assemblyOverhangMm, assemblyRiseMm } from './assemblyPlacement';

function part(
  type: AssemblyPartNode['type'],
  id: string,
  transform: Partial<AssemblyPartNode['transform']> = {},
  extra: Partial<AssemblyPartNode> = {}
): AssemblyPartNode {
  return {
    ...createAssemblyPartNode(type, id, { ...DEFAULT_PART_TRANSFORM, x: 84, y: 42, ...transform }),
    ...extra,
  } as AssemblyPartNode;
}

const structureWith = (parts: AssemblyPartNode[]): AssemblyStructure => ({
  ...DEFAULT_ASSEMBLY_STRUCTURE,
  parts,
});

const EXTENT = { w: 168, d: 84 };

describe('assemblyRiseMm', () => {
  it('is the tallest part top plus socket and floor', () => {
    const post = part('post', 'p', {}, {
      params: { diameter: 8, height: 40 },
    } as Partial<AssemblyPartNode>);
    expect(assemblyRiseMm(structureWith([post]), 10)).toBe(50);
  });

  it('is just socket and floor for an empty build', () => {
    expect(assemblyRiseMm(structureWith([]), 10)).toBe(10);
  });

  it('ignores cutters, whose seat plane is not material', () => {
    const lifted = part('cutter', 'c', { seatZ: 60 });
    expect(assemblyRiseMm(structureWith([lifted]), 10)).toBe(10);
  });

  it('stays consistent with assemblyHeightUnits', () => {
    const post = part('post', 'p', {}, {
      params: { diameter: 8, height: 40 },
    } as Partial<AssemblyPartNode>);
    const structure = structureWith([post]);
    expect(assemblyHeightUnits(structure, 7, 10)).toBe(
      Math.ceil(assemblyRiseMm(structure, 10) / 7)
    );
  });
});

describe('assemblyOverhangMm', () => {
  const blockParams = { params: { width: 40, depth: 20, height: 20 } } as Partial<AssemblyPartNode>;

  it('is undefined when every part stays on the plate', () => {
    expect(assemblyOverhangMm(structureWith([part('block', 'b', {}, blockParams)]), EXTENT)).toBe(
      undefined
    );
  });

  it('reports per-side excess for a part past the edge', () => {
    const flush = part('block', 'b', { x: 0, y: 42 }, blockParams);
    expect(assemblyOverhangMm(structureWith([flush]), EXTENT)).toEqual({
      left: 20,
      right: 0,
      front: 0,
      back: 0,
    });
  });

  it('rotates the footprint before measuring', () => {
    const rotated = part('block', 'b', { x: 0, y: 42, rotZDeg: 90 }, blockParams);
    expect(assemblyOverhangMm(structureWith([rotated]), EXTENT)).toEqual({
      left: 10,
      right: 0,
      front: 0,
      back: 0,
    });
  });

  it('ignores cutters', () => {
    const cutter = part('cutter', 'c', { x: -10, y: 42 });
    expect(assemblyOverhangMm(structureWith([cutter]), EXTENT)).toBe(undefined);
  });
});
