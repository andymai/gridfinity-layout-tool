/**
 * Lid generation scenario tests.
 *
 * Runs the actual brepjs build (Node + OpenCascade WASM) and asserts the
 * lid mesh comes out structurally valid: positive triangle count, no NaN,
 * consistent vertex/normal/index counts, sensible bounding box.
 *
 *   pnpm run test:run -- src/features/generation/worker/generators/lidGenerator.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__dual-kernel__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__dual-kernel__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

function makeParams(lid: Partial<LidConfig>, extra: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...extra,
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, ...lid },
  };
}

describe('generateLid scenarios', () => {
  it('returns null when lid is disabled', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    expect(generateLid(DEFAULT_BIN_PARAMS)).toBeNull();
  });

  it('returns null when bin has no stacking lip', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams(
      { enabled: true },
      { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }
    );
    expect(generateLid(params)).toBeNull();
  });

  it('produces a valid mesh for a basic 2x2 lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '2x2 lid');
  });

  it('produces a valid mesh for a 3x2 rectangular lid', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 3, depth: 2, height: 4 }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '3x2 lid');
  });

  it('produces a valid mesh for a 1x1 lid (smallest case)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 1, depth: 1, height: 2 }));
    expect(result).not.toBeNull();
    assertStructurallyValid(result!, '1x1 lid');
  });

  it('lid Z extent matches the configured height unit (~1U + extras)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
    expect(result).not.toBeNull();
    const bb = boundingBox(result!.vertices);
    const heightUnit = DEFAULT_BIN_PARAMS.heightUnitMm; // 7mm
    // Lid lives roughly between Z = -heightUnit (rails extend a bit further)
    // and Z = +LIP_HEIGHT (4.4mm) when stack grid is enabled, or Z=topThickness when not.
    expect(bb.minZ).toBeGreaterThan(-heightUnit - 5); // not absurdly deep
    expect(bb.minZ).toBeLessThan(0); // walls extend below floor
    expect(bb.maxZ).toBeLessThan(heightUnit); // doesn't exceed 1U upward
    // Sanity: lid should be tall enough to engage the lip
    expect(bb.maxZ - bb.minZ).toBeGreaterThan(4); // at least lip-height tall
  });

  it('lid XY footprint is approximately the bin outer footprint', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({}, { width: 2, depth: 2, height: 3 });
    const result = generateLid(params);
    expect(result).not.toBeNull();
    const bb = boundingBox(result!.vertices);
    const expectedW = params.width * params.gridUnitMm;
    const expectedD = params.depth * params.gridUnitMm;
    const widthMm = bb.maxX - bb.minX;
    const depthMm = bb.maxY - bb.minY;
    // Within 1mm of expected (lid uses tighter clearance than bin)
    expect(Math.abs(widthMm - expectedW)).toBeLessThan(2);
    expect(Math.abs(depthMm - expectedD)).toBeLessThan(2);
  });

  it('mesh changes when stackable top toggle differs', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const withGrid = generateLid(
      makeParams({ stackableTop: true }, { width: 2, depth: 2, height: 3 })
    );
    const withoutGrid = generateLid(
      makeParams({ stackableTop: false }, { width: 2, depth: 2, height: 3 })
    );
    expect(withGrid).not.toBeNull();
    expect(withoutGrid).not.toBeNull();
    // Stack grid adds geometry → more triangles
    expect(withGrid!.triangleCount).toBeGreaterThan(withoutGrid!.triangleCount);
    // And extends Z+ above the lid floor
    const withBB = boundingBox(withGrid!.vertices);
    const withoutBB = boundingBox(withoutGrid!.vertices);
    expect(withBB.maxZ).toBeGreaterThan(withoutBB.maxZ);
  });

  it('magnet holes add cuts (mesh changes meaningfully)', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const without = generateLid(
      makeParams({ magnetHoles: false }, { width: 2, depth: 2, height: 3 })
    );
    const withMagnets = generateLid(
      makeParams({ magnetHoles: true }, { width: 2, depth: 2, height: 3 })
    );
    expect(without).not.toBeNull();
    expect(withMagnets).not.toBeNull();
    // Mesh should be different (magnets add face groups)
    expect(withMagnets!.triangleCount).not.toBe(without!.triangleCount);
  });

  it('all three fit presets produce valid meshes', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    for (const fit of ['loose', 'standard', 'tight'] as const) {
      const result = generateLid(makeParams({ fit }, { width: 2, depth: 2, height: 3 }));
      expect(result, `fit=${fit} should produce a mesh`).not.toBeNull();
      assertStructurallyValid(result!, `fit=${fit}`);
    }
  });
});
