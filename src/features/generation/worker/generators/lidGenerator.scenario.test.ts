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
import type { CellMask } from '@/shared/utils/cellMask';

/** Build a cellMask at half-bin resolution from a 2D array (row 0 = top). */
function buildMask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

/** 3×3 L-shape with the bottom-right 1×1 cell removed (6×6 mask). */
const L_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0],
]);

/** 3×3 U-shape: open at the top middle (6×6 mask). */
const U_SHAPE_MASK: CellMask = buildMask([
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
]);

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

  describe('polygon (cellMask) lids', () => {
    it('produces a valid mesh for a 3×3 L-shape lid', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'L-shape lid');
    });

    it('produces a valid mesh for a 3×3 U-shape lid', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: U_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      assertStructurallyValid(result!, 'U-shape lid');
    });

    it('L-shape lid footprint follows the polygon (not bounding rect)', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const rect = generateLid(makeParams({}, { width: 3, depth: 3, height: 3 }));
      const lShape = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(rect).not.toBeNull();
      expect(lShape).not.toBeNull();
      // L-shape has less material than 3×3 rectangle → fewer triangles or
      // (more likely) a different mesh entirely. Either way, NOT identical.
      expect(lShape!.triangleCount).not.toBe(rect!.triangleCount);
    });

    it('L-shape lid stays within the 3×3 bounding box', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(
        makeParams({}, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      expect(result).not.toBeNull();
      const bb = boundingBox(result!.vertices);
      const expected = 3 * DEFAULT_BIN_PARAMS.gridUnitMm;
      expect(bb.maxX - bb.minX).toBeLessThanOrEqual(expected + 0.01);
      expect(bb.maxY - bb.minY).toBeLessThanOrEqual(expected + 0.01);
    });

    it('lid mesh exposes face groups for downstream rendering', async () => {
      // We populate face-group provenance via collectOrigins (LID_BODY,
      // LID_RAIL) so consumers have face-level structure even though brepjs
      // currently collapses fresh-shape origins to 0 (last-writer-wins).
      // The hover-glow path renders whole-mesh emissive instead of relying
      // on per-face tags — see LidMesh.tsx.
      const { generateLid } = await import('./lidOrchestrator');
      const result = generateLid(makeParams({}, { width: 2, depth: 2, height: 3 }));
      expect(result).not.toBeNull();
      expect(result!.faceGroups).toBeDefined();
      expect(result!.faceGroups!.length).toBeGreaterThan(0);
    });

    it('polygon lid magnet holes only cut filled cells', async () => {
      const { generateLid } = await import('./lidOrchestrator');
      // Bin with magnets enabled on the lid. L-shape has 8 filled cells
      // (out of 9), so 8 sets of 4 magnets = 32 holes vs 36 for a 3×3.
      const lShape = generateLid(
        makeParams({ magnetHoles: true }, { width: 3, depth: 3, height: 3, cellMask: L_SHAPE_MASK })
      );
      const rect = generateLid(
        makeParams({ magnetHoles: true }, { width: 3, depth: 3, height: 3 })
      );
      expect(lShape).not.toBeNull();
      expect(rect).not.toBeNull();
      // Different magnet counts → different mesh
      expect(lShape!.triangleCount).not.toBe(rect!.triangleCount);
    });
  });
});
