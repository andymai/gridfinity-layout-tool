/**
 * Topology parity test — verifies that brepkit and OCCT produce topologically
 * equivalent BREP solids for the same bin configurations.
 *
 * Unlike exportParity.test.ts (mesh-level metrics with loose tolerances),
 * this test queries the BREP directly: face/edge/vertex counts, Euler
 * characteristic, exact BREP volume, solid validity, and STEP export.
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__test-infra__/topologyParity
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel } from 'brepjs';
import { clearAllCaches, getLastSolid } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { Shape3D } from 'brepjs';
import {
  initOcctKernel,
  initBrepkitKernel,
  loadGenerateBin,
  collectTopologyStats,
  exportStepBlob,
  validateStepBlob,
} from './dualKernelInit';
import type { GenerateBinFn, TopologyStats } from './dualKernelInit';

// ─── Test configs ───────────────────────────────────────────────────────────

interface TestCase {
  readonly name: string;
  readonly overrides: Partial<BinParams>;
}

const TEST_CASES: readonly TestCase[] = [
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
  {
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
      label: { enabled: true, style: 'full-width', overhang: 0 },
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  },
];

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('topology parity: brepkit vs OCCT', () => {
  const occtStats = new Map<string, TopologyStats>();
  const brepkitStats = new Map<string, TopologyStats>();
  const occtSolids = new Map<string, Shape3D>();
  const brepkitSolids = new Map<string, Shape3D>();

  beforeAll(async () => {
    await initOcctKernel();
    await initBrepkitKernel();
    const generateBin: GenerateBinFn = await loadGenerateBin();

    for (const tc of TEST_CASES) {
      try {
        clearAllCaches();
        const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
        withKernel('occt', () => generateBin(params, undefined, true));
        const occtSolid = withKernel('occt', () => getLastSolid());
        if (occtSolid) {
          occtSolids.set(tc.name, occtSolid);
          occtStats.set(
            tc.name,
            withKernel('occt', () => collectTopologyStats(occtSolid))
          );
        }
      } catch (e) {
        console.warn(`OCCT failed for "${tc.name}":`, e);
      }
    }

    for (const tc of TEST_CASES) {
      try {
        clearAllCaches();
        const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
        withKernel('brepkit', () => generateBin(params, undefined, true));
        const bkSolid = withKernel('brepkit', () => getLastSolid());
        if (bkSolid) {
          brepkitSolids.set(tc.name, bkSolid);
          brepkitStats.set(
            tc.name,
            withKernel('brepkit', () => collectTopologyStats(bkSolid))
          );
        }
      } catch (e) {
        console.warn(`brepkit failed for "${tc.name}":`, e);
      }
    }
  }, 120_000);

  for (const tc of TEST_CASES) {
    describe(tc.name, () => {
      it('both kernels produce valid solids', () => {
        const occt = occtStats.get(tc.name);
        const bk = brepkitStats.get(tc.name);
        expect(occt, 'OCCT stats missing').toBeDefined();
        expect(bk, 'brepkit stats missing').toBeDefined();
        expect(occt?.isValid, 'OCCT solid should be valid').toBe(true);
        expect(bk?.isValid, 'brepkit solid should be valid').toBe(true);
      });

      it('Euler characteristic matches (same topology genus)', () => {
        const occt = occtStats.get(tc.name);
        const bk = brepkitStats.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        if (!occt || !bk) return;

        // Both kernels should produce the same Euler χ = V - E + F.
        // The absolute value depends on through-holes (genus), but
        // both kernels modelling the same bin must agree.
        expect(bk.eulerCharacteristic).toBe(occt.eulerCharacteristic);
      });

      it('BREP volumes match within 10%', () => {
        const occt = occtStats.get(tc.name);
        const bk = brepkitStats.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        if (!occt || !bk) return;

        expect(occt.volume).toBeGreaterThan(0);
        expect(bk.volume).toBeGreaterThan(0);
        const pctDiff = Math.abs(bk.volume - occt.volume) / occt.volume;
        expect(pctDiff).toBeLessThan(0.1);
      });

      it('face counts within 30%', () => {
        const occt = occtStats.get(tc.name);
        const bk = brepkitStats.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        if (!occt || !bk) return;

        expect(occt.faceCount).toBeGreaterThan(0);
        expect(bk.faceCount).toBeGreaterThan(0);
        const pctDiff = Math.abs(bk.faceCount - occt.faceCount) / occt.faceCount;
        expect(pctDiff).toBeLessThan(0.3);
      });

      it('STEP export produces non-empty output', () => {
        const occt = occtStats.get(tc.name);
        const bk = brepkitStats.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();

        expect(occt?.stepByteSize, 'OCCT STEP should be non-empty').toBeGreaterThan(0);
        expect(bk?.stepByteSize, 'brepkit STEP should be non-empty').toBeGreaterThan(0);
      });
    });
  }

  it('validates STEP headers asynchronously', async () => {
    let validated = 0;
    for (const tc of TEST_CASES) {
      const occtSolid = occtSolids.get(tc.name);
      const bkSolid = brepkitSolids.get(tc.name);
      if (!occtSolid || !bkSolid) continue;

      // exportSTEP is the kernel-sensitive call and completes synchronously;
      // extracting blobs here avoids relying on withKernel wrapping async fns.
      const occtBlob = withKernel('occt', () => exportStepBlob(occtSolid));
      const bkBlob = withKernel('brepkit', () => exportStepBlob(bkSolid));

      const [occtStep, bkStep] = await Promise.all([
        validateStepBlob(occtBlob),
        validateStepBlob(bkBlob),
      ]);

      expect(occtStep.headerValid, `${tc.name}: OCCT STEP header`).toBe(true);
      expect(bkStep.headerValid, `${tc.name}: brepkit STEP header`).toBe(true);
      validated++;
    }
    expect(validated, 'at least one case must have been validated').toBeGreaterThan(0);
  });

  it('prints topology comparison summary', () => {
    /* eslint-disable no-console */
    console.log(
      '\n┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐'
    );
    console.log(
      '│  Topology Parity: brepkit vs OCCT                                                                              │'
    );
    console.log(
      '├──────────────────────────┬───────┬───────┬────────┬────────┬────────┬────────┬───────┬───────┬──────────────────┤'
    );
    console.log(
      '│ Scenario                 │ OC F  │ BK F  │ OC E   │ BK E   │ OC V   │ BK V   │ OC χ  │ BK χ  │   Vol diff       │'
    );
    console.log(
      '├──────────────────────────┼───────┼───────┼────────┼────────┼────────┼────────┼───────┼───────┼──────────────────┤'
    );
    for (const tc of TEST_CASES) {
      const occt = occtStats.get(tc.name);
      const bk = brepkitStats.get(tc.name);
      if (!occt || !bk) continue;
      const volDiff = (((bk.volume - occt.volume) / occt.volume) * 100).toFixed(2);
      console.log(
        `│ ${tc.name.padEnd(24)} │ ${String(occt.faceCount).padStart(5)} │ ${String(bk.faceCount).padStart(5)} │ ${String(occt.edgeCount).padStart(6)} │ ${String(bk.edgeCount).padStart(6)} │ ${String(occt.vertexCount).padStart(6)} │ ${String(bk.vertexCount).padStart(6)} │ ${String(occt.eulerCharacteristic).padStart(5)} │ ${String(bk.eulerCharacteristic).padStart(5)} │ ${(volDiff + '%').padStart(16)} │`
      );
    }
    console.log(
      '├──────────────────────────┴───────┴───────┴────────┴────────┴────────┴────────┴───────┴───────┴──────────────────┤'
    );
    console.log(
      '│  F=faces  E=edges  V=vertices  χ=Euler characteristic (V-E+F)  Vol diff=BREP volume % difference              │'
    );
    console.log(
      '└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘'
    );
    /* eslint-enable no-console */
    expect(true).toBe(true);
  });
});
