/**
 * Visual parity test — compares brepkit vs OCCT mesh quality metrics
 * for a 3×3 bin with scoop + label tabs + stacking lip.
 *
 * Focuses on detecting the 4 known visual issues:
 *   1. Label tab gussets not merged into wall (face artifacts)
 *   2. Excessive edge/wireframe density (meshEdges returning tessellation edges)
 *   3. Stacking lip corner over-tessellation
 *   4. Scoop-wall transition mesh artifacts
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__dual-kernel__/visualParity.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel } from 'brepjs';
import { clearAllCaches } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import {
  initOcctKernel,
  initBrepkitKernel,
  loadGenerateBin,
  computeSignedVolume,
} from './dualKernelInit';
import type { GenerateBinFn } from './dualKernelInit';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VisualMetrics {
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly edgeSegmentCount: number;
  readonly volume: number;
  readonly edgeToTriangleRatio: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectVisualMetrics(m: MeshData): VisualMetrics {
  const volume = computeSignedVolume(m);
  const edgeSegmentCount = m.edgeVertices.length / 6; // 2 vertices × 3 components per segment
  return {
    triangleCount: m.triangleCount,
    vertexCount: m.vertices.length / 3,
    edgeSegmentCount,
    volume,
    edgeToTriangleRatio: edgeSegmentCount / m.triangleCount,
  };
}

// ─── Test config ────────────────────────────────────────────────────────────

const VISUAL_PARITY_PARAMS: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 3,
  height: 3,
  scoop: { enabled: true, radius: 'auto' },
  label: { enabled: true, support: 'bracket', depth: 12, width: 100, alignment: 'left' },
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, style: 'standard' },
};

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('visual parity: brepkit vs OCCT (3×3 scoop+label+lip)', () => {
  let occtMetrics: VisualMetrics;
  let brepkitMetrics: VisualMetrics;

  beforeAll(async () => {
    await initOcctKernel();
    await initBrepkitKernel();
    const generateBin: GenerateBinFn = await loadGenerateBin();

    // Generate with OCCT
    const occtMesh = withKernel('occt', () => generateBin(VISUAL_PARITY_PARAMS));
    occtMetrics = collectVisualMetrics(occtMesh);

    // Clear shape caches to prevent cross-kernel cache poisoning
    // (OCCT handles are opaque pointers that cannot be cloned by brepkit)
    clearAllCaches();

    // Generate with brepkit
    const bkMesh = withKernel('brepkit', () => generateBin(VISUAL_PARITY_PARAMS));
    brepkitMetrics = collectVisualMetrics(bkMesh);
  }, 120_000);

  it('both kernels produce triangles', () => {
    expect(occtMetrics.triangleCount).toBeGreaterThan(0);
    expect(brepkitMetrics.triangleCount).toBeGreaterThan(0);
  });

  it('volumes match within 10% (polygon approx of arcs adds ~5-7%)', () => {
    const pctDiff = Math.abs(brepkitMetrics.volume - occtMetrics.volume) / occtMetrics.volume;
    expect(pctDiff).toBeLessThan(0.1);
  });

  // Issue #2: Excessive edge/wireframe density
  it('brepkit edge count does not exceed OCCT by >50%', () => {
    const ratio = brepkitMetrics.edgeSegmentCount / occtMetrics.edgeSegmentCount;
    expect(ratio).toBeLessThan(1.5);
  });

  // Issue #2 + #3: Over-tessellation
  it('brepkit triangle count does not exceed OCCT by >100%', () => {
    const ratio = brepkitMetrics.triangleCount / occtMetrics.triangleCount;
    expect(ratio).toBeLessThan(2.0);
  });

  // Issue #2: Edge-to-triangle ratio should be similar
  // brepkit produces fewer triangles per edge than OCCT (coarser tessellation),
  // so the ratio can reach ~2.4× on complex bins with many B-Rep edges
  it('edge-to-triangle ratios are comparable (within 3×)', () => {
    const ratio = brepkitMetrics.edgeToTriangleRatio / occtMetrics.edgeToTriangleRatio;
    expect(ratio).toBeLessThan(3.0);
  });

  it('prints comparison summary', () => {
    /* eslint-disable no-console */
    const fmt = (n: number): string => n.toFixed(0).padStart(10);
    const pct = (bk: number, occt: number): string => {
      const diff = ((bk - occt) / occt) * 100;
      const sign = diff >= 0 ? '+' : '';
      return (sign + diff.toFixed(1) + '%').padStart(10);
    };

    console.log('\n┌───────────────────────────────────────────────────────────────────┐');
    console.log('│  Visual Parity: 3×3 scoop + label tabs + lip                    │');
    console.log('├────────────────────────┬──────────┬──────────┬──────────────────┤');
    console.log('│ Metric                 │     OCCT │  brepkit │       Δ brepkit │');
    console.log('├────────────────────────┼──────────┼──────────┼──────────────────┤');

    const rows: [string, number, number][] = [
      ['Triangles', occtMetrics.triangleCount, brepkitMetrics.triangleCount],
      ['Vertices', occtMetrics.vertexCount, brepkitMetrics.vertexCount],
      ['Edge segments', occtMetrics.edgeSegmentCount, brepkitMetrics.edgeSegmentCount],
      ['Volume (mm³)', occtMetrics.volume, brepkitMetrics.volume],
      ['Edge/tri ratio', occtMetrics.edgeToTriangleRatio, brepkitMetrics.edgeToTriangleRatio],
    ];

    for (const [label, occt, bk] of rows) {
      const occtStr = label === 'Edge/tri ratio' ? occt.toFixed(3).padStart(10) : fmt(occt);
      const bkStr = label === 'Edge/tri ratio' ? bk.toFixed(3).padStart(10) : fmt(bk);
      console.log(
        `│ ${label.padEnd(22)} │ ${occtStr} │ ${bkStr} │ ${pct(bk, occt).padStart(16)} │`
      );
    }

    // Flag potential visual issues
    console.log('├────────────────────────┴──────────┴──────────┴──────────────────┤');
    const flags: string[] = [];
    const edgeRatio = brepkitMetrics.edgeSegmentCount / occtMetrics.edgeSegmentCount;
    const triRatio = brepkitMetrics.triangleCount / occtMetrics.triangleCount;

    if (edgeRatio > 1.5)
      flags.push(`⚠ Edge count ${edgeRatio.toFixed(1)}× OCCT (wireframe density)`);
    if (triRatio > 2.0)
      flags.push(`⚠ Triangle count ${triRatio.toFixed(1)}× OCCT (over-tessellation)`);
    if (flags.length === 0) flags.push('✓ All visual metrics within tolerance');

    for (const flag of flags) {
      console.log(`│  ${flag.padEnd(63)} │`);
    }
    console.log('└───────────────────────────────────────────────────────────────────┘');
    /* eslint-enable no-console */
    expect(true).toBe(true);
  });
});
