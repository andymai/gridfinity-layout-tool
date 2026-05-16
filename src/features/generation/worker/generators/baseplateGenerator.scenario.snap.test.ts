// @vitest-environment node
/**
 * Scenario tests for rabbit-clip baseplate connectors.
 *
 * Each join edge gets one socket pocket per cell-boundary — pocketed into
 * the slab, opening laterally at the seam edge. Tests verify the export is
 * watertight (Greptile #1407 pattern) and a pocket is actually cut at each
 * cell centre.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { SNAP_CLIP_DEPTH, SNAP_CLIP_LENGTH } from './generatorConstants';

type ExportFn = (
  params: BaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
}, 30000);

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 2,
  depth: 2,
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
  ...overrides,
});

interface MeshStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  maxZ: number;
  minZ: number;
  /** True if any triangle vertex lies within `radius` of (x, y) AND below z<zMax. */
  hasVertexNear: (x: number, y: number, radius: number, zMin: number, zMax: number) => boolean;
}

function analyze(stl: ArrayBuffer): MeshStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const verts = parsed.value.vertices;
  const triangleCount = verts.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  let maxZ = -Infinity;
  let minZ = Infinity;

  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const tri: Array<[number, number, number]> = [
      [verts[base], verts[base + 1], verts[base + 2]],
      [verts[base + 3], verts[base + 4], verts[base + 5]],
      [verts[base + 6], verts[base + 7], verts[base + 8]],
    ];
    for (const [, , z] of tri) {
      if (z > maxZ) maxZ = z;
      if (z < minZ) minZ = z;
    }
    const keys = tri.map(([x, y, z]) => vKey(x, y, z));
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  let boundaryEdges = 0;
  for (const c of edgeCount.values()) {
    if (c === 1) boundaryEdges++;
    else if (c > 2) nonManifoldEdges++;
  }

  const hasVertexNear = (
    x: number,
    y: number,
    radius: number,
    zMin: number,
    zMax: number
  ): boolean => {
    const r2 = radius * radius;
    for (let i = 0; i < verts.length; i += 3) {
      const vx = verts[i];
      const vy = verts[i + 1];
      const vz = verts[i + 2];
      if (vz < zMin || vz > zMax) continue;
      if ((vx - x) * (vx - x) + (vy - y) * (vy - y) <= r2) return true;
    }
    return false;
  };

  return { triangleCount, nonManifoldEdges, boundaryEdges, maxZ, minZ, hasVertexNear };
}

describe('baseplateGenerator — rabbit-clip snap export', () => {
  const TEST_TIMEOUT_MS = 60_000;

  it(
    'exports a watertight STL with sockets on every join edge',
    async () => {
      const params = defaults({
        connectorStyle: 'snap',
        edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);

      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);

      // The pocket adds vertices on its floor/ceiling at the pocket OUTLINE
      // (not its interior). The cutter is rotated for the left edge so the
      // pin extends +X from the seam; the pocket-floor ring contains
      // vertices around the rabbit outline near the cell centre at y=21.
      const halfW = 42;
      const slabHeight = stats.maxZ - stats.minZ;
      const pocketCeilingZ = stats.minZ + slabHeight / 2 + SNAP_CLIP_DEPTH / 2;
      // Wide radius to catch any vertex on the pocket-ceiling ring at the
      // cell centre — sample is near the seam, looking for vertices on the
      // pocket boundary at the matching Z slice.
      expect(
        stats.hasVertexNear(
          -halfW + SNAP_CLIP_LENGTH * 0.3,
          21,
          SNAP_CLIP_LENGTH,
          pocketCeilingZ - 0.5,
          pocketCeilingZ + 0.5
        ),
        'pocket boundary at left-edge cell centre'
      ).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a watertight STL with magnets enabled (thicker slab)',
    async () => {
      // Magnets thicken the slab by MAGNET_FLOOR + magnetDepth ≈ 2.9mm. The
      // rabbit-clip pocket is centred vertically regardless, so the export
      // must remain manifold and the pocket must still cut into the slab.
      const params = defaults({
        connectorStyle: 'snap',
        magnetHoles: true,
        magnetDepth: 2.4,
        edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);

      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.maxZ).toBeGreaterThan(5);

      const halfW = 42;
      const slabHeight = stats.maxZ - stats.minZ;
      const pocketCeilingZ = stats.minZ + slabHeight / 2 + SNAP_CLIP_DEPTH / 2;
      expect(
        stats.hasVertexNear(
          -halfW + SNAP_CLIP_LENGTH * 0.3,
          21,
          SNAP_CLIP_LENGTH,
          pocketCeilingZ - 0.5,
          pocketCeilingZ + 0.5
        ),
        'pocket boundary cut into thickened slab at left-edge cell centre'
      ).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
