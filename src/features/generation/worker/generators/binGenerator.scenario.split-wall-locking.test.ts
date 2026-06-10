// @vitest-environment node
/**
 * Scenario tests for wall locking connectors on split bin pieces (issue #1869).
 *
 * Wall locking adds straight alignment keys to the exterior perimeter walls at
 * each cut so tall pieces resist splaying. The keys assemble by pressing the
 * halves together (no undercut), have a 45° chamfered protruding underside so
 * they print self-supporting, and stop below the rim so the stacking lip is
 * never disturbed.
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
  wallConnector: 'none',
};
const WALL_LOCKING: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: true,
  wallConnector: 'key',
};
/** No connectors at all — plain cut pieces. */
const NO_CONNECTORS: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
  wallConnector: 'none',
};
/** Wall connectors with the floor scarf (alignment connectors) turned OFF. */
const WALL_ONLY: SplitConnectorConfig = {
  ...DEFAULT_SPLIT_CONNECTOR_CONFIG,
  enabled: false,
  wallConnector: 'key',
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

    // The keys + bosses are real geometry, so the meshes must differ.
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

  it('applies wall connectors with the alignment-connector (floor scarf) toggle OFF', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const wallOnly = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, WALL_ONLY);
    const none = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, NO_CONNECTORS);

    // Wall connectors are independent of the floor scarf: with `enabled: false` they must
    // still add real key + pilaster geometry on top of plain cut pieces.
    expect(wallOnly.pieces).toHaveLength(2);
    for (const piece of wallOnly.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.indices.length).toBeGreaterThan(0);
    }
    expect(totalTriCount(wallOnly.pieces)).toBeGreaterThan(totalTriCount(none.pieces));
  }, 60000);

  it('builds valid, non-dropped wall-lock geometry on a 0.6mm nozzle', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    // The wall key + skin + protrusion scale up for a 0.6mm nozzle. Prove the
    // enlarged features still build a watertight, full-height solid in the kernel
    // (not silently dropped by the shrink guard) and add real geometry over a
    // plain cut — this is the printability fix the whole change exists for.
    const wide: SplitConnectorConfig = { ...WALL_LOCKING, nozzleSizeMm: 0.6 };
    const result = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, wide);
    const none = generateSplitPreview(TALL_PARAMS, CUT_PLANES_X, CUT_PLANES_Y, NO_CONNECTORS);

    expect(result.pieces).toHaveLength(2);
    const totalH = TALL_PARAMS.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(hasNoNaNOrInfinity(piece.normals)).toBe(true);
      expect(piece.indices.length).toBeGreaterThan(0);
      const bb = boundingBox(piece.vertices);
      expect(bb.maxZ - bb.minZ).toBeGreaterThan(totalH);
    }
    // The scaled key actually cut/fused — geometry exceeds the plain cut.
    expect(totalTriCount(result.pieces)).toBeGreaterThan(totalTriCount(none.pieces));
  }, 60000);

  it('hosts the key in a thick wall (no boolean failure on the skip-pilaster path)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    // A 4mm wall fully encloses the key, so `addKeyConnectors` skips the pilaster — exercise
    // that path end-to-end to confirm the key still fuses/cuts cleanly into the thick wall.
    const thickParams: BinParams = { ...TALL_PARAMS, wallThickness: 4 };
    const result = generateSplitPreview(thickParams, CUT_PLANES_X, CUT_PLANES_Y, WALL_LOCKING);

    expect(result.pieces).toHaveLength(2);
    const totalH = thickParams.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.indices.length).toBeGreaterThan(0);
      const bb = boundingBox(piece.vertices);
      expect(bb.maxZ - bb.minZ).toBeGreaterThan(totalH);
    }
  }, 60000);
});

/**
 * The connector geometry swaps axes via makePlanPoint/bossDims for depth-direction
 * cuts. Exercise a Y-axis split so that path can't regress unnoticed.
 */
describe('split bin wall locking connectors — Y-axis (depth) cut', () => {
  const TALL_DEPTH_PARAMS: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 8,
    height: 6,
  };
  const CUT_X: number[] = [];
  const CUT_Y = [0];

  it('produces valid full-height pieces with wall locking enabled', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const result = generateSplitPreview(TALL_DEPTH_PARAMS, CUT_X, CUT_Y, WALL_LOCKING);

    expect(result.pieces).toHaveLength(2);
    const totalH = TALL_DEPTH_PARAMS.height * GRIDFINITY.HEIGHT_UNIT;
    for (const piece of result.pieces) {
      expect(hasNoNaNOrInfinity(piece.vertices)).toBe(true);
      expect(piece.indices.length).toBeGreaterThan(0);
      const bb = boundingBox(piece.vertices);
      expect(bb.maxZ - bb.minZ).toBeGreaterThan(totalH);
    }
  }, 60000);

  it('adds connector geometry beyond the floor-only joint', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withWalls = generateSplitPreview(TALL_DEPTH_PARAMS, CUT_X, CUT_Y, WALL_LOCKING);
    const floorOnly = generateSplitPreview(TALL_DEPTH_PARAMS, CUT_X, CUT_Y, FLOOR_ONLY);
    expect(totalTriCount(withWalls.pieces)).toBeGreaterThan(totalTriCount(floorOnly.pieces));
  }, 60000);

  it('does not disturb the stacking lip (top Z unchanged)', () => {
    const generateSplitPreview = getGenerateSplitPreview();
    const withWalls = generateSplitPreview(TALL_DEPTH_PARAMS, CUT_X, CUT_Y, WALL_LOCKING);
    const floorOnly = generateSplitPreview(TALL_DEPTH_PARAMS, CUT_X, CUT_Y, FLOOR_ONLY);
    for (let i = 0; i < withWalls.pieces.length; i++) {
      expect(maxZ(withWalls.pieces[i].vertices)).toBeCloseTo(maxZ(floorOnly.pieces[i].vertices), 1);
    }
  }, 60000);
});
