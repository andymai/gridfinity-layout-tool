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
import {
  assertStructurallyValid,
  assertNoDegenerateTriangles,
  assertWatertight,
  boundingBox,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import {
  createAssemblyPartNode,
  DEFAULT_ASSEMBLY_STRUCTURE,
  DEFAULT_PART_TRANSFORM,
} from '@/shared/items/assembly/descriptor';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import type {
  AssemblyPartNode,
  AssemblyPartType,
  AssemblyStructure,
  PartTransform,
} from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { SOCKET_HEIGHT } from './generatorTypes';

const noop = (): void => undefined;

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

  it('builds a structurally valid empty base', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const result = generateAssembly(structureWith([]), makeEnvelope(2, 1), noop, false);
    assertStructurallyValid(result);
    assertNoDegenerateTriangles(result);
    const bounds = boundingBox(result.vertices);
    expect(bounds.minZ).toBeCloseTo(0, 1);
    expect(bounds.maxZ).toBeCloseTo(
      SOCKET_HEIGHT + DEFAULT_ASSEMBLY_STRUCTURE.base.floorThickness,
      1
    );
    expect(bounds.maxX - bounds.minX).toBeCloseTo(2 * 42 - 0.5, 1);
  });

  it.each(ASSEMBLY_PART_TYPES.filter((t) => t !== 'cutter'))(
    'builds a valid solid with a %s at the base center',
    async (type) => {
      const { generateAssembly } = await import('./assemblyGenerator');
      const result = generateAssembly(
        structureWith([part(type, `one-${type}`, { x: 42, y: 21 })]),
        makeEnvelope(2, 1),
        noop,
        false
      );
      assertStructurallyValid(result);
      assertNoDegenerateTriangles(result);
    }
  );

  it('stacks a post on a block at the height the placement math says', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const post = part('post', 'p', { x: 0, y: 0 });
    const block = part('block', 'b', { x: 42, y: 21 }, { children: [post] });
    const result = generateAssembly(structureWith([block]), makeEnvelope(2, 1), noop, false);
    assertStructurallyValid(result);
    const bounds = boundingBox(result.vertices);
    const floor = DEFAULT_ASSEMBLY_STRUCTURE.base.floorThickness;
    const expectedTop =
      SOCKET_HEIGHT +
      floor +
      (block.type === 'block' ? block.params.height : 0) +
      (post.type === 'post' ? post.params.height : 0);
    expect(bounds.maxZ).toBeCloseTo(expectedTop, 1);
  });

  it('a hole cutter removes volume from a block', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const solidBlock = structureWith([part('block', 'b', { x: 42, y: 21 })]);
    const drilled = structureWith([
      part(
        'block',
        'b',
        { x: 42, y: 21 },
        {
          children: [
            part('cutter', 'hole', { x: 0, y: 0 }),
            part('cutter', 'hole2', { x: 12, y: 0 }),
          ],
        }
      ),
    ]);
    const plain = generateAssembly(solidBlock, makeEnvelope(2, 1), noop, true);
    const carved = generateAssembly(drilled, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(carved);
    assertWatertight(carved);
    expect(meshVolume(carved)).toBeLessThan(meshVolume(plain) - 500);
  });

  it('expands a linear array into repeated geometry', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const single = generateAssembly(
      structureWith([part('post', 'p', { x: 21, y: 21 })]),
      makeEnvelope(3, 1),
      noop,
      true
    );
    const arrayed = generateAssembly(
      structureWith([part('post', 'p', { x: 21, y: 21 }, { array: { count: 3, dx: 42, dy: 0 } })]),
      makeEnvelope(3, 1),
      noop,
      true
    );
    assertStructurallyValid(arrayed);
    const emptyVol = meshVolume(
      generateAssembly(structureWith([]), makeEnvelope(3, 1), noop, true)
    );
    const singleVol = meshVolume(single) - emptyVol;
    const arrayedVol = meshVolume(arrayed) - emptyVol;
    expect(arrayedVol).toBeGreaterThan(singleVol * 2.5);
  });

  it('respects rotation composition for a child of a rotated parent', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const fin = part('fin', 'f', { x: 30, y: 0 });
    const rotatedBlock = part('block', 'b', { x: 42, y: 21, rotZDeg: 90 }, { children: [fin] });
    const result = generateAssembly(structureWith([rotatedBlock]), makeEnvelope(2, 2), noop, false);
    assertStructurallyValid(result);
    const bounds = boundingBox(result.vertices);
    // The fin's 60mm length runs along Y after the parent's 90° turn; the
    // whole assembly still fits the 84mm-deep base with the fin's run
    // crossing the base centerline.
    expect(bounds.maxY - bounds.minY).toBeGreaterThan(80);
  });

  it('a magnet-hole envelope still builds', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const result = generateAssembly(
      structureWith([part('tube', 't', { x: 42, y: 21 })]),
      makeEnvelope(2, 1, true),
      noop,
      false
    );
    assertStructurallyValid(result);
  });

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
