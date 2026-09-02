/**
 * Shared export-integrity runner.
 *
 * Runs a set of catalog scenarios through binary STL export and asserts the
 * invariants the occt-wasm kernel regressions violated:
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
 * Generation validity (vertex counts, structure) is covered by the matching
 * `binGenerator.scenario.<domain>.test.ts`; this is purely about EXPORT geometry,
 * the layer where the kernel swap introduced corruption.
 *
 * One file per scenario domain (`binGenerator.export.<domain>.test.ts`) calls
 * this, mirroring the generation matrix. That split is a CI wall-time
 * requirement, not tidiness: Vitest parallelizes across FILES but never within
 * one, and `--shard` divides by file path — so the whole catalog in a single file
 * pinned one worker for ~14 minutes and single-handedly set the CI critical path.
 * `binGenerator.scenarioCoverage.test.ts` enforces that every domain has a file
 * here, since per-file wiring can drift in a way a `for (ALL_SCENARIOS)` loop
 * could not.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { measureVolume, unwrap } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildParams } from './scenarioTypes';
import type { ScenarioCase } from './scenarioTypes';
import {
  setLastSolid,
  clearAllCaches,
  getLastSolid,
  getLastExportShellCount,
  setLastExportShellCount,
} from '../shapeCache';
import type * as BinExporterModule from '../binExporter';

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
//
// Splitting the matrix per domain shrinks each worker's arena, so the stranding
// is rarer than it was in the single-file form — but it is per-worker state, so
// the recovery has to live here rather than being dropped.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- KernelInstance is typed as any in brepjs
  registerKernel('brepkit', new BrepkitAdapter(kernel as any));
  clearLastPanicMessage?.();
  poisoned = false;
}

interface ManifoldStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  minFinite: boolean;
  /** Signed volume of the triangle soup (positive for outward-facing triangles). */
  volume: number;
  /** Zero-area triangles, left out of the edge bookkeeping. */
  degenerateTriangles: number;
}

/** Parse a binary STL and compute manifold/finiteness stats. Throws on parse failure. */
function analyze(stl: ArrayBuffer, label: string): ManifoldStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) {
    const detail =
      parsed.error.code === 'VALIDATION_IMPORT_FAILED'
        ? parsed.error.errors.join('; ')
        : parsed.error.message;
    throw new Error(`${label}: STL parse failed — ${detail}`);
  }
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  let minFinite = true;
  let volume = 0;
  let degenerateTriangles = 0;
  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const base = t * 9;
    for (let i = 0; i < 9; i++) {
      if (!Number.isFinite(vertices[base + i])) minFinite = false;
    }
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = vertices.subarray(base, base + 9);
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    const keys = [
      vKey(vertices[base], vertices[base + 1], vertices[base + 2]),
      vKey(vertices[base + 3], vertices[base + 4], vertices[base + 5]),
      vKey(vertices[base + 6], vertices[base + 7], vertices[base + 8]),
    ];
    // A zero-area triangle (two quantized corners coincide) has no surface
    // and cannot open a hole, but its collapsed edge counts once and its two
    // coincident edges land twice on a real edge, which reads as a boundary
    // plus a non-manifold edge. Slivers left by a fillet along a boolean seam
    // tessellate this way; they are counted and capped below, not scored as
    // edges.
    if (keys[0] === keys[1] || keys[1] === keys[2] || keys[2] === keys[0]) {
      degenerateTriangles++;
      continue;
    }
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
  return { triangleCount, nonManifoldEdges, boundaryEdges, minFinite, volume, degenerateTriangles };
}

/**
 * Scenarios whose export body legitimately carries more than one shell before
 * `keepOuterShell`. Keyed by `${category} › ${name}`, each with the reason;
 * anything else with extra shells is a boolean that glued instead of unioning
 * (occt-wasm's fuseAll did exactly that through 4.3.2, and the collapse then
 * shipped a body with its additive features carved out).
 */
const MULTI_SHELL_SCENARIOS = new Map<string, string>([
  // The rim track's two top bars fuse as their own closed solids (they meet
  // the support bars along a face the fuse does not merge), so the body
  // reaches the exporter as three closed shells. The collapse leaves it alone
  // and the STL carries all three; the same result on every kernel so far.
  ['slide tray › rim track on a lipped bin', 'rim-track top bars are separate closed solids'],
  [
    'slide tray › rim track without a stacking lip',
    'rim-track top bars are separate closed solids',
  ],
]);

/**
 * Zero-area triangles tolerated per export. A fillet along a boolean seam can
 * leave a sliver face that tessellates to one or two collapsed triangles; a
 * regression that sprays them across a feature blows through this.
 */
const MAX_DEGENERATE_TRIANGLES = 4;

/**
 * How far the exported mesh's volume may sit from the BREP solid's. Chordal
 * tessellation at export tolerance loses a few tenths of a percent on curved
 * faces; a dropped or inverted shell moves it by whole features.
 */
const MAX_VOLUME_DRIFT = 0.01;

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

/**
 * Register the export-integrity suite for one domain's scenarios. Call once at
 * the top level of a `binGenerator.export.<domain>.test.ts` file.
 */
export function runExportIntegrity(scenarios: readonly ScenarioCase[]): void {
  beforeAll(async () => {
    const { initBrepjs } = await import('./wasmInit');
    await initBrepjs();
    exportBin = (await import('../binExporter')).exportBin;
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

  describe('export integrity: scenario matrix → binary STL', () => {
    // Reset the last-solid pointer between scenarios. `exportBin` now keys
    // reuse on a params fingerprint (GH), so this is belt-and-braces
    // rather than load-bearing: it keeps a scenario from depending on the
    // previous one's cache state at all. The param-keyed intermediate LRU
    // caches (socket/lip/box) stay warm for speed.
    beforeEach(async () => {
      setLastSolid(null);
      setLastExportShellCount(null);
      // Recover if the prior scenario stranded the kernel — detected by the
      // borrow-flag poison signature in its error (`poisoned`, covers both the
      // panic-abort and non-panic stranding) OR by a recorded Rust panic that
      // left no catchable JS error on this scenario yet (lastPanicMessage).
      if (KERNEL_IS_BREPKIT && (poisoned || lastPanicMessage?.())) {
        await recoverBrepkitKernel();
      }
    });

    for (const scenario of scenarios) {
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
            expect(
              stats.degenerateTriangles,
              `${scenario.name}: zero-area triangles`
            ).toBeLessThanOrEqual(MAX_DEGENERATE_TRIANGLES);

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

            // 6. The body reached the exporter as ONE shell. A watertight mesh can
            //    still be the wrong solid: when the boolean stage glues features
            //    instead of unioning them, `keepOuterShell` collapses the tangle to
            //    its largest shell and ships a body with those features subtracted.
            const shells = getLastExportShellCount();
            const multiShellReason = MULTI_SHELL_SCENARIOS.get(label);
            if (multiShellReason === undefined) {
              expect(shells, `${scenario.name}: shells before outer-shell collapse`).toBe(1);
            } else {
              expect(shells, `${scenario.name}: ${multiShellReason}`).toBeGreaterThan(1);
            }

            // 7. The mesh is the solid: its volume matches the BREP's to within
            //    tessellation error, so nothing was dropped or inverted on the way
            //    from solid to triangles.
            const solid = getLastSolid();
            if (solid) {
              const brepVolume = unwrap(measureVolume(solid));
              expect(brepVolume, `${scenario.name}: BREP volume`).toBeGreaterThan(0);
              expect(
                Math.abs(stats.volume - brepVolume) / brepVolume,
                `${scenario.name}: mesh volume ${stats.volume.toFixed(1)} vs BREP ${brepVolume.toFixed(1)}`
              ).toBeLessThan(MAX_VOLUME_DRIFT);
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
}
