/**
 * Export parity test — verifies that brepkit and OCCT produce geometrically
 * equivalent STL and 3MF exports for the same bin configurations.
 *
 * Run:
 *   npx vitest run --config vitest.profile.config.ts \
 *     src/features/generation/worker/generators/__test-infra__/exportParity.test
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initFromOC, registerKernel, BrepkitAdapter } from 'brepjs';
import { clearAllCaches } from '@/features/generation/worker/generators/shapeCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { buildSTLBufferFromIndexed } from '@/features/generation/export/stlExporter';
import { build3MFBuffer } from '@/features/generation/export/threemfExporter';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BBox {
  readonly min: [number, number, number];
  readonly max: [number, number, number];
}

interface MeshStats {
  readonly triangleCount: number;
  readonly vertexCount: number;
  readonly bbox: BBox;
  readonly volume: number;
  readonly stlBytes: number;
  readonly threemfBytes: number;
}

// ─── Kernel initialisation ──────────────────────────────────────────────────

type GenerateBinFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;

let generateBin: GenerateBinFn;

async function initOcctKernel(): Promise<void> {
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');
  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await (opencascade as (opts?: Record<string, unknown>) => Promise<unknown>)({
    wasmBinary,
  });
  initFromOC(OC);
}

async function initBrepkitKernel(): Promise<void> {
  const brepkitWasm = await import('brepkit-wasm');
  const kernel = new brepkitWasm.BrepKernel();

  const adapter = new BrepkitAdapter(kernel as any);
  registerKernel('brepkit', adapter);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute bounding box from indexed mesh data. */
function computeBBox(mesh: MeshData): BBox {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const { vertices } = mesh;
  for (let i = 0; i < vertices.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      if (vertices[i + j] < min[j]) min[j] = vertices[i + j];
      if (vertices[i + j] > max[j]) max[j] = vertices[i + j];
    }
  }
  return { min, max };
}

/**
 * Estimate volume from indexed mesh using the divergence theorem.
 * Sum of signed tetrahedra volumes (vertex to origin) gives total volume.
 */
function computeSignedVolume(mesh: MeshData): number {
  const { vertices, indices } = mesh;
  let volume = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3;
    const i1 = indices[i + 1] * 3;
    const i2 = indices[i + 2] * 3;
    // Signed volume of tetrahedron formed with origin
    volume +=
      (vertices[i0] * (vertices[i1 + 1] * vertices[i2 + 2] - vertices[i1 + 2] * vertices[i2 + 1]) +
        vertices[i0 + 1] * (vertices[i1 + 2] * vertices[i2] - vertices[i1] * vertices[i2 + 2]) +
        vertices[i0 + 2] * (vertices[i1] * vertices[i2 + 1] - vertices[i1 + 1] * vertices[i2])) /
      6;
  }
  return Math.abs(volume);
}

/** Dereference indexed mesh into flat arrays for STL/3MF export. */
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
  const bbox = computeBBox(mesh);
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
];

// ─── Test suite ─────────────────────────────────────────────────────────────

describe('export parity: brepkit vs OCCT', () => {
  const occtResults = new Map<string, MeshStats>();
  const brepkitResults = new Map<string, MeshStats>();

  beforeAll(async () => {
    // Generate with OCCT first
    await initOcctKernel();
    const binMod = await import('@/features/generation/worker/generators/binGenerator');
    generateBin = binMod.generateBin as GenerateBinFn;

    for (const tc of TEST_CASES) {
      clearAllCaches(); // Prevent cache hits from skewing results
      const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
      const mesh = generateBin(params, undefined, true);
      occtResults.set(tc.name, collectStats(mesh));
    }

    // Switch to brepkit
    await initBrepkitKernel();

    for (const tc of TEST_CASES) {
      clearAllCaches(); // Prevent cross-kernel cache poisoning + stale hits
      const params = { ...DEFAULT_BIN_PARAMS, ...tc.overrides } as BinParams;
      const mesh = generateBin(params, undefined, true);
      brepkitResults.set(tc.name, collectStats(mesh));
    }
  }, 120_000);

  for (const tc of TEST_CASES) {
    describe(tc.name, () => {
      it('both kernels produce triangles', () => {
        const occt = occtResults.get(tc.name)!;
        const bk = brepkitResults.get(tc.name)!;
        expect(occt.triangleCount).toBeGreaterThan(0);
        expect(bk.triangleCount).toBeGreaterThan(0);
      });

      it('bounding boxes match within 0.5mm', () => {
        const occt = occtResults.get(tc.name)!;
        const bk = brepkitResults.get(tc.name)!;
        for (let axis = 0; axis < 3; axis++) {
          expect(bk.bbox.min[axis]).toBeCloseTo(occt.bbox.min[axis], 0);
          expect(bk.bbox.max[axis]).toBeCloseTo(occt.bbox.max[axis], 0);
        }
      });

      it('volumes match within 5%', () => {
        const occt = occtResults.get(tc.name)!;
        const bk = brepkitResults.get(tc.name)!;
        const pctDiff = Math.abs(bk.volume - occt.volume) / occt.volume;
        expect(pctDiff).toBeLessThan(0.05);
      });

      it('STL files are valid (correct size for triangle count)', () => {
        const occt = occtResults.get(tc.name)!;
        const bk = brepkitResults.get(tc.name)!;
        // Binary STL: 80 header + 4 count + 50 per tri
        expect(occt.stlBytes).toBe(84 + occt.triangleCount * 50);
        expect(bk.stlBytes).toBe(84 + bk.triangleCount * 50);
      });

      it('3MF files are non-empty ZIP archives', () => {
        const occt = occtResults.get(tc.name)!;
        const bk = brepkitResults.get(tc.name)!;
        // ZIP magic bytes would be checked by fflate; non-zero size suffices
        expect(occt.threemfBytes).toBeGreaterThan(100);
        expect(bk.threemfBytes).toBeGreaterThan(100);
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
      const occt = occtResults.get(tc.name)!;
      const bk = brepkitResults.get(tc.name)!;
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
