import { describe, expect, it } from 'vitest';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
  defaultCutterProfile,
} from '@/shared/items/assembly/descriptor';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { FeatureColorConfig } from '@/shared/types/bin';
import { checkAssembly } from './assemblyChecker';

const envelope = createDefaultEnvelope({ enabled: false } as FeatureColorConfig);

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

const kinds = (parts: AssemblyPartNode[]): string[] =>
  checkAssembly(structureWith(parts), envelope).map((w) => `${w.partId}:${w.kind}`);

describe('checkAssembly', () => {
  it('passes a sane grounded build with no warnings', () => {
    const post = part('post', 'p', { x: 0, y: 0 });
    const block = part('block', 'b', {}, { children: [post] });
    expect(kinds([block])).toEqual([]);
  });

  it('flags a part lifted above its seat', () => {
    expect(kinds([part('post', 'p', { seatZ: 10 })])).toEqual(['p:floating']);
  });

  it('flags a child anchored off its parent top face', () => {
    const child = part('post', 'p', { x: 30, y: 0 });
    const block = part('block', 'b', {}, { children: [child] });
    expect(kinds([block])).toEqual(['p:unsupported']);
  });

  it('flags steep wedges, long bridges, and long hook arms', () => {
    const wedge = part(
      'block',
      'w',
      {},
      {
        params: { width: 40, depth: 20, height: 20, wedgeAngleDeg: 60 },
      }
    );
    expect(kinds([wedge])).toEqual(['w:overhang']);
    const arch = part(
      'arch',
      'a',
      {},
      {
        params: {
          span: 120,
          height: 50,
          style: 'rod',
          rodDiameter: 8,
          bridgeWidth: 10,
          uprightThickness: 6,
          depth: 15,
        },
      }
    );
    expect(kinds([arch])).toEqual(['a:overhang']);
  });

  it('flags a cutter that reaches through the floor into the socket', () => {
    const hole = part(
      'cutter',
      'c',
      { x: 0, y: 0 },
      {
        params: { profile: defaultCutterProfile('circle'), depth: 30, clearance: 0.2, chamfer: 0 },
      }
    );
    const block = part('block', 'b', {}, { children: [hole] });
    // Block is 20 tall; a 30mm cut from its top passes the 2mm floor by 8mm.
    expect(kinds([block])).toEqual(['c:socketBreach']);
  });

  it('flags a part hanging past the base edge', () => {
    expect(kinds([part('block', 'b', { x: 2, y: 42 })])).toEqual(['b:outsideBase']);
  });

  it('reports an array or mirror twin once per part and rule', () => {
    const post = part('post', 'p', { seatZ: 10 }, { array: { count: 4, dx: 20, dy: 0 } });
    expect(kinds([post])).toEqual(['p:floating']);
  });
});
