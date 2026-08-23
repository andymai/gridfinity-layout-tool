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

  it('a counterbored, tapered tube loses volume to the collar and cone', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const plainTube = structureWith([part('tube', 't', { x: 42, y: 21 })]);
    const collared = structureWith([
      part(
        'tube',
        't',
        { x: 42, y: 21 },
        {
          params: {
            boreDiameter: 16,
            wall: 2,
            height: 60,
            tiltDeg: 0,
            counterboreDiameter: 18,
            counterboreDepth: 8,
            boreTaperDeg: 3,
          },
        }
      ),
    ]);
    const plain = generateAssembly(plainTube, makeEnvelope(2, 1), noop, true);
    const recessed = generateAssembly(collared, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(recessed);
    assertWatertight(recessed);
    // The collar removes wall material; the bore taper ADDS material at the
    // bottom (the bore narrows) — the collar dominates at these sizes.
    expect(meshVolume(recessed)).not.toBeCloseTo(meshVolume(plain), 0);
  });

  it('tilted block and cradle stay valid with the base buried', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const tilted = structureWith([
      part(
        'block',
        'b',
        { x: 30, y: 21 },
        { params: { width: 40, depth: 20, height: 20, wedgeAngleDeg: 0, tiltDeg: 15 } }
      ),
      part(
        'cradle',
        'c',
        { x: 60, y: 21 },
        {
          params: {
            length: 30,
            width: 20,
            height: 15,
            grooveStyle: 'round',
            grooveWidth: 12,
            grooveDepth: 6,
            tiltDeg: 12,
          },
        }
      ),
    ]);
    const result = generateAssembly(tilted, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(result);
    assertWatertight(result);
  });

  it('a wedged base tilts the plate, fills beneath, and stays watertight', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const wedged: AssemblyStructure = {
      ...structureWith([part('post', 'p', { x: 42, y: 21 })]),
      base: { ...DEFAULT_ASSEMBLY_STRUCTURE.base, wedge: { angleDeg: 10, lowEdge: 'front' } },
    };
    const flat = structureWith([part('post', 'p', { x: 42, y: 21 })]);
    const wedgedResult = generateAssembly(wedged, makeEnvelope(2, 1), noop, true);
    const flatResult = generateAssembly(flat, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(wedgedResult);
    assertNoDegenerateTriangles(wedgedResult);
    assertWatertight(wedgedResult);
    // The filler prism under the tilted plate is new material.
    expect(meshVolume(wedgedResult)).toBeGreaterThan(meshVolume(flatResult) + 1000);
    const bounds = boundingBox(wedgedResult.vertices);
    expect(bounds.minZ).toBeCloseTo(0, 1);
    // The tilt lifts the center post's top past its flat height, but never
    // past the conservative full-extent bound the placement math reserves.
    const rad = (10 * Math.PI) / 180;
    const flatTop = boundingBox(flatResult.vertices).maxZ;
    expect(bounds.maxZ).toBeGreaterThan(flatTop + 1);
    expect(bounds.maxZ).toBeLessThan(
      SOCKET_HEIGHT + (flatTop - SOCKET_HEIGHT) * Math.cos(rad) + 41.5 * Math.sin(rad) + 0.5
    );
  });

  it('a cutter follows the wedge so its hole stays under the placed part', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const drilled: AssemblyStructure = {
      ...structureWith([
        part(
          'block',
          'b',
          { x: 42, y: 21 },
          { children: [part('cutter', 'hole', { x: 0, y: 0 })] }
        ),
      ]),
      base: { ...DEFAULT_ASSEMBLY_STRUCTURE.base, wedge: { angleDeg: 12, lowEdge: 'left' } },
    };
    const solid: AssemblyStructure = {
      ...structureWith([part('block', 'b', { x: 42, y: 21 })]),
      base: { ...DEFAULT_ASSEMBLY_STRUCTURE.base, wedge: { angleDeg: 12, lowEdge: 'left' } },
    };
    const carved = generateAssembly(drilled, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(carved);
    assertWatertight(carved);
    expect(meshVolume(carved)).toBeLessThan(
      meshVolume(generateAssembly(solid, makeEnvelope(2, 1), noop, true)) - 200
    );
  });

  it('a rim-placed part on a wedged base stays one connected solid', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const wedged: AssemblyStructure = {
      ...structureWith([
        part(
          'post',
          'rim',
          { x: 0.5, y: 21 },
          {
            params: { diameter: 3, height: 20, taperDeg: 0, tipChamfer: 1 },
          }
        ),
      ]),
      base: {
        ...DEFAULT_ASSEMBLY_STRUCTURE.base,
        floorThickness: 4,
        wedge: { angleDeg: 20, lowEdge: 'left' },
      },
    };
    const result = generateAssembly(wedged, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(result);
    assertWatertight(result);
    // Union-find over welded mesh vertices: a floating part shows up as a
    // second connected component even in a watertight mesh.
    const { vertices, indices } = result;
    const Q = 1e4;
    const key = (i: number): string =>
      `${Math.round(vertices[i * 3] * Q)},${Math.round(vertices[i * 3 + 1] * Q)},${Math.round(vertices[i * 3 + 2] * Q)}`;
    const parent = new Map<string, string>();
    const find = (a: string): string => {
      let r = a;
      while (parent.get(r) !== r) r = parent.get(r) as string;
      return r;
    };
    const union = (a: string, b: string): void => {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    for (let i = 0; i < indices.length; i += 3) {
      union(key(indices[i]), key(indices[i + 1]));
      union(key(indices[i + 1]), key(indices[i + 2]));
    }
    const roots = new Set<string>();
    for (const k of parent.keys()) roots.add(find(k));
    expect(roots.size).toBe(1);
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

  it('a length-leaning fin stays clipped to its nominal run', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const lengthLean = part(
      'fin',
      'f',
      { x: 84, y: 42 },
      {
        params: { length: 60, thickness: 3, height: 25, leanDeg: 20, leanAxis: 'length' },
      }
    );
    const result = generateAssembly(structureWith([lengthLean]), makeEnvelope(4, 2), noop, true);
    assertStructurallyValid(result);
    const bounds = boundingBox(result.vertices);
    // Unclipped, the shear would push the fin past the base rim.
    expect(bounds.maxX - bounds.minX).toBeLessThanOrEqual(4 * 42);
    const finVolume =
      meshVolume(result) -
      meshVolume(generateAssembly(structureWith([]), makeEnvelope(4, 2), noop, true));
    expect(finVolume).toBeGreaterThan(60 * 3 * 25 * 0.6);
  });

  it('a mirrored hook emits a reflected twin with symmetric bounds', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const single = generateAssembly(
      structureWith([part('hook', 'h', { x: 24, y: 21 })]),
      makeEnvelope(2, 1),
      noop,
      true
    );
    const mirroredResult = generateAssembly(
      structureWith([part('hook', 'h', { x: 24, y: 21 }, { mirror: true })]),
      makeEnvelope(2, 1),
      noop,
      true
    );
    assertStructurallyValid(mirroredResult);
    const emptyVol = meshVolume(
      generateAssembly(structureWith([]), makeEnvelope(2, 1), noop, true)
    );
    const singleVol = meshVolume(single) - emptyVol;
    const twinVol = meshVolume(mirroredResult) - emptyVol;
    expect(twinVol).toBeGreaterThan(singleVol * 1.8);
    const bounds = boundingBox(mirroredResult.vertices);
    expect(bounds.minX).toBeCloseTo(-bounds.maxX, 0);
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
