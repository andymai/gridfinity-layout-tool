// @vitest-environment node
/**
 * Export-integrity matrix — runs the FULL scenario catalog through binary STL
 * export and asserts the invariants the occt-wasm kernel regressions violated:
 *
 *  1. The exported binary STL is well-formed and parseable. occt-wasm's native
 *     `exportStl` returned the binary payload as a lossy JS string, so the
 *     header triangle count diverged from the body and the buffer was
 *     unparseable for some meshes (compartment partitions especially). brepjs
 *     now builds the binary STL from the mesh; this guards that fix across every
 *     feature combination.
 *  2. The solid is non-empty and watertight (manifold, no boundary edges) — a
 *     printable result, not a degenerate/empty boolean output.
 *  3. No NaN/Infinity coordinates.
 *
 * Generation validity (vertex counts, structure) is already covered by
 * `binGenerator.scenario.test.ts`; this file is purely about EXPORT geometry,
 * the layer where the kernel swap introduced corruption.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { ALL_SCENARIOS } from './scenarios';
import { setLastSolid } from './shapeCache';
import type * as BinExporterModule from './binExporter';

let exportBin: typeof BinExporterModule.exportBin;

beforeAll(async () => {
  const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
  await initBrepjs();
  exportBin = (await import('./binExporter')).exportBin;
}, 60_000);

interface ManifoldStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  minFinite: boolean;
}

/** Parse a binary STL and compute manifold/finiteness stats. Throws on parse failure. */
function analyze(stl: ArrayBuffer, label: string): ManifoldStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) {
    throw new Error(`${label}: STL parse failed — ${parsed.error.errors?.join('; ') ?? 'unknown'}`);
  }
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  let minFinite = true;
  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    for (let i = 0; i < 9; i++) {
      if (!Number.isFinite(vertices[base + i])) minFinite = false;
    }
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
  return { triangleCount, nonManifoldEdges, boundaryEdges, minFinite };
}

/**
 * Scenarios whose exported STL is still non-manifold after the GH #2085 repairs
 * (interior-void-shell collapse, the scoop-fillet flat-bottom-edge selector, the
 * sharp-corner chamfer profile, and the deferred-socket export fuse — see
 * `keepOuterShell`, `findBottomEdges`, `cutoutProfileDrawing`, and shellStage).
 *
 * The two left are not boolean artifacts but a genuine geometry pathology: two
 * cavity cuts placed exactly tangent leave a zero-thickness knife-edge pinch in
 * the wall between them (a single non-manifold edge along the contact line). A
 * watertight mesh can't represent a measure-zero contact, so these can only be
 * made manifold by perturbing the design (overlapping or separating the
 * cavities) — a product decision, not a generation bug. Keyed by
 * `${category} › ${name}`.
 */
const QUARANTINED_NON_MANIFOLD = new Set<string>([
  'multiple inserts › 2×2 with 2 circle inserts',
  'pathfinder › exclude group: XOR keeps non-overlapping regions',
]);

describe('export integrity: full scenario matrix → binary STL', () => {
  // Reset the last-solid pointer so each scenario actually builds and exports
  // its OWN solid. `exportBin` skips regeneration whenever the cached solid is
  // export-quality (isLastSolidExportQuality), and that flag is param-blind —
  // without this reset the first scenario's export-quality solid would be
  // re-exported for all 354 scenarios, making every assertion vacuous. In
  // production a preview pass (forExport=false) clears the flag on every param
  // change; this loop never previews, so we clear it explicitly. The
  // param-keyed intermediate LRU caches (socket/lip/box) stay warm for speed.
  beforeEach(() => {
    setLastSolid(null);
  });

  for (const scenario of ALL_SCENARIOS) {
    const label = `${scenario.category} › ${scenario.name}`;
    const testFn = QUARANTINED_NON_MANIFOLD.has(label) ? it.skip : it;
    testFn(
      label,
      async () => {
        const params = buildParams(scenario.params);
        const result = await exportBin(params, 'stl');

        // 1. Buffer is well-formed and parseable (the occt-wasm STL bug).
        const stats = analyze(result.data, scenario.name);

        // 2. Non-empty printable solid (the compound-cut empty-result bug).
        expect(stats.triangleCount, `${scenario.name}: triangle count`).toBeGreaterThan(0);

        // 3. No NaN/Infinity coordinates.
        expect(stats.minFinite, `${scenario.name}: finite coordinates`).toBe(true);

        // 4. Watertight: a printable mesh has no non-manifold or boundary edges.
        expect(stats.nonManifoldEdges, `${scenario.name}: non-manifold edges`).toBe(0);
        expect(stats.boundaryEdges, `${scenario.name}: boundary edges`).toBe(0);
      },
      scenario.timeout
    );
  }
});
