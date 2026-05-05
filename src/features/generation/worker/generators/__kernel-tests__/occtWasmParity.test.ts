/**
 * Topology + bounds + STEP-export parity test — verifies that the alternative
 * `occt-wasm` kernel produces equivalent BREP solids to the current default
 * `'occt'` kernel (brepjs-opencascade) for the same bin configurations.
 *
 * Both kernels wrap the same upstream OCCT engine, so this is the "newer
 * Emscripten build vs older Emscripten build" comparison — the one that
 * matters for evaluating occt-wasm as a default replacement.
 *
 * Run:
 *   pnpm exec vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__kernel-tests__/occtWasmParity
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel, getBounds, unwrap, isOk } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { clearAllCaches, getLastSolid } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import {
  initOcctKernel,
  initOcctWasmKernel,
  loadGenerateBin,
  collectTopologyStats,
  exportStepBlob,
  validateStepBlob,
} from './dualKernelInit';
import type { GenerateBinFn, TopologyStats } from './dualKernelInit';
import { CORE_PARITY_CASES } from './testCases';

const TEST_CASES = CORE_PARITY_CASES;

/**
 * `dualKernelInit.collectTopologyStats` assigns `volume: measureVolume(solid)`
 * directly, but `measureVolume` returns `Result<number>` in current brepjs.
 * Tolerate both shapes here so the test surfaces real parity gaps rather
 * than the upstream type drift.
 */
function asVolumeNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && isOk(v as { ok: boolean; value: unknown })) {
    return unwrap(v as Parameters<typeof unwrap>[0]) as number;
  }
  return Number.NaN;
}

interface BBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

interface CaseResult {
  solid: Shape3D | null;
  stats: TopologyStats | null;
  bounds: BBox | null;
  stepBytes: number;
  stepHeaderValid: boolean;
  error: string | null;
}

async function runOnKernel(
  kernelId: 'occt' | 'occt-wasm',
  generateBin: GenerateBinFn,
  params: BinParams
): Promise<CaseResult> {
  try {
    clearAllCaches();
    try {
      withKernel(kernelId, () => generateBin(params));
    } catch {
      /* generators sometimes throw on mesh-stage issues even when BREP succeeds */
    }
    const solid = withKernel(kernelId, () => getLastSolid());
    if (!solid)
      return {
        solid: null,
        stats: null,
        bounds: null,
        stepBytes: 0,
        stepHeaderValid: false,
        error: 'no solid produced',
      };
    const stats = withKernel(kernelId, () => collectTopologyStats(solid));
    const bounds = withKernel(kernelId, () => getBounds(solid)) as BBox;
    const blob = withKernel(kernelId, () => exportStepBlob(solid));
    const { byteSize, headerValid } = await validateStepBlob(blob);
    return {
      solid,
      stats,
      bounds,
      stepBytes: byteSize,
      stepHeaderValid: headerValid,
      error: null,
    };
  } catch (e) {
    return {
      solid: null,
      stats: null,
      bounds: null,
      stepBytes: 0,
      stepHeaderValid: false,
      error: String(e),
    };
  }
}

describe('topology parity: occt-wasm vs occt (brepjs-opencascade)', () => {
  const results = new Map<string, { occt: CaseResult; occtWasm: CaseResult }>();

  beforeAll(async () => {
    await initOcctKernel();
    await initOcctWasmKernel();
    const generateBin: GenerateBinFn = await loadGenerateBin();
    clearAllCaches();

    for (const tc of TEST_CASES) {
      const params = migrateParams({ ...DEFAULT_BIN_PARAMS, ...tc.overrides });
      const occt = await runOnKernel('occt', generateBin, params);
      const occtWasm = await runOnKernel('occt-wasm', generateBin, params);
      results.set(tc.name, { occt, occtWasm });

      if (occt.error) console.warn(`occt failed for "${tc.name}": ${occt.error}`);
      if (occtWasm.error) console.warn(`occt-wasm failed for "${tc.name}": ${occtWasm.error}`);
    }
  }, 900_000);

  for (const tc of TEST_CASES) {
    describe(tc.name, () => {
      it('both kernels produce a solid', () => {
        const r = results.get(tc.name)!;
        expect(r.occt.stats, `occt: ${r.occt.error ?? 'no stats'}`).not.toBeNull();
        expect(r.occtWasm.stats, `occt-wasm: ${r.occtWasm.error ?? 'no stats'}`).not.toBeNull();
      });

      it('both solids are valid', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.occtWasm.stats) return;
        expect(r.occt.stats.isValid, 'occt invalid').toBe(true);
        expect(r.occtWasm.stats.isValid, 'occt-wasm invalid').toBe(true);
      });

      it('Euler characteristic matches', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.occtWasm.stats) return;
        expect(
          r.occtWasm.stats.eulerCharacteristic,
          `occt=${r.occt.stats.eulerCharacteristic} occt-wasm=${r.occtWasm.stats.eulerCharacteristic}`
        ).toBe(r.occt.stats.eulerCharacteristic);
      });

      it('face/edge/vertex counts match exactly', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.occtWasm.stats) return;
        const o = r.occt.stats;
        const w = r.occtWasm.stats;
        expect(w.faceCount, `faces o=${o.faceCount} w=${w.faceCount}`).toBe(o.faceCount);
        expect(w.edgeCount, `edges o=${o.edgeCount} w=${w.edgeCount}`).toBe(o.edgeCount);
        expect(w.vertexCount, `verts o=${o.vertexCount} w=${w.vertexCount}`).toBe(o.vertexCount);
      });

      it('volumes match within 0.01% (same engine, expect tight)', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.occtWasm.stats) return;
        const o = asVolumeNumber(r.occt.stats.volume);
        const w = asVolumeNumber(r.occtWasm.stats.volume);
        expect(
          o,
          `occt vol not numeric (raw=${JSON.stringify(r.occt.stats.volume)})`
        ).toBeGreaterThan(0);
        expect(
          w,
          `occt-wasm vol not numeric (raw=${JSON.stringify(r.occtWasm.stats.volume)})`
        ).toBeGreaterThan(0);
        const pct = Math.abs(w - o) / o;
        expect(
          pct,
          `vol o=${o.toFixed(3)} w=${w.toFixed(3)} diff=${(pct * 100).toFixed(4)}%`
        ).toBeLessThan(0.0001);
      });

      it('bounding boxes match within 0.1mm', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.bounds || !r.occtWasm.bounds) return;
        const ob = r.occt.bounds;
        const wb = r.occtWasm.bounds;
        // 0.1mm tolerance, not 0.01mm: brepjs-occt (v8) calls
        // `BRepBndLib::Add(shape, box, true)` which adds the shape's
        // accumulated tolerance to the bound; occt-wasm 3.0 uses
        // `BRepBndLib::AddOptimal(shape, box, true, false)` which gives
        // surface-precise bounds without the tolerance buffer. On bins
        // with stacked boolean operations the two converge to within
        // ~0.1mm — a legitimate engine convention difference, not a
        // parity gap. The original ~1.2mm xMin shift this test was
        // written against was a real sign-convention bug in occt-wasm
        // ≤2.x and is fully closed in 3.0.
        const tol = 0.1;
        for (const k of ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'] as const) {
          expect(Math.abs(ob[k] - wb[k]), `${k}: o=${ob[k]} w=${wb[k]}`).toBeLessThan(tol);
        }
      });

      it('STEP export round-trips', () => {
        const r = results.get(tc.name)!;
        expect(r.occt.stepHeaderValid, 'occt STEP invalid').toBe(true);
        expect(r.occtWasm.stepHeaderValid, 'occt-wasm STEP invalid').toBe(true);
        expect(r.occt.stepBytes, 'occt STEP empty').toBeGreaterThan(100);
        expect(r.occtWasm.stepBytes, 'occt-wasm STEP empty').toBeGreaterThan(100);
      });
    });
  }

  it('prints parity report', () => {
    /* eslint-disable no-console */
    console.log('\n=== OCCT-WASM vs OCCT PARITY REPORT ===\n');
    for (const tc of TEST_CASES) {
      const r = results.get(tc.name)!;
      const o = r.occt.stats;
      const w = r.occtWasm.stats;
      console.log(`[${tc.name}]`);
      if (!o || !w) {
        console.log(
          `  SKIPPED — occt: ${o ? 'ok' : r.occt.error}, occt-wasm: ${w ? 'ok' : r.occtWasm.error}`
        );
        continue;
      }
      const fd = w.faceCount - o.faceCount;
      const ed = w.edgeCount - o.edgeCount;
      const vd = w.vertexCount - o.vertexCount;
      const ov = asVolumeNumber(o.volume);
      const wv = asVolumeNumber(w.volume);
      const vp = Number.isFinite(ov) && ov > 0 ? (((wv - ov) / ov) * 100).toFixed(4) : 'NaN';
      const stepDiff = r.occtWasm.stepBytes - r.occt.stepBytes;
      console.log(`  faces: ${o.faceCount} -> ${w.faceCount} (${fd >= 0 ? '+' : ''}${fd})`);
      console.log(`  edges: ${o.edgeCount} -> ${w.edgeCount} (${ed >= 0 ? '+' : ''}${ed})`);
      console.log(`  verts: ${o.vertexCount} -> ${w.vertexCount} (${vd >= 0 ? '+' : ''}${vd})`);
      console.log(`  euler: ${o.eulerCharacteristic} -> ${w.eulerCharacteristic}`);
      console.log(`  vol:   ${ov.toFixed(2)} -> ${wv.toFixed(2)} mm^3 (${vp}%)`);
      console.log(`  valid: ${o.isValid ? 'Y' : 'N'} -> ${w.isValid ? 'Y' : 'N'}`);
      console.log(
        `  STEP:  ${r.occt.stepBytes}B -> ${r.occtWasm.stepBytes}B (${stepDiff >= 0 ? '+' : ''}${stepDiff}B)`
      );
    }
    console.log('\n=========================================\n');
    /* eslint-enable no-console */
  });
});
