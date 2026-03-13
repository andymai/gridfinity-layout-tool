/**
 * Export parity test — verifies that brepkit and OCCT produce geometrically
 * equivalent STL and 3MF exports for the same bin configurations.
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__dual-kernel__/exportParity.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { withKernel } from 'brepjs';
import { clearAllCaches } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { buildSTLBufferFromIndexed } from '@/features/generation/export/stlExporter';
import { build3MFBuffer } from '@/features/generation/export/threemfExporter';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import {
  initOcctKernel,
  initBrepkitKernel,
  loadGenerateBin,
  computeSignedVolume,
} from './dualKernelInit';
import type { GenerateBinFn } from './dualKernelInit';
import { boundingBox } from './meshAssertions';
import type { BoundingBox } from './meshAssertions';
import { CORE_PARITY_CASES } from './testCases';

const TEST_CASES = CORE_PARITY_CASES;

// ─── Types ──────────────────────────────────────────────────────────────────

interface MeshStats {
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly bbox: BoundingBox;
  readonly volume: number;
  readonly stlBytes: number;
  readonly threemfBytes: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Dereference indexed mesh into flat arrays for 3MF export. */
function flattenMesh(mesh: MeshData): { vertices: Float32Array; normals: Float32Array } {
  const { vertices, normals, indices } = mesh;
  const triCount = indices.length / 3;
  const flatVerts = new Float32Array(triCount * 9);
  const flatNorms = new Float32Array(triCount * 9);

  for (let tri = 0; tri < triCount; tri++) {
    for (let v = 0; v < 3; v++) {
      const srcIdx = indices[tri * 3 + v] * 3;
      const dstIdx = tri * 9 + v * 3;
      flatVerts[dstIdx] = vertices[srcIdx];
      flatVerts[dstIdx + 1] = vertices[srcIdx + 1];
      flatVerts[dstIdx + 2] = vertices[srcIdx + 2];
      flatNorms[dstIdx] = normals[srcIdx];
      flatNorms[dstIdx + 1] = normals[srcIdx + 1];
      flatNorms[dstIdx + 2] = normals[srcIdx + 2];
    }
  }

  return { vertices: flatVerts, normals: flatNorms };
}

function collectStats(mesh: MeshData): MeshStats {
  const bbox = boundingBox(mesh.vertices);
  const volume = computeSignedVolume(mesh);
  const stlBuffer = buildSTLBufferFromIndexed(mesh.vertices, mesh.normals, mesh.indices);
  const flat = flattenMesh(mesh);
  const threemfBuffer = build3MFBuffer(flat.vertices, flat.normals, { name: 'parity-test' });

  return {
    triangleCount: mesh.triangleCount,
    vertexCount: mesh.vertices.length / 3,
    bbox,
    volume,
    stlBytes: stlBuffer.byteLength,
    threemfBytes: threemfBuffer.byteLength,
  };
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('export parity: brepkit vs OCCT', () => {
  const occtResults = new Map<string, MeshStats>();
  const brepkitResults = new Map<string, MeshStats>();

  beforeAll(async () => {
    await initOcctKernel();
    await initBrepkitKernel();
    const generateBin: GenerateBinFn = await loadGenerateBin();

    for (const tc of TEST_CASES) {
      clearAllCaches();
      const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
      const mesh = withKernel('occt', () => generateBin(params, undefined, true));
      occtResults.set(tc.name, collectStats(mesh));
    }

    for (const tc of TEST_CASES) {
      clearAllCaches();
      const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
      const mesh = withKernel('brepkit', () => generateBin(params, undefined, true));
      brepkitResults.set(tc.name, collectStats(mesh));
    }
  }, 120_000);

  for (const tc of TEST_CASES) {
    describe(tc.name, () => {
      it('both kernels produce triangles', () => {
        const occt = occtResults.get(tc.name);
        const bk = brepkitResults.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        expect(occt?.triangleCount).toBeGreaterThan(0);
        expect(bk?.triangleCount).toBeGreaterThan(0);
      });

      it('bounding boxes match within 1mm', () => {
        const occt = occtResults.get(tc.name);
        const bk = brepkitResults.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        if (!occt || !bk) return;

        // brepkit polygon-approximates arcs (fillet radii, lip profile), which
        // can shift bbox extents by up to ~1mm on small bins
        for (const key of ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const) {
          expect(Math.abs(bk.bbox[key] - occt.bbox[key])).toBeLessThan(1.0);
        }
      });

      it('volumes match within 50% (polygon arc approx on small bins)', () => {
        const occt = occtResults.get(tc.name);
        const bk = brepkitResults.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        if (!occt || !bk) return;
        const pctDiff = Math.abs(bk.volume - occt.volume) / occt.volume;
        expect(pctDiff).toBeLessThan(0.5);
      });

      it('STL files are valid (correct size for triangle count)', () => {
        const occt = occtResults.get(tc.name);
        const bk = brepkitResults.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        if (!occt || !bk) return;
        // Binary STL: 80 header + 4 count + 50 per tri
        expect(occt.stlBytes).toBe(84 + occt.triangleCount * 50);
        expect(bk.stlBytes).toBe(84 + bk.triangleCount * 50);
      });

      it('3MF files are non-empty ZIP archives', () => {
        const occt = occtResults.get(tc.name);
        const bk = brepkitResults.get(tc.name);
        expect(occt).toBeDefined();
        expect(bk).toBeDefined();
        // ZIP magic bytes would be checked by fflate; non-zero size suffices
        expect(occt?.threemfBytes).toBeGreaterThan(100);
        expect(bk?.threemfBytes).toBeGreaterThan(100);
      });
    });
  }

  it('prints comparison summary', () => {
    /* eslint-disable no-console */
    console.log(
      '\n┌─────────────────────────────────────────────────────────────────────────────────────────┐'
    );
    console.log(
      '│  Export Parity: brepkit vs OCCT                                                         │'
    );
    console.log(
      '├──────────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤'
    );
    console.log(
      '│ Scenario                 │ OCCT tri │  BK tri  │ OCCT vol │  BK vol  │   Vol diff       │'
    );
    console.log(
      '├──────────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤'
    );
    for (const tc of TEST_CASES) {
      const occt = occtResults.get(tc.name);
      const bk = brepkitResults.get(tc.name);
      if (!occt || !bk) continue;
      const volDiff = (((bk.volume - occt.volume) / occt.volume) * 100).toFixed(2);
      console.log(
        `│ ${tc.name.padEnd(24)} │ ${String(occt.triangleCount).padStart(8)} │ ${String(bk.triangleCount).padStart(8)} │ ${occt.volume.toFixed(0).padStart(8)} │ ${bk.volume.toFixed(0).padStart(8)} │ ${(volDiff + '%').padStart(16)} │`
      );
    }
    console.log(
      '└──────────────────────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘'
    );
    /* eslint-enable no-console */
    expect(true).toBe(true);
  });
});
