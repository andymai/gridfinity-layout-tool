// @vitest-environment node
/**
 * Scenario tests for wall locking connectors on split bin pieces (issue #1869).
 *
 * Wall locking adds vertical dovetails to the exterior perimeter walls at each
 * cut so tall pieces resist splaying. The dovetail runs along the build (Z)
 * direction — a constant cross-section per layer, so it prints self-supporting
 * — and stops below the rim so it never disturbs the stacking lip.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { BinParams, SplitConnectorConfig } from '@/shared/types/bin';
import { initBrepjs, getGenerateSplitPreview } from './__kernel-tests__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__kernel-tests__/meshAssertions';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

/** Tall 8×2×6 bin (default 1.2mm walls + stacking lip), split once at x=0. */
const TALL_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 8,
  depth: 2,
  height: 6,
};

const CUT_PLANES_X = [0];
const CUT_PLANES_Y: number[] = [];

const FLOOR_ONLY: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: true,
  wallLocking: false,
};
const WALL_LOCKING: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: true,
  wallLocking: true,
};

function totalTriCount(pieces: { indices: { length: number } }[]): number {
  return pieces.reduce((sum, p) => sum + p.indices.length / 3, 0);
}

function maxZ(vertices: Float32Array): number {
  let max = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) max = Math.max(max, vertices[i + 2]);
  return max;
}

describe('split bin wall locking connectors (#1869)', () => {
  it('produces valid full-height pieces with wall locking enabled', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, WALL_LOCKING);

    expect(result.pieces).toHaveLength(2);
    const totalH = TALL_PARAMS.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(hasNoNaNOrInfinity(piece.normals)).toBe(true);
      expect(piece.indices.length).toBeGreaterThan(0);
      const bb = boundingBox(piece.vertices);
      expect(bb.maxZ - bb.minZ).toBeGreaterThan(totalH);
    }
  }, 60000);

  it('adds connector geometry beyond the floor-only joint', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withWalls = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, WALL_LOCKING);
    const floorOnly = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, FLOOR_ONLY);

    // The dovetails + bosses are real geometry, so the meshes must differ.
    // A silently-dropped boolean (isResultValid shrink guard) would make these equal.
    expect(totalTriCount(withWalls.pieces)).toBeGreaterThan(totalTriCount(floorOnly.pieces));
  }, 60000);

  it('does not disturb the stacking lip (top Z unchanged)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withWalls = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, WALL_LOCKING);
    const floorOnly = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, FLOOR_ONLY);

    for (let i = 0; i < withWalls.pieces.length; i++) {
      const a = maxZ(withWalls.pieces[i].vertices);
      const b = maxZ(floorOnly.pieces[i].vertices);
      expect(a).toBeCloseTo(b, 1);
    }
  }, 60000);

  it('stays inert when wall locking is disabled', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const a = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, FLOOR_ONLY);
    const b = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, {
      ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
      enabled: true,
    });
    expect(totalTriCount(a.pieces)).toBe(totalTriCount(b.pieces));
  }, 60000);
});
