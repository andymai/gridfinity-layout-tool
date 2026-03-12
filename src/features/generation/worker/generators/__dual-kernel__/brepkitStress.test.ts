/**
 * Stress test — pushes brepkit to find edge cases where it fails or
 * diverges from OCCT. Targets known-hard B-Rep scenarios:
 *
 * - Near-degenerate geometry (tiny dimensions, thin walls)
 * - High boolean count (many compartments, inserts, wall cutouts)
 * - Complex feature combos (lip + magnet + scoop + label + compartments)
 * - Large grids (4×4, 6×6)
 * - Half-bin sizes (fractional dimensions)
 * - All base styles
 * - All wall cutout shapes
 * - Solid bins with cutouts
 * - Slotted bins
 * - Wall patterns (honeycomb)
 * - Split bin previews
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__dual-kernel__/brepkitStress.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { clearAllCaches } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, BaseStyle } from '@/shared/types/bin';
import { withKernel } from 'brepjs';
import { initOcctKernel, initBrepkitKernel, loadGenerateBin } from './dualKernelInit';
import type { GenerateBinFn } from './dualKernelInit';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TestResult {
  readonly triangleCount: number;
  readonly ms: number;
  readonly error?: string;
}

interface KernelResults {
  readonly occt: TestResult;
  readonly brepkit: TestResult;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function tryGenerate(
  generateBin: GenerateBinFn,
  params: BinParams,
  forExport: boolean
): TestResult {
  const start = performance.now();
  try {
    const mesh = generateBin(params, undefined, forExport);
    return { triangleCount: mesh.triangleCount, ms: performance.now() - start };
  } catch (e: unknown) {
    return {
      triangleCount: 0,
      ms: performance.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Test configs ───────────────────────────────────────────────────────────

interface StressCase {
  readonly name: string;
  readonly overrides: Partial<BinParams>;
  readonly forExport?: boolean;
}

const BASE_STYLES: readonly BaseStyle[] = [
  'standard',
  'magnet',
  'screw',
  'magnet_and_screw',
  'weighted',
  'flat',
];

const STRESS_CASES: readonly StressCase[] = [
  // ── Extreme dimensions ──
  {
    name: 'minimum: 1×0.5×2',
    overrides: { width: 1, depth: 0.5, height: 2 },
  },
  {
    name: 'minimum: 0.5×1×2',
    overrides: { width: 0.5, depth: 1, height: 2 },
  },
  {
    name: 'tall: 1×1×10',
    overrides: { width: 1, depth: 1, height: 10 },
  },
  {
    name: 'wide: 6×1×2',
    overrides: { width: 6, depth: 1, height: 2 },
  },
  {
    name: 'large: 6×6×6',
    overrides: {
      width: 6,
      depth: 6,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  },
  {
    name: 'fractional: 1.5×2.5×3',
    overrides: { width: 1.5, depth: 2.5, height: 3 },
  },

  // ── All base styles ──
  ...BASE_STYLES.map((style) => ({
    name: `base: ${style} lip`,
    overrides: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: true },
    },
  })),
  ...BASE_STYLES.map((style) => ({
    name: `base: ${style} no-lip`,
    overrides: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style, stackingLip: false },
    },
  })),

  // ── Thin walls ──
  {
    name: 'thin walls: 0.8mm',
    overrides: {
      width: 2,
      depth: 2,
      wallThickness: 0.8,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  },

  // ── Many compartments (high boolean count) ──
  {
    name: '4×4 compartments (16 booleans)',
    overrides: {
      width: 4,
      depth: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: {
        cols: 4,
        rows: 4,
        thickness: 1.2,
        cells: Array.from({ length: 16 }, (_, i) => i),
      },
    },
  },
  {
    name: '8×8 compartments (64 booleans)',
    overrides: {
      width: 4,
      depth: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: {
        cols: 8,
        rows: 8,
        thickness: 1.0,
        cells: Array.from({ length: 64 }, (_, i) => i),
      },
    },
  },
  {
    name: 'merged compartments (L-shape)',
    overrides: {
      width: 3,
      depth: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      compartments: {
        cols: 3,
        rows: 3,
        thickness: 1.2,
        // L-shape: cells 0,1,3 form one compartment
        cells: [0, 0, 1, 0, 2, 3, 4, 5, 6],
      },
    },
  },

  // ── Feature combos ──
  {
    name: 'all features: lip+mag+scoop+label+compartments',
    overrides: {
      width: 3,
      depth: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
      compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    },
  },
  {
    name: 'all features + wall cutouts all sides',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'solid', depth: 15, width: 80, alignment: 'center' },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 60, depth: 40 },
        back: { enabled: true, width: 60, depth: 40 },
        left: { enabled: true, width: 60, depth: 40 },
        right: { enabled: true, width: 60, depth: 40 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    },
  },

  // ── Wall cutout shapes ──
  {
    name: 'scoop wall cutouts',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      walls: {
        enabled: true,
        shape: 'scoop',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 80, depth: 60 },
        back: { enabled: true, width: 80, depth: 60 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    },
  },
  {
    name: 'funnel wall cutouts',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      walls: {
        enabled: true,
        shape: 'funnel',
        width: 0,
        depth: 0,
        front: { enabled: true, width: 80, depth: 60 },
        back: { enabled: true, width: 80, depth: 60 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    },
  },

  // ── Inserts ──
  {
    name: 'multiple inserts: rect+circle+hex',
    overrides: {
      width: 3,
      depth: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      inserts: [
        {
          id: 'a',
          templateId: null,
          shape: 'rectangle',
          x: 5,
          y: 5,
          width: 20,
          depth: 15,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
        {
          id: 'b',
          templateId: null,
          shape: 'circle',
          x: 50,
          y: 5,
          width: 20,
          depth: 20,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
        {
          id: 'c',
          templateId: null,
          shape: 'hexagon',
          x: 5,
          y: 50,
          width: 25,
          depth: 25,
          cutDepth: 4,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
        {
          id: 'd',
          templateId: null,
          shape: 'rounded-rect',
          x: 50,
          y: 50,
          width: 30,
          depth: 20,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 3,
          label: '',
        },
        {
          id: 'e',
          templateId: null,
          shape: 'slot',
          x: 30,
          y: 30,
          width: 40,
          depth: 8,
          cutDepth: 3,
          rotation: 90,
          cornerRadius: 0,
          label: '',
        },
      ],
    },
  },

  // ── Slotted bin ──
  {
    name: 'slotted 2×2',
    overrides: {
      width: 2,
      depth: 2,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    },
  },
  {
    name: 'slotted 3×3 with lip',
    overrides: {
      width: 3,
      depth: 3,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
  },

  // ── Honeycomb (known stress) ──
  {
    name: 'honeycomb 1×1 h=2',
    overrides: {
      width: 1,
      depth: 1,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
  },

  // ── Solid bin with cutouts ──
  {
    name: 'solid bin with circle cutout',
    overrides: {
      width: 2,
      depth: 2,
      style: 'solid' as BinParams['style'],
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false, solid: true },
      cutouts: [
        {
          id: 'c1',
          shape: 'circle',
          x: 20,
          y: 20,
          width: 30,
          depth: 30,
          cutDepth: 10,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
      cutoutConfig: { topOffset: 0 },
    },
  },

  // ── Export quality (finer tessellation) ──
  {
    name: 'export: 2×2 mag+lip',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
    },
    forExport: true,
  },
  {
    name: 'export: 1×1 all features',
    overrides: {
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw', stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
      label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
    },
    forExport: true,
  },

  // ── Half-sockets ──
  {
    name: 'half-sockets 2×2',
    overrides: {
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true, stackingLip: false },
    },
  },
];

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('brepkit stress test', () => {
  const results = new Map<string, KernelResults>();

  beforeAll(async () => {
    await initOcctKernel();
    await initBrepkitKernel();
    const generateBin: GenerateBinFn = await loadGenerateBin();

    for (const tc of STRESS_CASES) {
      clearAllCaches();
      const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
      const occt = withKernel('occt', () =>
        tryGenerate(generateBin, params, tc.forExport ?? false)
      );
      results.set(tc.name, { occt, brepkit: { triangleCount: 0, ms: 0 } });
    }

    for (const tc of STRESS_CASES) {
      clearAllCaches();
      const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
      const bk = withKernel('brepkit', () =>
        tryGenerate(generateBin, params, tc.forExport ?? false)
      );
      const prev = results.get(tc.name);
      if (prev) {
        results.set(tc.name, { ...prev, brepkit: bk });
      }
    }
  }, 600_000);

  for (const tc of STRESS_CASES) {
    describe(tc.name, () => {
      it('brepkit does not crash', () => {
        const r = results.get(tc.name);
        expect(r).toBeDefined();
        expect(r?.brepkit.error).toBeUndefined();
      });

      it('brepkit produces triangles', () => {
        const r = results.get(tc.name);
        expect(r).toBeDefined();
        expect(r?.brepkit.triangleCount).toBeGreaterThan(0);
      });

      it('OCCT does not crash', () => {
        const r = results.get(tc.name);
        expect(r).toBeDefined();
        expect(r?.occt.error).toBeUndefined();
      });

      it('triangle counts are within 10× of each other', () => {
        const r = results.get(tc.name);
        expect(r).toBeDefined();
        if (!r || r.occt.error || r.brepkit.error) return;
        // Different kernels tessellate differently; we just guard against
        // wildly divergent mesh density (e.g. missing faces or runaway subdivision).
        // Honeycomb pattern can hit ~5-6× due to many boolean face splits.
        const ratio = r.brepkit.triangleCount / r.occt.triangleCount;
        expect(ratio).toBeGreaterThan(0.1);
        expect(ratio).toBeLessThan(10.0);
      });
    });
  }

  it('prints stress test summary', () => {
    /* eslint-disable no-console */
    console.log(
      '\n┌───────────────────────────────────────────────────────────────────────────────────────┐'
    );
    console.log(
      '│  brepkit Stress Test Summary                                                          │'
    );
    console.log(
      '├──────────────────────────────────────────────┬─────────┬─────────┬─────────┬──────────┤'
    );
    console.log(
      '│ Scenario                                     │ OCCT ms │  BK ms  │  OCCT △ │   BK △   │'
    );
    console.log(
      '├──────────────────────────────────────────────┼─────────┼─────────┼─────────┼──────────┤'
    );

    let occtFails = 0;
    let bkFails = 0;
    let bkSlower = 0;

    for (const tc of STRESS_CASES) {
      const r = results.get(tc.name);
      if (!r) continue;
      const occtStr = r.occt.error ? 'FAIL' : `${r.occt.ms.toFixed(0)}ms`;
      const bkStr = r.brepkit.error ? 'FAIL' : `${r.brepkit.ms.toFixed(0)}ms`;
      const occtTri = r.occt.error ? 'ERR' : String(r.occt.triangleCount);
      const bkTri = r.brepkit.error ? 'ERR' : String(r.brepkit.triangleCount);

      if (r.occt.error) occtFails++;
      if (r.brepkit.error) bkFails++;
      if (!r.occt.error && !r.brepkit.error && r.brepkit.ms > r.occt.ms * 1.1) bkSlower++;

      let flag = '';
      if (r.brepkit.error) {
        flag = ' ❌';
      } else if (!r.occt.error) {
        const ratio = r.brepkit.triangleCount / r.occt.triangleCount;
        if (ratio < 0.1 || ratio > 10.0) flag = ' ⚠️';
      }

      console.log(
        `│ ${(tc.name + flag).padEnd(44)} │ ${occtStr.padStart(7)} │ ${bkStr.padStart(7)} │ ${occtTri.padStart(7)} │ ${bkTri.padStart(8)} │`
      );
    }

    console.log(
      '├──────────────────────────────────────────────┴─────────┴─────────┴─────────┴──────────┤'
    );
    console.log(
      `│  OCCT failures: ${occtFails}  │  brepkit failures: ${bkFails}  │  brepkit slower: ${bkSlower}/${STRESS_CASES.length}`.padEnd(
        89
      ) + '│'
    );
    console.log(
      '└─────────────────────────────────────────────────────────────────────────────────────────┘'
    );
    // Fail the test if brepkit has any crashes that OCCT doesn't
    const brepkitOnlyFailures = STRESS_CASES.filter((tc) => {
      const r = results.get(tc.name);
      return r?.brepkit.error && !r.occt.error;
    });
    if (brepkitOnlyFailures.length > 0) {
      console.log('\n❌ brepkit-only failures:');
      for (const tc of brepkitOnlyFailures) {
        const r = results.get(tc.name);
        if (r) {
          console.log(`  ${tc.name}: ${r.brepkit.error}`);
        }
      }
    }
    /* eslint-enable no-console */
    expect(brepkitOnlyFailures).toHaveLength(0);
  });
});
