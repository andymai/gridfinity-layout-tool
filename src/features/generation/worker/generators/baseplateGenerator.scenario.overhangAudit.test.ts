// @vitest-environment node
/**
 * Printability audit for stack-print baseplates.
 *
 * Stacking prints plates UPSIDE DOWN (pockets facing the bed). This measures,
 * on real generated geometry, how much support-needing overhang that introduces
 * vs the normal upright print orientation — to check the "prints without
 * supports" expectation. Heuristic matches a slicer's first pass: a face needs
 * support if its outward normal points downward more than `OVERHANG_DEG` from
 * vertical AND it sits above the bed (bed-contact faces are supported).
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

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
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

const OVERHANG_DEG = 45;
const NZ_THRESHOLD = -Math.sin((OVERHANG_DEG * Math.PI) / 180); // ≈ -0.707
const BRIDGE_NZ = -0.95; // near-flat downward ceilings
const BED_EPS = 0.4; // mm above the bed considered "supported by bed"

interface OrientStats {
  totalArea: number;
  supportArea: number; // needs support (overhang + above bed)
  bridgeArea: number; // near-flat ceilings above bed
  maxFeatureZ: number; // highest overhang above bed (mm)
}

/** Geometric outward normal + area for a triangle given as 9 floats. */
function triNormalArea(
  v: Float32Array,
  i: number
): { nx: number; ny: number; nz: number; area: number } {
  const ax = v[i + 3] - v[i],
    ay = v[i + 4] - v[i + 1],
    az = v[i + 5] - v[i + 2];
  const bx = v[i + 6] - v[i],
    by = v[i + 7] - v[i + 1],
    bz = v[i + 8] - v[i + 2];
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  const len = Math.hypot(cx, cy, cz);
  // A degenerate (zero-area) triangle contributes no area and no orientation.
  if (len === 0) return { nx: 0, ny: 0, nz: 0, area: 0 };
  return { nx: cx / len, ny: cy / len, nz: cz / len, area: len / 2 };
}

/** Analyze overhangs with the build direction pointing +Z (i.e. `flip` mirrors Z first). */
function analyze(vertices: Float32Array, flip: boolean): OrientStats {
  // Z bounds (in print orientation) to find the bed plane.
  let zMin = Infinity;
  let zMax = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    const z = flip ? -vertices[i] : vertices[i];
    if (z < zMin) zMin = z;
    if (z > zMax) zMax = z;
  }

  const s: OrientStats = { totalArea: 0, supportArea: 0, bridgeArea: 0, maxFeatureZ: 0 };
  for (let i = 0; i < vertices.length; i += 9) {
    const t = triNormalArea(vertices, i);
    const nz = flip ? -t.nz : t.nz;
    s.totalArea += t.area;
    // Lowest point of the triangle in print orientation.
    const z0 = flip ? -vertices[i + 2] : vertices[i + 2];
    const z1 = flip ? -vertices[i + 5] : vertices[i + 5];
    const z2 = flip ? -vertices[i + 8] : vertices[i + 8];
    const triMinZ = Math.min(z0, z1, z2);
    const aboveBed = triMinZ > zMin + BED_EPS;
    if (nz < NZ_THRESHOLD && aboveBed) {
      s.supportArea += t.area;
      if (nz < BRIDGE_NZ) s.bridgeArea += t.area;
      const h = triMinZ - zMin;
      if (h > s.maxFeatureZ) s.maxFeatureZ = h;
    }
  }
  return s;
}

const pct = (a: number, b: number): string => `${((100 * a) / b).toFixed(1)}%`;

describe('stack-print overhang audit (upside-down printability)', () => {
  const configs: { name: string; params: ResolvedBaseplateParams }[] = [
    { name: 'lightweight, no magnets', params: defaults() },
    { name: 'solid floor, no magnets', params: defaults({ lightweight: false }) },
    { name: 'magnets (2.4mm) + lightweight', params: defaults({ magnetHoles: true }) },
  ];

  it('reports support-needing overhang area: upright vs flipped (stack orientation)', async () => {
    const rows: string[] = [];
    for (const { name, params } of configs) {
      const { data } = await exportBaseplate(params, 'stl');
      const parsed = parseSTLBinary(data);
      expect(isOk(parsed)).toBe(true);
      if (!isOk(parsed)) continue;
      const v = parsed.value.vertices;

      const up = analyze(v, false);
      const down = analyze(v, true); // flipped = how the stack prints

      rows.push(
        `\n  ── ${name} ──\n` +
          `    upright : support ${pct(up.supportArea, up.totalArea)} (bridges ${pct(up.bridgeArea, up.totalArea)}), max overhang height ${up.maxFeatureZ.toFixed(1)}mm\n` +
          `    flipped : support ${pct(down.supportArea, down.totalArea)} (bridges ${pct(down.bridgeArea, down.totalArea)}), max overhang height ${down.maxFeatureZ.toFixed(1)}mm`
      );

      expect(up.totalArea).toBeGreaterThan(0);
      // Guarantee: a baseplate WITHOUT magnets prints support-free even flipped
      // (its chamfers stay within the 45° overhang limit). Magnet pockets are
      // the only feature that becomes a downward bridge when flipped.
      if (!params.magnetHoles) {
        expect(down.supportArea / down.totalArea).toBeLessThan(0.02);
      }
    }
    process.stdout.write(
      `\n=== Stack-print overhang audit (support threshold ${OVERHANG_DEG}° from vertical) ===` +
        rows.join('\n') +
        '\n'
    );
  }, 60000);
});
