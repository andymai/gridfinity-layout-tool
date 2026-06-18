/**
 * Slanted tool rack scenario tests.
 *
 * Runs the real brepjs build (Node + OpenCascade WASM) and asserts the rack
 * mesh is structurally valid with a sensible bounding box, that fin count
 * scales geometry, and that STL/STEP export produces bytes.
 *
 *   pnpm exec vitest run src/features/generation/worker/generators/toolRackGenerator.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertNoDegenerateTriangles,
  boundingBox,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { DEFAULT_TOOL_RACK_STRUCTURE } from '@/shared/items/toolRack/descriptor';
import type { ItemEnvelope, ToolRackStructure } from '@/shared/types/item';
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

function makeStructure(extra: Partial<ToolRackStructure> = {}): ToolRackStructure {
  return {
    ...DEFAULT_TOOL_RACK_STRUCTURE,
    backRail: { ...DEFAULT_TOOL_RACK_STRUCTURE.backRail },
    ...extra,
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('slanted tool rack generation and export', () => {
  it('produces a valid mesh for the default 4x2 rack', async () => {
    const { generateToolRack } = await import('./toolRackGenerator');
    const result = generateToolRack(makeStructure(), makeEnvelope(4, 2), noop, false);
    assertStructurallyValid(result, 'default rack');
    assertNoDegenerateTriangles(result, 'default rack');
  });

  it('produces a valid mesh for the smallest 1x1 rack', async () => {
    const { generateToolRack } = await import('./toolRackGenerator');
    const result = generateToolRack(
      makeStructure({ finCount: 2 }),
      makeEnvelope(1, 1),
      noop,
      false
    );
    assertStructurallyValid(result, '1x1 rack');
  });

  it('bounding box matches footprint and the socket sits below the floor', async () => {
    const { generateToolRack } = await import('./toolRackGenerator');
    const env = makeEnvelope(4, 2);
    const structure = makeStructure();
    const result = generateToolRack(structure, env, noop, false);
    const bb = boundingBox(result.vertices);
    expect(bb.maxX - bb.minX).toBeCloseTo(env.width * env.gridUnitMm, 0);
    expect(bb.maxY - bb.minY).toBeCloseTo(env.depth * env.gridUnitMm, 0);
    // After the +SOCKET_HEIGHT shift, Z=0 is the printable bottom.
    expect(bb.minZ).toBeCloseTo(0, 1);
    // Top reaches socket + floor + fin rise.
    expect(bb.maxZ).toBeGreaterThan(
      SOCKET_HEIGHT + structure.floorThickness + structure.finHeight * 0.8
    );
  });

  it('more fins produce more triangles', async () => {
    const { generateToolRack } = await import('./toolRackGenerator');
    const env = makeEnvelope(6, 2);
    const few = generateToolRack(makeStructure({ finCount: 3 }), env, noop, false);
    const many = generateToolRack(makeStructure({ finCount: 10 }), env, noop, false);
    expect(many.triangleCount).toBeGreaterThan(few.triangleCount);
  });

  it('builds with magnet holes', async () => {
    const { generateToolRack } = await import('./toolRackGenerator');
    const result = generateToolRack(makeStructure(), makeEnvelope(4, 2, true), noop, false);
    assertStructurallyValid(result, 'magnet rack');
  });

  it('exports non-empty STL and STEP', async () => {
    const { exportToolRack } = await import('./toolRackGenerator');
    const env = makeEnvelope(4, 2);
    const stl = await exportToolRack(makeStructure(), env, 'stl');
    expect(stl.data.byteLength).toBeGreaterThan(0);
    expect(stl.fileName).toBe('tool_rack_4x2.stl');
    const step = await exportToolRack(makeStructure(), env, 'step');
    expect(step.data.byteLength).toBeGreaterThan(0);
    expect(step.fileName).toBe('tool_rack_4x2.step');
  });
});
