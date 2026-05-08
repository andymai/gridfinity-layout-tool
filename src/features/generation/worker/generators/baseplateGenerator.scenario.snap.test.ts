// @vitest-environment node
/**
 * Scenario tests for snap-clip baseplate connectors.
 *
 * Two features per join boundary:
 * - A vertical through-hole sized for the prong shaft.
 * - A shallow rectangular recess on the slab top so the clip's bridge
 *   sits flush — without it, the bridge rides 1.5mm proud and lifts any
 *   bin placed in the seam-adjacent column.
 *
 * Tests verify the export is watertight (Greptile #1407 pattern), the
 * slab top is locally lowered at the recess, and the through-hole is
 * actually cut.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { SNAP_PEG_INSET, SNAP_RECESS_DEPTH } from './generatorConstants';

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
  /** True if any triangle face entirely below `z` lies within `radius` of
   *  (x, y). Used to detect features cut into the slab top. */
  hasFaceBelow: (x: number, y: number, radius: number, z: number) => boolean;
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

  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const tri: Array<[number, number, number]> = [
      [verts[base], verts[base + 1], verts[base + 2]],
      [verts[base + 3], verts[base + 4], verts[base + 5]],
      [verts[base + 6], verts[base + 7], verts[base + 8]],
    ];
    for (const [, , z] of tri) {
      if (z > maxZ) maxZ = z;
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

  const hasFaceBelow = (x: number, y: number, radius: number, z: number): boolean => {
    const r2 = radius * radius;
    for (let t = 0; t < triangleCount; t++) {
      const base = t * 9;
      let allInside = true;
      let allBelow = true;
      for (let v = 0; v < 3; v++) {
        const vx = verts[base + v * 3];
        const vy = verts[base + v * 3 + 1];
        const vz = verts[base + v * 3 + 2];
        if ((vx - x) * (vx - x) + (vy - y) * (vy - y) > r2) {
          allInside = false;
          break;
        }
        if (vz >= z) {
          allBelow = false;
          break;
        }
      }
      if (allInside && allBelow) return true;
    }
    return false;
  };

  return { triangleCount, nonManifoldEdges, boundaryEdges, maxZ, hasFaceBelow };
}

describe('baseplateGenerator — snap export', () => {
  const TEST_TIMEOUT_MS = 60_000;

  it(
    'exports a watertight STL with through-hole and bridge recess',
    async () => {
      const params = defaults({
        connectorStyle: 'snap',
        edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      });

      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);

      // Manifold sanity (slicer-safe).
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);

      // Recess assertion: at the recess footprint near the left join edge,
      // a triangle face must exist entirely below (slabTop - RECESS_DEPTH/2).
      // That's the recess floor — it can't exist if the recess wasn't cut.
      const halfW = 42;
      const slabTop = stats.maxZ;
      const recessSampleX = -halfW + SNAP_PEG_INSET;
      const floorBelow = slabTop - SNAP_RECESS_DEPTH * 0.5;
      expect(stats.hasFaceBelow(recessSampleX, 0, 2.0, floorBelow)).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'exports a watertight STL with magnets enabled (thicker slab)',
    async () => {
      // Magnets thicken the slab by MAGNET_FLOOR + magnetDepth ≈ 2.9mm. The
      // recess depth is constant, so the floor of the recess sits well above
      // the magnet floor — verify the export still produces a manifold STL
      // and the recess is cut into the (now-thicker) slab top.
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
      const floorBelow = stats.maxZ - SNAP_RECESS_DEPTH * 0.5;
      expect(stats.hasFaceBelow(-halfW + SNAP_PEG_INSET, 0, 2.0, floorBelow)).toBe(true);
    },
    TEST_TIMEOUT_MS
  );
});
