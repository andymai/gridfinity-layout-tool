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

/**
 * Regression coverage around issue #1822 — tilted dividers on half-grid
 * bins. Locks in that the multi-cavity-cut path (#1844) produces a clean,
 * manifold mesh across the tilt × halfSockets × bin-shape × compartment
 * matrix.
 *
 * Diagnosis note: the reporter's bin was non-manifold, but the matrix
 * below (which excludes label tabs) is manifold across the board. The
 * actual non-manifold trigger turned out to be the label-tab feature
 * the reporter had enabled — its gusset back faces sit coincident with
 * the bin's inner back wall on fuse, leaving duplicate triangles that
 * BambuStudio reports. That case is captured as it.skip TODO tests at
 * the end of this describe block (see follow-up comments).
 *
 * Matrix axes (kept tight to fit the test budget):
 *   - halfSockets {true, false}        — confirms halfSockets doesn't
 *                                        regress the multi-cavity path
 *   - bin shape {1×6, 1.5×6, 2×6}      — integer, half-grid, larger
 *   - tilt magnitude {0, 10, 40, 90mm} — baseline + reporter + near-max
 *   - compartment topology {1×2, 2×1, 2×2} — single, width-axis, crossing
 *
 * We don't take the full Cartesian product — only the diagonals that
 * isolate which axis would trigger regression if the geometry path
 * changed.
 */

function withTiltedDivider(
  params: BinParams,
  offsetStart: number,
  offsetEnd: number,
  compartmentA = 0,
  compartmentB = 1
): BinParams {
  const overrides =
    offsetStart === 0 && offsetEnd === 0
      ? undefined
      : [{ compartmentA, compartmentB, offsetStart, offsetEnd }];
  return {
    ...params,
    compartments: {
      ...params.compartments,
      ...(overrides ? { dividerOverrides: overrides } : {}),
    },
  };
}

function withHalfSockets(params: BinParams): BinParams {
  return { ...params, base: { ...params.base, halfSockets: true } };
}

describe('compartmentBuilder — half-sockets + tilted divider manifold (issue #1822)', () => {
  const TEST_TIMEOUT_MS = 90_000;

  function expectWatertight(stats: ManifoldStats, label: string): void {
    expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
    expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
  }

  // Baseline: halfSockets + axis-aligned divider must remain manifold.
  // If this ever fails, the bug isn't tilt-specific — the fix needs to
  // address halfSockets + multi-cavity-cut more broadly.
  it(
    '1.5×6 halfSockets + axis-aligned divider (no tilt) — baseline',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, 0, 0));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets baseline'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Reporter's exact configuration: 1.5×6×6, halfSockets, ±40mm symmetric tilt.
  // Direct repro of the user's BambuStudio non-manifold warning.
  it(
    "1.5×6 halfSockets + ±40mm tilted divider — reporter's case",
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, -40, 40));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets ±40 — reporter'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Mild 10mm symmetric tilt — same configuration as the existing
  // tilted-dividers scenario test, but with halfSockets enabled.
  // Catches the bug earlier in tilt magnitude so fixes that only
  // help extreme tilts don't pass the suite.
  it(
    '1.5×6 halfSockets + ±10mm tilted divider — mild tilt',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, -10, 10));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets ±10 — mild'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Extreme tilt approaching the viability gate (cavityCorners would
  // collapse below thickness*2 mm interior). Verifies the gate doesn't
  // admit pathological geometry that the fix can't handle.
  it(
    '1.5×6 halfSockets + ±90mm tilted divider — near-max tilt',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, -90, 90));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets ±90 — near-max'
      );
    },
    TEST_TIMEOUT_MS
  );

  // halfSockets OFF + tilted divider — isolates whether the bug requires
  // half-cells or whether tilt alone is enough. (Prior art:
  // binGenerator.scenario.tilted-dividers.test.ts only asserts geometry
  // changed, not that it's manifold.)
  it(
    '1.5×6 halfSockets=false + ±40mm tilted divider — isolates halfSockets role',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params = withTiltedDivider(base, -40, 40);
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 no-halfSockets ±40'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Integer width + halfSockets + tilt — isolates whether the half-grid
  // width is load-bearing or whether halfSockets alone is enough.
  it(
    '1×6 halfSockets + ±40mm tilted divider — isolates 1.5-width role',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, -40, 40));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1×6 halfSockets ±40'
      );
    },
    TEST_TIMEOUT_MS
  );

  // 2×6 + halfSockets + tilt — larger integer width. Sanity that the
  // fix doesn't only happen to work at narrow widths.
  it(
    '2×6 halfSockets + ±40mm tilted divider — larger integer width',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 2, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, -40, 40));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '2×6 halfSockets ±40'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Divider in the WIDTH axis (cols=2, rows=1). 1.5-wide means cellW ≈ 30mm
  // per cell; a ±10mm tilt is the most we can apply before the cavity
  // viability gate would reject it.
  it(
    '1.5×6 halfSockets + width-axis tilted divider — cols=2 rows=1',
    async () => {
      clearAllCaches();
      const base = withCompartments(2, 1, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params = withHalfSockets(withTiltedDivider(base, -10, 10));
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets ±10 width-axis'
      );
    },
    TEST_TIMEOUT_MS
  );

  // 2×2 four-compartment with two tilted dividers (one horizontal,
  // one vertical) — stresses the interaction of multiple tilted
  // cavities baked into a single shell cut.
  it(
    '2×6 halfSockets + 2×2 compartments with two tilted dividers — crossing tilts',
    async () => {
      clearAllCaches();
      const base = withCompartments(2, 2, [0, 1, 2, 3], { width: 2, depth: 6, height: 6 });
      const overrides = [
        { compartmentA: 0, compartmentB: 1, offsetStart: 20, offsetEnd: -20 }, // vertical divider tilt
        { compartmentA: 0, compartmentB: 2, offsetStart: 30, offsetEnd: -30 }, // horizontal divider tilt
      ];
      const params: BinParams = withHalfSockets({
        ...base,
        compartments: { ...base.compartments, dividerOverrides: overrides },
      });
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '2×6 halfSockets 2×2 crossing tilts'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Label-tab repro: the actual feature combination the reporter must
  // have had (their 3MF has ~35336 triangles, matching label-enabled +
  // tilted divider on a 1.5×6×6 halfSockets bin). The reporter mentioned
  // only the tilted divider; investigation showed the non-manifold edges
  // are produced by the label tab's gusset back faces (coplanar with the
  // bin's inner back wall), independent of the divider tilt.
  //
  // TODO(#1822 follow-up): drive the residual ~444 NM to 0. Diagnosed
  // root cause is OCCT GFA leaving the gusset back faces coincident with
  // the bin's inner back wall on fuse — neither `simplify`, fuzzy-value
  // tolerance, `COPLANAR_OVERLAP` overshoot, nor a final `simplify()`
  // pass coalesces them. The `optimisation: 'sameFace'` hint does fix it
  // (drops to ~126) but makes OCCT throw on scoop and split-bin fuses
  // where no exact-shared face exists, so it can't be applied globally
  // in booleanStage. Likely needs per-target fuse options (split the
  // booleanStage into label-tab-aware passes) or a structural rework
  // (cut a slot in the wall and seat the tab into it rather than
  // fusing). Tracking as known gap until then.
  it.skip(
    'TODO #1822 follow-up: 1.5×6 halfSockets + ±40mm tilted divider + label tab — full reporter config',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params: BinParams = {
        ...withHalfSockets(withTiltedDivider(base, -40, 40)),
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      };
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets ±40 + label — full reporter config'
      );
    },
    TEST_TIMEOUT_MS
  );

  // Label tab + axis-aligned divider — both compartments get tabs. Same
  // gusset-back-face coplanarity bug as above, slightly higher NM count
  // (~642) because both compartments contribute gusset arrays. See the
  // TODO on the previous test for the diagnosed root cause.
  it.skip(
    'TODO #1822 follow-up: 1.5×6 halfSockets + axis-aligned divider + label tab — both compartments tabbed',
    async () => {
      clearAllCaches();
      const base = withCompartments(1, 2, [0, 1], { width: 1.5, depth: 6, height: 6 });
      const params: BinParams = {
        ...withHalfSockets(base),
        label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      };
      expectWatertight(
        analyzeManifold((await exportBin(params, 'stl')).data),
        '1.5×6 halfSockets + label — both compartments tabbed'
      );
    },
    TEST_TIMEOUT_MS
  );
});
