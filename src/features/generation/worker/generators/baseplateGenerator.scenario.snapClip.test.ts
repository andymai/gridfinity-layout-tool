// @vitest-environment node
/**
 * Scenario tests for snap-clip connectors (issue #1610).
 *
 * Snap-clip mode cuts a blind, ledged pocket on BOTH sides of every seam and
 * ships a separate top-insert "staple" whose barbs catch the ledges. Verified
 * against the real OCCT kernel:
 *   1. a snap-clip baseplate exports a watertight STL (the blind pockets don't
 *      create boundary/non-manifold edges),
 *   2. the standalone clip is a valid solid, bed-flat for printing, and
 *   3. the clip seats into the pockets with clearance (no interference) — the
 *      deterministic fit gauge that proved the geometry standalone.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { SNAP_CLIP } from './generatorConstants';
import { buildSnapClip, buildSnapClipForPrint } from './baseplateConnectors';

type ExportFn = (
  params: BaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;
let exportConnectorKey: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
  exportConnectorKey = mod.exportConnectorKey;
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

function analyze(stl: ArrayBuffer) {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  let minZ = Infinity,
    maxZ = -Infinity,
    hasNaN = false;
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const verts: Array<[number, number, number]> = [
      [vertices[base], vertices[base + 1], vertices[base + 2]],
      [vertices[base + 3], vertices[base + 4], vertices[base + 5]],
      [vertices[base + 6], vertices[base + 7], vertices[base + 8]],
    ];
    for (const [x, y, z] of verts) {
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
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
  return { triangleCount, nonManifoldEdges, boundaryEdges, minZ, maxZ, hasNaN };
}

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

describe('baseplateGenerator — snap-clip connectors (issue #1610)', () => {
  const TEST_TIMEOUT_MS = 60_000;

  it(
    'snap-clip baseplate with join edges exports a watertight STL',
    async () => {
      const params = defaults({
        width: 5,
        depth: 4,
        connectorNubs: true,
        connectorStyle: 'snapClip',
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });
      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount, 'non-empty mesh').toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'connector key is a valid, bed-flat snap clip',
    async () => {
      const params = defaults({ connectorNubs: true, connectorStyle: 'snapClip' });
      const { data, fileName } = await exportConnectorKey(params, 'stl');
      const stats = analyze(data);
      expect(fileName).toBe('connector_key.stl');
      expect(stats.hasNaN).toBe(false);
      expect(stats.triangleCount).toBeGreaterThan(0);
      expect(stats.nonManifoldEdges).toBe(0);
      expect(stats.boundaryEdges).toBe(0);
      // Bed-flat: bottom rests at Z=0, build height = clip length.
      expect(stats.minZ).toBeCloseTo(0, 1);
      expect(stats.maxZ).toBeCloseTo(SNAP_CLIP.LEG_L, 1);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'scales the snap clip for a 0.6mm nozzle — still watertight, barb enlarged',
    async () => {
      // The 0.45mm barb is sub-bead at 0.6mm (the slicer would drop it). It must
      // scale to ≥1 full bead while the plate stays watertight.
      const params = defaults({
        width: 5,
        depth: 4,
        connectorNubs: true,
        connectorStyle: 'snapClip',
        nozzleSizeMm: 0.6,
        edges: { left: 'exterior', right: 'join', front: 'join', back: 'join' },
      });
      const { data } = await exportBaseplate(params, 'stl');
      const stats = analyze(data);
      expect(stats.hasNaN, 'no NaN vertices').toBe(false);
      expect(stats.triangleCount).toBeGreaterThan(0);
      expect(stats.nonManifoldEdges, 'non-manifold edges').toBe(0);
      expect(stats.boundaryEdges, 'boundary edges').toBe(0);

      // The clip part itself grows: the deeper barb adds engagement material, so
      // the 0.6mm clip has strictly more volume than the 0.4mm baseline.
      const baseline = buildSnapClip(5, 42);
      const wide = buildSnapClip(5, 42, 0.6);
      expect(vol(wide)).toBeGreaterThan(vol(baseline));
      baseline.delete();
      wide.delete();
    },
    TEST_TIMEOUT_MS
  );

  it(
    'clip prints bed-flat with top-bridge corners relieved for the edge sockets',
    () => {
      // SOCKET_HEIGHT slab (no magnets) = 5mm. The sharp staple is 60.45mm³;
      // the FDM-balanced edge treatments (slot-root fillets, top chamfer,
      // slot-mouth fillets) plus relieving the top-bridge corners against the
      // four neighbouring full-cell bin feet leave ~53.8mm³, and a seated clip
      // clears bins in the edge sockets flanking each seam (see
      // snapClipSocketInterference.test.ts).
      const totalHeight = 5;
      const clip = buildSnapClip(totalHeight, 42);
      const vClip = vol(clip);
      expect(vClip, 'relieved + filleted clip volume').toBeCloseTo(53.8, 1);

      // Print orientation is a rigid transform — volume is preserved exactly.
      const printClip = buildSnapClipForPrint(totalHeight, 42);
      expect(vol(printClip), 'print orientation preserves volume').toBeCloseTo(vClip, 2);

      clip.delete();
      printClip.delete();
    },
    TEST_TIMEOUT_MS
  );
});
