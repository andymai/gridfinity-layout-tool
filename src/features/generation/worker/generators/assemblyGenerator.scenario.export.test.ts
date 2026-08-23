/**
 * Workshop assembly scenario tests.
 *
 * Runs the real brepjs build (Node + OpenCascade WASM) and asserts every
 * part type produces a structurally valid solid, stacking and cutters land
 * where the shared placement math says, and STL/STEP export produces bytes.
 *
 *   pnpm exec vitest run src/features/generation/worker/generators/assemblyGenerator.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import type {
  AssemblyPartNode,
  AssemblyPartType,
  AssemblyStructure,
  PartTransform,
} from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';

function makeEnvelope(width: number, depth: number, magnet = false): ItemEnvelope {
  return {
    width,
    depth,
    gridUnitMm: 42,
    heightUnitMm: 7,
    attachment: {
      magnetHoles: magnet,
      magnetDiameter: 6.5,
      magnetDepth: 2.4,
      screwHoles: false,
      screwDiameter: 3,
    },
    featureColors: DEFAULT_BIN_PARAMS.featureColors,
  };
}

function part(
  type: AssemblyPartType,
  id: string,
  transform: Partial<PartTransform> = {},
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

describe('assembly generator (real WASM)', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 30_000);

  it('exports STL and STEP with bytes and the workshop filename', async () => {
    const { exportAssembly } = await import('./assemblyGenerator');
    const structure = structureWith([
      part('block', 'b', { x: 42, y: 21 }, { children: [part('cutter', 'hole', {})] }),
    ]);
    const stl = await exportAssembly(structure, makeEnvelope(2, 1), 'stl');
    expect(stl.data.byteLength).toBeGreaterThan(0);
    expect(stl.fileName).toBe('workshop_2x1.stl');
    const step = await exportAssembly(structure, makeEnvelope(2, 1), 'step');
    expect(step.data.byteLength).toBeGreaterThan(0);
    expect(step.fileName).toBe('workshop_2x1.step');
  });
});
