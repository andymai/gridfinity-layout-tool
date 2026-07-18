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
 *  2. The solid is non-empty and watertight — no boundary edges (hole-free) for
 *     every scenario, and fully 2-manifold except for a documented handful whose
 *     input has a measure-zero self-contact (see
 *     MEASURE_ZERO_SELF_CONTACT_SCENARIOS).
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
import { setLastSolid, clearAllCaches } from './shapeCache';
import type * as BinExporterModule from './binExporter';

let exportBin: typeof BinExporterModule.exportBin;

// ── brepkit kernel-poison recovery ─────────────────────────────────────────
// The brepkit WASM kernel is a per-worker singleton whose arena grows across
// every scenario. Two distinct bugs strand its wasm-bindgen borrow flag once
// enough state accumulates (see brepkit task #14):
//   1. a `raw_vec` "capacity overflow" Rust panic (panic=abort → the trap never
//      releases the &mut self borrow), first observed on the magnet+halfSockets
//      scenario;
//   2. a NON-panic stranding (a JS exception unwinding through a &mut self wasm
//      method leaves the BorrowMut guard undropped), observed on honeycomb
//      custom shapes — this one recurs as the arena regrows.
// Either strands the kernel so EVERY later scenario throws "recursive use of an
// object detected which would lead to unsafe aliasing in rust" in ~0ms — a
// cascade that masked ~180 scenarios behind the FIRST victim. catch_unwind is
// inert on wasm (panic=abort) and Rust cannot reset the flag; the only recovery
// is a NEW BrepKernel. This harness detects the poison signature and recreates
// the kernel so each later scenario runs healthy, revealing the true pass/fail.
const KERNEL_IS_BREPKIT = ['brepkit', 'wasm'].includes(process.env['BREPJS_KERNEL'] ?? '');
const POISON_RE = /recursive use of an object|unsafe aliasing/i;
let lastPanicMessage: (() => string | undefined) | null = null;
let clearLastPanicMessage: (() => void) | null = null;
let poisoned = false;

/**
 * Recreate the poisoned singleton BrepKernel. Cached socket/lip/box/shell solids
 * (and lastSolid) index the DEAD arena, so clearAllCaches() must drop them first
 * — brepkit's dispose is a no-op, so that is safe even while poisoned. A fresh
 * BrepKernel has a fresh borrow flag; re-registering it as the default reroutes
 * all later brepjs ops (they resolve getKernel() per call).
 */
async function recoverBrepkitKernel(): Promise<void> {
  // Best-effort: dispose calls shape.delete() on the dead arena (brepkit's
  // dispose is a no-op, safe while poisoned), but never let a throwing disposer
  // block the fresh kernel below — that recreation is what actually recovers.
  try {
    clearAllCaches();
  } catch {
    /* fresh kernel below restores health regardless */
  }
  const { registerKernel, BrepkitAdapter } = await import('brepjs');
  const brepkitWasm = await import('brepkit-wasm');
  const kernel = new brepkitWasm.BrepKernel();
  registerKernel('brepkit', new BrepkitAdapter(kernel as any));
  clearLastPanicMessage?.();
  poisoned = false;
}

beforeAll(async () => {
  const { initBrepjs } = await import('./__kernel-tests__/wasmInit');
  await initBrepjs();
  exportBin = (await import('./binExporter')).exportBin;
  if (KERNEL_IS_BREPKIT) {
    const bkw = (await import('brepkit-wasm')) as unknown as {
      lastPanicMessage?: () => string | undefined;
      clearLastPanicMessage?: () => void;
    };
    lastPanicMessage = bkw.lastPanicMessage ?? null;
    clearLastPanicMessage = bkw.clearLastPanicMessage ?? null;
    clearLastPanicMessage?.();
  }
}, 120_000);

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
 * Scenarios that export a CLOSED (hole-free) mesh which is nonetheless
 * non-manifold along a measure-zero self-contact — not a boolean artifact but a
 * geometric inevitability of the input:
 *
 *  - `2 circle inserts`: two cavity cuts placed exactly tangent (centres 2r
 *    apart) leave a zero-thickness knife edge in the wall between them. Any
 *    realistic spacing — overlapping OR separated by a hair — is fully manifold
 *    (verified); only the exact-tangent limit pinches.
 *  - `XOR keeps non-overlapping regions`: the symmetric difference of two
 *    overlapping rectangles always meets at the overlap's corners, so the two
 *    kept regions touch along the corner edges by construction.
 *
 * A 2-manifold mesh can't represent a measure-zero contact, so forcing these to
 * be manifold would mean silently perturbing the user's geometry. They are
 * still printable: the mesh has NO boundary edges (no holes), and slicers
 * resolve the self-contact via the fill rule. So instead of skipping them, the
 * matrix holds them to the real printable guarantee — zero boundary edges — and
 * tolerates a bounded, inherent non-manifold contact (asserted below). Keyed by
 * `${category} › ${name}`.
 */
const MEASURE_ZERO_SELF_CONTACT_SCENARIOS = new Set<string>([
  'multiple inserts › 2×2 with 2 circle inserts',
  'pathfinder › exclude group: XOR keeps non-overlapping regions',
]);

/**
 * Upper bound on the non-manifold edges tolerated along a measure-zero
 * self-contact. Observed baselines are 1 (circle tangent point) and 2 (XOR
 * overlap corners); the small headroom absorbs minor tessellation differences,
 * while a genuine manifold-breaking regression — which scatters non-manifold
 * edges across whole walls — blows past the cap and trips the test.
 */
const MAX_MEASURE_ZERO_CONTACT_EDGES = 8;

describe('export integrity: full scenario matrix → binary STL', () => {
  // Reset the last-solid pointer so each scenario actually builds and exports
  // its OWN solid. `exportBin` skips regeneration whenever the cached solid is
  // export-quality (isLastSolidExportQuality), and that flag is param-blind —
  // without this reset the first scenario's export-quality solid would be
  // re-exported for all 354 scenarios, making every assertion vacuous. In
  // production a preview pass (forExport=false) clears the flag on every param
  // change; this loop never previews, so we clear it explicitly. The
  // param-keyed intermediate LRU caches (socket/lip/box) stay warm for speed.
  beforeEach(async () => {
    setLastSolid(null);
    // Recover if the prior scenario stranded the kernel — detected by the
    // borrow-flag poison signature in its error (`poisoned`, covers both the
    // panic-abort and non-panic stranding) OR by a recorded Rust panic that
    // left no catchable JS error on this scenario yet (lastPanicMessage).
    if (KERNEL_IS_BREPKIT && (poisoned || lastPanicMessage?.())) {
      await recoverBrepkitKernel();
    }
  });

  for (const scenario of ALL_SCENARIOS) {
    const label = `${scenario.category} › ${scenario.name}`;
    const measureZeroSelfContact = MEASURE_ZERO_SELF_CONTACT_SCENARIOS.has(label);
    it(
      label,
      async () => {
        try {
          const params = buildParams(scenario.params);
          const result = await exportBin(params, 'stl');

          // 1. Buffer is well-formed and parseable (the occt-wasm STL bug).
          const stats = analyze(result.data, scenario.name);

          // 2. Non-empty printable solid (the compound-cut empty-result bug).
          expect(stats.triangleCount, `${scenario.name}: triangle count`).toBeGreaterThan(0);

          // 3. No NaN/Infinity coordinates.
          expect(stats.minFinite, `${scenario.name}: finite coordinates`).toBe(true);

          // 4. Hole-free: no boundary edges. This is the real printable-watertight
          //    guarantee and holds for EVERY scenario, including the measure-zero
          //    self-contact cases.
          expect(stats.boundaryEdges, `${scenario.name}: boundary edges`).toBe(0);

          // 5. Fully 2-manifold (no edge shared by >2 triangles) — required of
          //    every scenario except the documented measure-zero self-contact
          //    cases (see MEASURE_ZERO_SELF_CONTACT_SCENARIOS). Those are bounded
          //    on BOTH sides rather than left unchecked: a lower bound of >0 makes
          //    the carve-out self-expiring — if a kernel upgrade ever resolves the
          //    pinch, this fails and signals the scenario can rejoin the strict
          //    tier — and the upper cap catches a hole-free-but-manifold-broken
          //    regression that the boundary-edge check (4) alone would miss.
          if (measureZeroSelfContact) {
            expect(
              stats.nonManifoldEdges,
              `${scenario.name}: non-manifold edges (self-contact must persist)`
            ).toBeGreaterThan(0);
            expect(
              stats.nonManifoldEdges,
              `${scenario.name}: non-manifold edges (must stay bounded)`
            ).toBeLessThanOrEqual(MAX_MEASURE_ZERO_CONTACT_EDGES);
          } else {
            expect(stats.nonManifoldEdges, `${scenario.name}: non-manifold edges`).toBe(0);
          }
        } catch (e) {
          // Flag borrow-flag poison so beforeEach recreates the kernel before
          // the next scenario — stops one stranding from cascading into ~0ms
          // "recursive use" failures across every later scenario.
          const msg = e instanceof Error ? e.message : String(e);
          if (KERNEL_IS_BREPKIT && POISON_RE.test(msg)) poisoned = true;
          throw e;
        }
      },
      scenario.timeout
    );
  }
});
