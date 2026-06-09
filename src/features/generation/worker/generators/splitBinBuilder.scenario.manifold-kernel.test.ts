// @vitest-environment node
/**
 * Manifold-KERNEL (draft preview) edge fidelity for split-bin pieces.
 *
 * The bin designer's split preview runs on the Manifold mesh-CSG kernel, which
 * has no B-rep topology — so `meshEdges()` returns the FULL triangle wireframe
 * (~1.5 edges per triangle), not feature edges. Rendered, that paints every
 * facet of the freshly-cut faces and curved socket walls as wireframe noise.
 *
 * `tessellatePiece` recovers clean feature edges via dihedral crease detection
 * for build-time kernels (mirroring the whole-bin `tessellateStage`). This
 * guard asserts the recovered edge set is feature edges — far fewer segments
 * than a full wireframe — so a regression back to `meshEdges()` is caught.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_SPLIT_CONNECTOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import { initManifoldKernel } from './__kernel-tests__/kernelInit';
import { generateSplitPreview } from './binGenerator';
import { clearAllCaches } from './shapeCache';

beforeAll(async () => {
  await initManifoldKernel();
}, 30000);

describe('Manifold split draft — pieces render feature edges, not full wireframe', () => {
  const TIMEOUT = 60_000;

  function check(label: string, params: BinParams): void {
    clearAllCaches();
    const res = generateSplitPreview(params, [0], [], DEFAULT_SPLIT_CONNECTOR_CONFIG);
    expect(res.pieces.length, `${label}: two pieces`).toBe(2);
    for (const piece of res.pieces) {
      const edgeSegments = piece.edgeVertices.length / 6;
      const triangleCount = piece.indices.length / 3;
      expect(edgeSegments, `${label}/${piece.label}: has edges`).toBeGreaterThan(0);
      // A full triangle wireframe has ~1.5 edge segments per triangle. Feature
      // edges are a small fraction of that. Assert well under 1.0× triangles —
      // the pre-fix meshEdges() wireframe was ~1.5× (and failed this).
      expect(
        edgeSegments,
        `${label}/${piece.label}: feature edges (${edgeSegments}), not full wireframe (~${Math.round(
          triangleCount * 1.5
        )})`
      ).toBeLessThan(triangleCount);
    }
  }

  it(
    'a plain 4×2 bin split along X has clean piece edges',
    () => {
      check('4×2 plain', { ...DEFAULT_BIN_PARAMS, width: 4, depth: 2 });
    },
    TIMEOUT
  );

  it(
    'a 4×2 bin with compartments split along X has clean piece edges',
    () => {
      check('4×2 +comp', {
        ...DEFAULT_BIN_PARAMS,
        width: 4,
        depth: 2,
        compartments: { cols: 4, rows: 2, cells: [0, 1, 2, 3, 4, 5, 6, 7], thickness: 1.2 },
      });
    },
    TIMEOUT
  );
});
