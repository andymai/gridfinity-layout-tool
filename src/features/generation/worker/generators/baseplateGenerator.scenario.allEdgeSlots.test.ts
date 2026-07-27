// @vitest-environment node
/**
 * Scenario tests for all-edge seam slots (`connectorSlotsAllEdges`, issue #2866).
 *
 * The option cuts the same female slot the join seams carry into the piece's
 * EXTERIOR edges too, so a split piece is a standard grid tile that can key onto
 * a plate printed later. Verified against the real kernel:
 *   1. the outer wall stays watertight once the slots breach it,
 *   2. the plate's outer extent is unchanged (the slot cuts in, never out), and
 *   3. an exterior slot removes the same volume a join slot does — the property
 *      that makes the tile interchangeable in the first place.
 *   4. a padded exterior edge is skipped (its wall is offset from the grid).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';

type ExportFn = (
  params: ResolvedBaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
}, 30000);

/** 5×4 tile: 4 interior boundaries along X, 3 along Y. */
const WIDTH = 5;
const DEPTH = 4;
const X_BOUNDARIES = 4;
const Y_BOUNDARIES = 3;

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: WIDTH,
  depth: DEPTH,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  connectorNubs: true,
  connectorStyle: 'dovetailKey',
  // Square corners: the option's whole point is an interchangeable tile, and a
  // rounded corner would make the outer pieces differ anyway.
  cornerRadius: 0,
  ...overrides,
});

interface MeshStats {
  volume: number;
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  hasNaN: boolean;
}

/** Signed volume via the divergence theorem — meaningful only for a closed mesh. */
function analyze(stl: ArrayBuffer): MeshStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  let volume = 0;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  let hasNaN = false;

  for (let t = 0; t < triangleCount; t++) {
    const b = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[b], vertices[b + 1], vertices[b + 2]],
      [vertices[b + 3], vertices[b + 4], vertices[b + 5]],
      [vertices[b + 6], vertices[b + 7], vertices[b + 8]],
    ];
    for (const [x, y, z] of verts) {
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const [a, c, d] = verts;
    volume +=
      (a[0] * (c[1] * d[2] - d[1] * c[2]) -
        a[1] * (c[0] * d[2] - d[0] * c[2]) +
        a[2] * (c[0] * d[1] - d[0] * c[1])) /
      6;
    const keys = verts.map(([x, y, z]) => vKey(x, y, z));
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  let boundaryEdges = 0;
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return {
    volume: Math.abs(volume),
    triangleCount,
    nonManifoldEdges,
    boundaryEdges,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    hasNaN,
  };
}

async function statsFor(params: ResolvedBaseplateParams): Promise<MeshStats> {
  const { data } = await exportBaseplate(params, 'stl');
  return analyze(data);
}

const ALL_EXTERIOR = {
  left: 'exterior',
  right: 'exterior',
  front: 'exterior',
  back: 'exterior',
} as const;

describe('baseplateGenerator — all-edge seam slots (issue #2866)', () => {
  const TEST_TIMEOUT_MS = 180_000;

  /** All four edges slotted: left/right carry the Y boundaries, front/back the X. */
  const ALL_FOUR = 2 * Y_BOUNDARIES + 2 * X_BOUNDARIES;

  it(
    'exterior slots stay watertight, keep the outer extent, and match a join slot',
    async () => {
      // Baseline: a fully exterior tile with the option off carries no slot at all.
      const bare = await statsFor(defaults({ edges: ALL_EXTERIOR }));
      // Same tile with the option on: every one of the four edges is slotted.
      const slotted = await statsFor(
        defaults({ edges: ALL_EXTERIOR, connectorSlotsAllEdges: true })
      );
      // Reference: the two X-normal edges are real join seams, option off — the
      // cavity the feature has to reproduce on an exterior edge.
      const joined = await statsFor(
        defaults({ edges: { left: 'join', right: 'join', front: 'exterior', back: 'exterior' } })
      );

      expect(slotted.hasNaN, 'no NaN vertices').toBe(false);
      expect(slotted.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(slotted.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(slotted.boundaryEdges, 'boundary edges').toBe(0);

      // The slot is carved inward from the wall, so the footprint is untouched.
      expect(slotted.bounds.minX).toBeCloseTo(bare.bounds.minX, 3);
      expect(slotted.bounds.maxX).toBeCloseTo(bare.bounds.maxX, 3);
      expect(slotted.bounds.minY).toBeCloseTo(bare.bounds.minY, 3);
      expect(slotted.bounds.maxY).toBeCloseTo(bare.bounds.maxY, 3);
      expect(slotted.bounds.minZ).toBeCloseTo(bare.bounds.minZ, 3);
      expect(slotted.bounds.maxZ).toBeCloseTo(bare.bounds.maxZ, 3);

      const perExteriorSlot = (bare.volume - slotted.volume) / ALL_FOUR;
      const perJoinSlot = (bare.volume - joined.volume) / (2 * Y_BOUNDARIES);

      expect(perExteriorSlot, 'exterior slots remove material').toBeGreaterThan(0);
      // A tile is only interchangeable if the exterior slot is the same cavity
      // the join seam gets. 1% covers tessellation of the lobe fillets.
      expect(Math.abs(perExteriorSlot - perJoinSlot) / perJoinSlot).toBeLessThan(0.01);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'a padded exterior edge gets no slot',
    async () => {
      // Per-slot volume, measured on the padding-free tile.
      const perSlot =
        ((await statsFor(defaults({ edges: ALL_EXTERIOR }))).volume -
          (await statsFor(defaults({ edges: ALL_EXTERIOR, connectorSlotsAllEdges: true })))
            .volume) /
        ALL_FOUR;

      // The left wall now sits 5mm outside the grid, so a slot there would not
      // line up with a neighbouring plate — only three edges may be slotted.
      const padded = { paddingLeft: 5, edges: ALL_EXTERIOR } as const;
      const bare = await statsFor(defaults(padded));
      const slotted = await statsFor(defaults({ ...padded, connectorSlotsAllEdges: true }));

      expect(slotted.boundaryEdges, 'boundary edges').toBe(0);
      expect(slotted.nonManifoldEdges, 'non-manifold edges').toBe(0);

      const slotsCut = (bare.volume - slotted.volume) / perSlot;
      expect(slotsCut).toBeCloseTo(ALL_FOUR - Y_BOUNDARIES, 1);
    },
    TEST_TIMEOUT_MS
  );
});
