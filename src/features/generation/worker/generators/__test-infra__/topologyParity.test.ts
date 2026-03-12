/**
 * Topology parity test — verifies that brepkit and OCCT produce topologically
 * equivalent BREP solids for the same bin configurations.
 *
 * Compares BREP directly: face/edge/vertex counts, Euler characteristic,
 * exact BREP volume, bounding box, and solid validity. No meshing or STEP
 * export — those test serialisation/rendering, not topology.
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__test-infra__/topologyParity
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel, getKernel, getBounds } from 'brepjs';
import { clearAllCaches, getLastSolid } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';
import type { Shape3D } from 'brepjs';
import {
  initOcctKernel,
  initBrepkitKernel,
  loadGenerateBin,
  collectTopologyStats,
  collectTopologyStatsRaw,
} from './dualKernelInit';
import type { GenerateBinFn, TopologyStats } from './dualKernelInit';

// ─── Test configs ───────────────────────────────────────────────────────────

interface TestCase {
  readonly name: string;
  readonly overrides: Partial<BinParams>;
}

const ALL_TEST_CASES: readonly TestCase[] = [
  {
    name: '1×1 standard lip',
    overrides: { width: 1, depth: 1 },
  },
  {
    name: '2×2 standard no-lip',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  },
  {
    name: '2×2 magnet+screw lip',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
    },
  },
  {
    name: '2×2 compartments + scoop',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
      scoop: { enabled: true, radius: 'auto' },
    },
  },
  {
    name: '1×1 flat no-lip',
    overrides: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    },
  },
  {s
    name: '1.5×2 half-bin',
    overrides: {
      width: 1.5,
      depth: 2,
    },
  },
  {
    name: '3×3 scoop+label+lip',
    overrides: {
      width: 3,
      depth: 3,
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  },
];

const TEST_CASES = ALL_TEST_CASES;

// ─── Generation helpers ─────────────────────────────────────────────────────

interface CaseResult {
  solid: Shape3D | null;
  stats: TopologyStats | null;
  error: string | null;
}

function generateOcct(generateBin: GenerateBinFn, params: BinParams): CaseResult {
  try {
    clearAllCaches();
    // generateBin includes meshing which may throw — we only need the solid.
    // setLastSolid() is called before mesh(), so retrieve it regardless.
    try { withKernel('occt', () => generateBin(params)); } catch { /* mesh/late error */ }
    const solid = withKernel('occt', () => getLastSolid());
    if (!solid) return { solid: null, stats: null, error: 'no solid produced' };
    const stats = withKernel('occt', () => collectTopologyStats(solid));
    return { solid, stats, error: null };
  } catch (e) {
    return { solid: null, stats: null, error: String(e) };
  }
}

function generateBrepkit(generateBin: GenerateBinFn, params: BinParams): CaseResult {
  try {
    clearAllCaches();
    try { withKernel('brepkit', () => generateBin(params)); } catch { /* mesh/late error */ }
    const solid = withKernel('brepkit', () => getLastSolid());
    if (!solid) return { solid: null, stats: null, error: 'no solid produced' };

    const rawKernel = getKernel('brepkit').oc as any;
    // Unify co-surface faces if available (matches OCCT's built-in face merging).
    if (typeof rawKernel.unifyFaces === 'function') {
      withKernel('brepkit', () => {
        rawKernel.unifyFaces((solid.wrapped as { id: number }).id);
      });
    }
    // Use raw kernel stats to bypass brepjs's stale topology cache after unifyFaces.
    const stats = withKernel('brepkit', () => collectTopologyStatsRaw(solid, rawKernel));
    return { solid, stats, error: null };
  } catch (e) {
    return { solid: null, stats: null, error: String(e) };
  }
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('topology parity: brepkit vs OCCT', () => {
  const results = new Map<string, { occt: CaseResult; bk: CaseResult }>();

  beforeAll(async () => {
    await initOcctKernel();
    await initBrepkitKernel();
    const generateBin: GenerateBinFn = await loadGenerateBin();

    for (const tc of TEST_CASES) {
      const params = migrateParams({ ...DEFAULT_BIN_PARAMS, ...tc.overrides }) as BinParams;
      const occt = generateOcct(generateBin, params);
      const bk = generateBrepkit(generateBin, params);
      results.set(tc.name, { occt, bk });

      if (occt.error) console.warn(`OCCT generation failed for "${tc.name}": ${occt.error}`);
      if (bk.error) console.warn(`brepkit generation failed for "${tc.name}": ${bk.error}`);
    }
  }, 900_000);

  // ── Per-case parity assertions ──────────────────────────────────────────

  for (const tc of TEST_CASES) {
    describe(tc.name, () => {
      it('both kernels produce a solid', () => {
        const r = results.get(tc.name)!;
        expect(r.occt.stats, `OCCT: ${r.occt.error ?? 'no stats'}`).not.toBeNull();
        expect(r.bk.stats, `brepkit: ${r.bk.error ?? 'no stats'}`).not.toBeNull();
      });

      it('both solids are valid', () => {
        const r = results.get(tc.name)!;
        expect(r.occt.stats, `OCCT generation failed: ${r.occt.error}`).not.toBeNull();
        expect(r.bk.stats, `brepkit generation failed: ${r.bk.error}`).not.toBeNull();
        if (!r.occt.stats || !r.bk.stats) return; // type narrowing only
        expect(r.occt.stats.isValid, 'OCCT solid invalid').toBe(true);
        expect(r.bk.stats.isValid, 'brepkit solid invalid').toBe(true);
      });

      it('Euler characteristic matches (V-E+F)', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.bk.stats) return;
        expect(
          r.bk.stats.eulerCharacteristic,
          `Euler: OCCT=${r.occt.stats.eulerCharacteristic}, brepkit=${r.bk.stats.eulerCharacteristic}`
        ).toBe(r.occt.stats.eulerCharacteristic);
      });

      it('face/edge/vertex counts match', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.bk.stats) return;
        const o = r.occt.stats, b = r.bk.stats;
        expect(b.faceCount, `Faces: OCCT=${o.faceCount}, brepkit=${b.faceCount}`).toBe(o.faceCount);
        expect(b.edgeCount, `Edges: OCCT=${o.edgeCount}, brepkit=${b.edgeCount}`).toBe(o.edgeCount);
        expect(b.vertexCount, `Verts: OCCT=${o.vertexCount}, brepkit=${b.vertexCount}`).toBe(o.vertexCount);
      });

      it('volumes match within 0.1%', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.stats || !r.bk.stats) return;
        const o = r.occt.stats.volume, b = r.bk.stats.volume;
        expect(o).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(0);
        const pct = Math.abs(b - o) / o;
        expect(pct, `Volume: OCCT=${o.toFixed(2)}, brepkit=${b.toFixed(2)}, diff=${(pct*100).toFixed(2)}%`).toBeLessThan(0.001);
      });

      it('bounding boxes match within 0.5mm', () => {
        const r = results.get(tc.name)!;
        if (!r.occt.solid || !r.bk.solid) return;
        const ob = withKernel('occt', () => getBounds(r.occt.solid!));
        const bb = withKernel('brepkit', () => getBounds(r.bk.solid!));
        const tol = 0.5;
        const dim = (b: typeof ob) => ({ x: b.xMax - b.xMin, y: b.yMax - b.yMin, z: b.zMax - b.zMin });
        const od = dim(ob), bd = dim(bb);
        expect(Math.abs(bd.x - od.x), `X: OCCT=${od.x.toFixed(3)}, brepkit=${bd.x.toFixed(3)}`).toBeLessThan(tol);
        expect(Math.abs(bd.y - od.y), `Y: OCCT=${od.y.toFixed(3)}, brepkit=${bd.y.toFixed(3)}`).toBeLessThan(tol);
        expect(Math.abs(bd.z - od.z), `Z: OCCT=${od.z.toFixed(3)}, brepkit=${bd.z.toFixed(3)}`).toBeLessThan(tol);
      });
    });
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  it('prints parity report', () => {
    /* eslint-disable no-console */
    console.log('\n=== TOPOLOGY PARITY REPORT ===\n');
    for (const tc of TEST_CASES) {
      const r = results.get(tc.name)!;
      const o = r.occt.stats, b = r.bk.stats;
      console.log(`[${tc.name}]`);
      if (!o || !b) {
        console.log(`  SKIPPED — OCCT: ${o ? 'ok' : r.occt.error}, brepkit: ${b ? 'ok' : r.bk.error}`);
        continue;
      }
      const fd = b.faceCount - o.faceCount;
      const ed = b.edgeCount - o.edgeCount;
      const vd = b.vertexCount - o.vertexCount;
      const vp = ((b.volume - o.volume) / o.volume * 100).toFixed(2);
      console.log(`  faces:  ${o.faceCount} → ${b.faceCount} (${fd >= 0 ? '+' : ''}${fd})`);
      console.log(`  edges:  ${o.edgeCount} → ${b.edgeCount} (${ed >= 0 ? '+' : ''}${ed})`);
      console.log(`  verts:  ${o.vertexCount} → ${b.vertexCount} (${vd >= 0 ? '+' : ''}${vd})`);
      console.log(`  euler:  ${o.eulerCharacteristic} → ${b.eulerCharacteristic}`);
      console.log(`  vol:    ${o.volume.toFixed(1)} → ${b.volume.toFixed(1)} mm³ (${vp}%)`);
      console.log(`  valid:  ${o.isValid ? '✓' : '✗'} → ${b.isValid ? '✓' : '✗'}`);
    }
    console.log('\n==============================\n');
    /* eslint-enable no-console */
  });
});
