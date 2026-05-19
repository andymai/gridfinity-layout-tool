// @vitest-environment node
/**
 * Regression test for issue #1753 — partitioned bins exported with
 * non-manifold geometry per BambuStudio.
 *
 * Old shell construction: hollow rectangular shell + each compartment wall
 * fused on top as a separate positive solid (`compartmentWallsFeature`,
 * `target: 'fuse'`). Where a wall met the cavity floor at Z=wallThickness,
 * OCCT's General Fuse Algorithm left a T-junction with coincident edges
 * between the wall's vertical face and the floor's horizontal face — STL
 * slicers (BambuStudio) flagged those duplicate edges as non-manifold and
 * "repaired" them as solid infill.
 *
 * Fix in this PR: when compartments are amenable (rectangular footprint,
 * non-solid, non-slotted, rectangular comps with viable post-inset dims),
 * rebuild the bin as `outer_extrusion − each_compartment_cavity` directly
 * in `buildBinBox`. Walls are cut residue between cavities, so every face
 * shares edges on a single solid — no fuse seam, no T-junction. See
 * `compartmentBuilder.buildCompartmentCavityDrawings` and
 * `pipeline/context.compartmentsBakedIntoShell`.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { exportBin } from './binExporter';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 30000);

interface ManifoldStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
}

function analyzeManifold(stl: ArrayBuffer): ManifoldStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    const keys = [
      vKey(vertices[base], vertices[base + 1], vertices[base + 2]),
      vKey(vertices[base + 3], vertices[base + 4], vertices[base + 5]),
      vKey(vertices[base + 6], vertices[base + 7], vertices[base + 8]),
    ];
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
  return { triangleCount, nonManifoldEdges, boundaryEdges };
}

function withCompartments(
  cols: number,
  rows: number,
  cells: readonly number[],
  overrides: Partial<BinParams> = {}
): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...overrides,
    compartments: { cols, rows, cells: [...cells], thickness: 1.2 },
  };
}

describe('compartmentBuilder — partition export manifold-ness (issue #1753)', () => {
  const TEST_TIMEOUT_MS = 90_000;

  function expectWatertight(stats: ManifoldStats, label: string): void {
    expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
    expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
  }

  it(
    '2×2 bin with a single full-span divider exports watertight STL',
    async () => {
      clearAllCaches();
      const params = withCompartments(2, 1, [0, 1], { width: 2, depth: 2 });
      expectWatertight(analyzeManifold((await exportBin(params, 'stl')).data), '2×1 split');
    },
    TEST_TIMEOUT_MS
  );

  it(
    '2×2 bin with 4 separate compartments exports watertight STL',
    async () => {
      clearAllCaches();
      const params = withCompartments(2, 2, [0, 1, 2, 3], { width: 2, depth: 2 });
      expectWatertight(analyzeManifold((await exportBin(params, 'stl')).data), '2×2 four-comp');
    },
    TEST_TIMEOUT_MS
  );

  it(
    "1×4 bin with 2×8 compartments (reporter's case shape) exports watertight STL",
    async () => {
      clearAllCaches();
      const cells = Array.from({ length: 16 }, (_, i) => i);
      const params = withCompartments(2, 8, cells, { width: 1, depth: 4, height: 5 });
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1×4 with 2×8 comps'
      );
    },
    TEST_TIMEOUT_MS
  );

  it(
    '2×2 bin with top row merged into one compartment exports watertight STL',
    async () => {
      clearAllCaches();
      // [0,0,1,2] = top row merged into compartment 0 + two single-cell
      // compartments in the bottom row. Stresses the "merged-bounding-box"
      // cavity drawing path (a single rectangle spanning both columns).
      const params = withCompartments(2, 2, [0, 0, 1, 2], { width: 2, depth: 2 });
      expectWatertight(analyzeManifold((await exportBin(params, 'stl')).data), 'top-row merged');
    },
    TEST_TIMEOUT_MS
  );

  // ── Known gap (polygon-mask + compartments) ─────────────────────────────
  // Bins with a non-rectangular footprint (L/T/U cellMask) still take the
  // additive-fuse compartment path and remain susceptible to the original
  // T-junction non-manifold bug. The multi-cavity-cut path in `buildBinBox`
  // only handles rectangular footprints today; extending it to clip
  // compartment cavities against an arbitrary polygon mask is a follow-up.
  // Unskip and verify when that work lands.
  it.skip(
    'TODO #1753 follow-up: L-shaped (polygon-mask) bin with compartments exports watertight STL',
    async () => {
      clearAllCaches();
      const cellMask = {
        cols: 2,
        rows: 2,
        cells: [true, true, true, false], // L-shape: bottom-right cell missing
      };
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        cellMask,
        compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
      };
      expectWatertight(analyzeManifold((await exportBin(params, 'stl')).data), 'L-shape mask');
    },
    TEST_TIMEOUT_MS
  );
});
