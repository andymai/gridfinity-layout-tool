// @vitest-environment node
/**
 * Manifold-KERNEL (draft preview) manifoldness of LIPPED bins (issue #2074).
 *
 * The exact occt path builds the stacking lip as a separate solid and fuses it
 * onto the body; occt's General Fuse dissolves the coincident outer-wall faces.
 * The Manifold mesh-CSG kernel does NOT — it leaves both coincident surfaces, so
 * the fused draft has edges shared by >2 triangles (z-fighting) along the
 * ~2.7mm-tall wall↔lip overlap at the rounded corners. Measured pre-fix:
 * rectangular ≈ 51, L-shape ≈ 244 non-manifold edges (boundary edges 0 — it's
 * coincident-face flicker, not holes).
 *
 * shellStage now builds the body+lip as a single fuse-free solid on build-time
 * (mesh) kernels, so the draft is free of those coincident faces. This guard
 * meshes the draft on the pinned Manifold kernel and asserts the non-manifold
 * edge count stays at the lipless baseline (≈0).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { MASK_CELLS_PER_UNIT, type CellMask } from '@/shared/utils/cellMask';
import { initManifoldKernel } from './__kernel-tests__/kernelInit';
import { generateBin } from './binGenerator';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initManifoldKernel();
}, 30000);

interface EdgeStats {
  triangleCount: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
}

/**
 * Count non-manifold (shared by >2 triangles) and boundary (shared by 1) edges
 * in an indexed mesh. Keys edges by QUANTIZED POSITION, not vertex index —
 * coincident faces carry distinct vertices at the same spot, so only a position
 * key exposes the >2 sharing a fuse would leave behind.
 */
function analyzeMesh(vertices: Float32Array, indices: Uint32Array): EdgeStats {
  const Q = 1e3; // 0.001mm — below tessellation noise, above float jitter
  const vKey = (i: number): string => {
    const b = i * 3;
    return `${Math.round(vertices[b] * Q)},${Math.round(vertices[b + 1] * Q)},${Math.round(
      vertices[b + 2] * Q
    )}`;
  };
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  const triangleCount = indices.length / 3;
  for (let t = 0; t < triangleCount; t++) {
    const k = [vKey(indices[t * 3]), vKey(indices[t * 3 + 1]), vKey(indices[t * 3 + 2])];
    for (let i = 0; i < 3; i++) {
      const e = eKey(k[i], k[(i + 1) % 3]);
      edgeCount.set(e, (edgeCount.get(e) ?? 0) + 1);
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

describe('Manifold draft — lipped bins are coincidence-free (no fuse z-fighting)', () => {
  const TIMEOUT = 60_000;

  // Flat base → no socket, so generateBin's preview mesh is the body+lip shell
  // alone. (The deferred base socket is concatenated as a separate mesh whose
  // hidden interface with the body is coincident by design — it would mask the
  // lip signal this guard is about.)
  function statsFor(params: BinParams, lip: boolean): EdgeStats {
    clearAllCaches();
    const mesh = generateBin({
      ...params,
      base: { ...params.base, style: 'flat', solid: false, stackingLip: lip },
    });
    return analyzeMesh(mesh.vertices, mesh.indices);
  }

  function expectLipAddsNoCoincidence(params: BinParams, slack: number): void {
    const base = statsFor(params, false);
    const lipped = statsFor(params, true);
    expect(base.boundaryEdges, 'lipless shell is watertight').toBe(0);
    expect(lipped.boundaryEdges, 'lipped shell is watertight').toBe(0);
    expect(
      lipped.nonManifoldEdges,
      `lipped non-manifold edges ${lipped.nonManifoldEdges} (lipless baseline ${base.nonManifoldEdges})`
    ).toBeLessThanOrEqual(base.nonManifoldEdges + slack);
  }

  it(
    'a rectangular lipped bin has no non-manifold edges (was ~51)',
    () => {
      expectLipAddsNoCoincidence({ ...DEFAULT_BIN_PARAMS, width: 2, depth: 2 }, 2);
    },
    TIMEOUT
  );

  it(
    'a thick-walled lipped bin has no non-manifold edges',
    () => {
      expectLipAddsNoCoincidence(
        { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, wallThickness: 2.4 },
        2
      );
    },
    TIMEOUT
  );

  it(
    'a non-square bin with a small Y pitch stays watertight (corner radius capped)',
    () => {
      // gridUnitMmY = 7 makes outerD = 1·7 − 0.5 = 6.5mm, below 2·BOX_CORNER_RADIUS
      // (7.5mm). Without capping the corner radius the rounded-rect sketch is
      // degenerate and the kernel can emit a torn (non-watertight) shell.
      expectLipAddsNoCoincidence({ ...DEFAULT_BIN_PARAMS, width: 2, depth: 1, gridUnitMmY: 7 }, 2);
    },
    TIMEOUT
  );

  it(
    'an L-shaped (polygon) lipped bin has no non-manifold edges (was ~244)',
    () => {
      // 2×2 with the top-right quadrant cleared = an L footprint (no hole).
      const cols = 2 * MASK_CELLS_PER_UNIT;
      const rows = 2 * MASK_CELLS_PER_UNIT;
      const cells = new Array<0 | 1>(cols * rows).fill(1);
      const cutW = Math.floor(cols / 2);
      const cutD = Math.floor(rows / 2);
      for (let r = 0; r < cutD; r++) {
        for (let c = cols - cutW; c < cols; c++) cells[r * cols + c] = 0;
      }
      const cellMask: CellMask = { cols, rows, cells };
      expectLipAddsNoCoincidence({ ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, cellMask }, 4);
    },
    TIMEOUT
  );
});
