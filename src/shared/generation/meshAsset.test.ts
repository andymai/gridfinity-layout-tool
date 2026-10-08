import { describe, it, expect } from 'vitest';
import {
  encodeMeshData,
  decodeMeshData,
  bytesToBase64,
  hasOversizedMeshAsset,
  meshTrianglesTotal,
  MAX_MESH_ASSET_DATA_LENGTH,
  MAX_MESH_ASSET_TRIANGLES,
  MAX_MESH_TRIANGLES_PER_DESIGN,
  MAX_DECODED_MESH_BYTES,
} from './meshAsset';
import { isOk, isErr, unwrap } from '@/core/result';

/** A unit tetrahedron scaled to tool-ish dimensions (mm). */
function tetrahedron(scale = 40): { positions: Float32Array; indices: Uint32Array } {
  const positions = new Float32Array([0, 0, 0, scale, 0, 0, 0, scale, 0, 0, 0, scale]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return { positions, indices };
}

describe('meshAsset codec', () => {
  it('round-trips positions within quantization tolerance', async () => {
    const { positions, indices } = tetrahedron();
    const encoded = unwrap(await encodeMeshData(positions, indices));
    expect(typeof encoded).toBe('string');

    const decoded = unwrap(await decodeMeshData(encoded, 4));
    expect(decoded.indices).toEqual(indices);
    expect(decoded.positions).toHaveLength(positions.length);
    // 40mm extent / 65535 steps ≈ 0.0006mm resolution; assert well within 0.01mm
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(decoded.positions[i] - positions[i])).toBeLessThan(0.01);
    }
  });

  it('round-trips negative and offset coordinates', async () => {
    const positions = new Float32Array([-12.5, -3.25, 7.75, 30.5, -3.25, 7.75, -12.5, 44, 100.125]);
    const indices = new Uint32Array([0, 1, 2]);
    const decoded = unwrap(
      await decodeMeshData(unwrap(await encodeMeshData(positions, indices)), 1)
    );
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(decoded.positions[i] - positions[i])).toBeLessThan(0.01);
    }
  });

  it('handles a degenerate flat axis (zero extent) without NaN', async () => {
    const positions = new Float32Array([0, 0, 5, 10, 0, 5, 0, 10, 5]);
    const indices = new Uint32Array([0, 1, 2]);
    const decoded = unwrap(
      await decodeMeshData(unwrap(await encodeMeshData(positions, indices)), 1)
    );
    expect(decoded.positions[2]).toBeCloseTo(5);
    expect(decoded.positions[5]).toBeCloseTo(5);
    expect(Array.from(decoded.positions).every(Number.isFinite)).toBe(true);
  });

  it('rejects empty arrays', async () => {
    const result = await encodeMeshData(new Float32Array(0), new Uint32Array(0));
    expect(isErr(result)).toBe(true);
  });

  it('rejects non-finite positions', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, NaN, 0]);
    const result = await encodeMeshData(positions, new Uint32Array([0, 1, 2]));
    expect(isErr(result)).toBe(true);
  });

  it('rejects more vertices than its triangles can use', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]);
    const result = await encodeMeshData(positions, new Uint32Array([0, 1, 2]));
    expect(isErr(result)).toBe(true);
  });

  it('round-trips a triangle soup at 3 vertices per triangle', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]);
    const encoded = unwrap(await encodeMeshData(positions, new Uint32Array([0, 1, 2, 3, 4, 5])));
    expect(isOk(await decodeMeshData(encoded, 2))).toBe(true);
  });

  it('rejects out-of-range indices on encode', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const result = await encodeMeshData(positions, new Uint32Array([0, 1, 9]));
    expect(isErr(result)).toBe(true);
  });

  it('rejects corrupt base64 on decode', async () => {
    const result = await decodeMeshData('definitely-not-an-asset!!', 1);
    expect(isErr(result)).toBe(true);
  });

  it('rejects a valid deflate stream with a wrong magic', async () => {
    // Deflate arbitrary bytes so decompression succeeds but the header check fails
    const junk = new Uint8Array(64);
    const stream = new Blob([junk]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (const byte of compressed) binary += String.fromCharCode(byte);
    const result = await decodeMeshData(btoa(binary), 1);
    expect(isErr(result)).toBe(true);
  });

  it('compresses a repetitive mesh well below raw size', async () => {
    // A grid of identical quads: 800 triangles with heavy structural repetition
    const cols = 20;
    const rows = 20;
    const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
    for (let y = 0; y <= rows; y++) {
      for (let x = 0; x <= cols; x++) {
        const i = (y * (cols + 1) + x) * 3;
        positions[i] = x * 2;
        positions[i + 1] = y * 2;
        positions[i + 2] = 0;
      }
    }
    const indexList: number[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const a = y * (cols + 1) + x;
        const b = a + 1;
        const c = a + (cols + 1);
        const d = c + 1;
        indexList.push(a, b, c, b, d, c);
      }
    }
    const indices = Uint32Array.from(indexList);

    const result = await encodeMeshData(positions, indices);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    const rawBytes = positions.byteLength + indices.byteLength;
    // base64 inflates by 4/3; still expect a large net win on structured data
    expect(result.value.length).toBeLessThan(rawBytes / 2);
  });
});

describe('declared triangle count', () => {
  it('rejects geometry with more triangles than the design declares', async () => {
    const { positions, indices } = tetrahedron();
    const encoded = unwrap(await encodeMeshData(positions, indices));
    expect(isErr(await decodeMeshData(encoded, 3))).toBe(true);
    expect(isOk(await decodeMeshData(encoded, 4))).toBe(true);
  });

  it('stops inflating at what the declared count can occupy', async () => {
    const positions = new Float32Array(3000);
    for (let i = 0; i < positions.length; i++) positions[i] = (i * 7919) % 101;
    const indices = Uint32Array.from({ length: 3000 }, (_, i) => (i * 13) % 1000);
    const encoded = unwrap(await encodeMeshData(positions, indices));
    expect(isOk(await decodeMeshData(encoded, 1000))).toBe(true);
    const refused = await decodeMeshData(encoded, 1);
    expect(isErr(refused) && 'errors' in refused.error && refused.error.errors).toEqual([
      'Mesh decode failed: corrupt asset data',
    ]);
  });

  it.each([0, -1, 1.5, Number.NaN, MAX_MESH_ASSET_TRIANGLES + 1])(
    'rejects a declared count of %s',
    async (declared) => {
      const { positions, indices } = tetrahedron();
      const encoded = unwrap(await encodeMeshData(positions, indices));
      expect(isErr(await decodeMeshData(encoded, declared))).toBe(true);
    }
  );
});

/**
 * decodeMeshData's structural checks all run on the fully decompressed buffer,
 * so on their own they cannot stop a deflate bomb: peak memory is already the
 * whole decompressed size by the time the first one executes.
 */
describe('decompression ceiling', () => {
  /** A highly compressible payload that inflates well past the ceiling. */
  async function deflateBomb(bytes: number): Promise<string> {
    const zeros = new Uint8Array(bytes);
    const stream = new Blob([zeros as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream('deflate'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return bytesToBase64(compressed);
  }

  it('rejects a payload that inflates past the ceiling', async () => {
    const bomb = await deflateBomb(MAX_DECODED_MESH_BYTES + 1_000_000);
    const result = await decodeMeshData(bomb, MAX_MESH_ASSET_TRIANGLES);
    expect(isErr(result)).toBe(true);
  });

  it('compresses to a tiny fraction of what it inflates to', async () => {
    // Confirms the test payload really is a bomb: a small input that the
    // pre-fix code would have expanded into memory in full.
    const bomb = await deflateBomb(MAX_DECODED_MESH_BYTES + 1_000_000);
    expect(bomb.length).toBeLessThan(MAX_DECODED_MESH_BYTES / 100);
  });

  it('still decodes a legitimate asset', async () => {
    const { positions, indices } = tetrahedron();
    const encoded = unwrap(await encodeMeshData(positions, indices));
    expect(isOk(await decodeMeshData(encoded, 4))).toBe(true);
  });
});

describe('meshTrianglesTotal', () => {
  it('sums declared triangles across inline assets and refs', () => {
    const outlines = [[{ x: 0, y: 0 }]];
    const sizeMm = { x: 1, y: 1, z: 1 };
    expect(
      meshTrianglesTotal({
        a: { name: 'a', data: 'A', triangleCount: 100, sizeMm, outlines },
        b: { name: 'b', hash: 'f'.repeat(64), triangleCount: 250, sizeMm, bytes: 900 },
      })
    ).toBe(350);
    expect(meshTrianglesTotal(undefined)).toBe(0);
  });
});

describe('hasOversizedMeshAsset', () => {
  const asset = (dataLength: number) => ({ data: 'A'.repeat(dataLength) });

  it('accepts an asset within the budget', () => {
    expect(hasOversizedMeshAsset({ meshAssets: { a: asset(1000) } })).toBe(false);
  });

  it('flags an asset over the per-asset data cap', () => {
    expect(
      hasOversizedMeshAsset({ meshAssets: { a: asset(MAX_MESH_ASSET_DATA_LENGTH + 1) } })
    ).toBe(true);
  });

  it('flags assets that declare more triangles than a design may carry', () => {
    const declaring = (triangleCount: number) => ({ data: 'A', triangleCount });
    const atBudget = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`a${i}`, declaring(MAX_MESH_TRIANGLES_PER_DESIGN / 8)])
    );
    expect(hasOversizedMeshAsset({ meshAssets: atBudget })).toBe(false);
    expect(hasOversizedMeshAsset({ meshAssets: { ...atBudget, extra: declaring(1) } })).toBe(true);
  });

  it('lets no declaration the decoder refuses offset the budget', () => {
    const declaring = (triangleCount: number) => ({ data: 'A', triangleCount });
    const meshAssets = {
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`a${i}`, declaring(MAX_MESH_ASSET_TRIANGLES)])
      ),
      negative: declaring(-MAX_MESH_ASSET_TRIANGLES),
      fraction: declaring(-0.5),
    };
    expect(hasOversizedMeshAsset({ meshAssets })).toBe(true);
  });

  it('carries no count cap of its own', () => {
    const meshAssets = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`a${i}`, { data: 'A', triangleCount: 12 }])
    );
    expect(hasOversizedMeshAsset({ meshAssets })).toBe(false);
  });

  it('tolerates params with no assets or a malformed shape', () => {
    expect(hasOversizedMeshAsset(undefined)).toBe(false);
    expect(hasOversizedMeshAsset(null)).toBe(false);
    expect(hasOversizedMeshAsset({})).toBe(false);
    expect(hasOversizedMeshAsset({ meshAssets: 'nope' })).toBe(false);
    expect(hasOversizedMeshAsset({ meshAssets: { a: null } })).toBe(false);
  });
});
