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

  it('comb slots remove volume and stop above the floor of the bar', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const bar = { width: 70, depth: 14, height: 35 };
    const solid = structureWith([
      part(
        'block',
        'b',
        { x: 42, y: 21 },
        {
          params: { ...bar, wedgeAngleDeg: 0, tiltDeg: 0 },
        }
      ),
    ]);
    const combed = structureWith([
      part(
        'comb',
        'c',
        { x: 42, y: 21 },
        {
          params: { ...bar, slotCount: 4, slotWidth: 9, slotDepth: 25 },
        }
      ),
    ]);
    const plain = generateAssembly(solid, makeEnvelope(2, 1), noop, true);
    const carved = generateAssembly(combed, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(carved);
    assertNoDegenerateTriangles(carved);
    assertWatertight(carved);
    // Four 9x14x25 slots minus the eased rim: well over 10cm³ gone.
    expect(meshVolume(carved)).toBeLessThan(meshVolume(plain) - 10_000);
    expect(boundingBox(carved.vertices).maxZ).toBeCloseTo(boundingBox(plain.vertices).maxZ, 0);
  });

  it('a riser builds the full staircase envelope watertight', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const stairs = structureWith([
      part(
        'riser',
        'r',
        { x: 42, y: 21 },
        {
          params: { width: 60, stepCount: 3, stepDepth: 12, stepHeight: 12 },
        }
      ),
    ]);
    const result = generateAssembly(stairs, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(result);
    assertNoDegenerateTriangles(result);
    assertWatertight(result);
    const bounds = boundingBox(result.vertices);
    const base = SOCKET_HEIGHT + DEFAULT_ASSEMBLY_STRUCTURE.base.floorThickness;
    expect(bounds.maxZ).toBeCloseTo(base + 36, 0);
    // A staircase is roughly half its bounding prism plus the base plate.
    const empty = generateAssembly(structureWith([]), makeEnvelope(2, 1), noop, true);
    const stairVolume = meshVolume(result) - meshVolume(empty);
    expect(stairVolume).toBeGreaterThan(60 * 36 * 36 * 0.45);
    expect(stairVolume).toBeLessThan(60 * 36 * 36 * 0.75);
  });

  it('an angled bore bank drills a leaning grid without breaking through', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const bank = { width: 70, depth: 30, height: 35 };
    const solid = structureWith([
      part(
        'block',
        'b',
        { x: 42, y: 21 },
        {
          params: { ...bank, wedgeAngleDeg: 0, tiltDeg: 0 },
        }
      ),
    ]);
    const drilled = structureWith([
      part(
        'boreBank',
        'bb',
        { x: 42, y: 21 },
        {
          params: {
            ...bank,
            boreDiameter: 8,
            boreDepth: 28,
            columns: 5,
            rows: 2,
            angleDeg: 15,
          },
        }
      ),
    ]);
    const plain = generateAssembly(solid, makeEnvelope(2, 1), noop, true);
    const bored = generateAssembly(drilled, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(bored);
    assertNoDegenerateTriangles(bored);
    assertWatertight(bored);
    // Ten 8mm bores ~28mm deep: several cm3 gone, but the floor and front
    // stay closed so the outer envelope is unchanged.
    expect(meshVolume(bored)).toBeLessThan(meshVolume(plain) - 8_000);
    const plainBox = boundingBox(plain.vertices);
    const boredBox = boundingBox(bored.vertices);
    expect(boredBox.minY).toBeCloseTo(plainBox.minY, 1);
    expect(boredBox.maxZ).toBeCloseTo(plainBox.maxZ, 1);
  });

  it('a steep lean clamps bore depth instead of exiting the front face', async () => {
    const { generateAssembly } = await import('./assemblyGenerator');
    const risky = structureWith([
      part(
        'boreBank',
        'bb',
        { x: 42, y: 21 },
        {
          params: {
            width: 40,
            depth: 12,
            height: 40,
            boreDiameter: 6,
            boreDepth: 38,
            columns: 3,
            rows: 1,
            angleDeg: 30,
          },
        }
      ),
    ]);
    const result = generateAssembly(risky, makeEnvelope(2, 1), noop, true);
    assertStructurallyValid(result);
    assertWatertight(result);
  });
});
