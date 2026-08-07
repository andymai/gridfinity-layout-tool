import { describe, it, expect } from 'vitest';
import {
  encodeMeshData,
  decodeMeshData,
  bytesToBase64,
  hasOversizedMeshAsset,
  MAX_MESH_ASSET_DATA_LENGTH,
  MAX_MESH_ASSETS_PER_DESIGN,
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

    const decoded = unwrap(await decodeMeshData(encoded));
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
    const decoded = unwrap(await decodeMeshData(unwrap(await encodeMeshData(positions, indices))));
    for (let i = 0; i < positions.length; i++) {
      expect(Math.abs(decoded.positions[i] - positions[i])).toBeLessThan(0.01);
    }
  });

  it('handles a degenerate flat axis (zero extent) without NaN', async () => {
    const positions = new Float32Array([0, 0, 5, 10, 0, 5, 0, 10, 5]);
    const indices = new Uint32Array([0, 1, 2]);
    const decoded = unwrap(await decodeMeshData(unwrap(await encodeMeshData(positions, indices))));
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

  it('rejects out-of-range indices on encode', async () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const result = await encodeMeshData(positions, new Uint32Array([0, 1, 9]));
    expect(isErr(result)).toBe(true);
  });

  it('rejects corrupt base64 on decode', async () => {
    const result = await decodeMeshData('definitely-not-an-asset!!');
    expect(isErr(result)).toBe(true);
  });

  it('rejects a valid deflate stream with a wrong magic', async () => {
    // Deflate arbitrary bytes so decompression succeeds but the header check fails
    const junk = new Uint8Array(64);
    const stream = new Blob([junk]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = '';
    for (const byte of compressed) binary += String.fromCharCode(byte);
    const result = await decodeMeshData(btoa(binary));
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
    const result = await decodeMeshData(bomb);
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
    expect(isOk(await decodeMeshData(encoded))).toBe(true);
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

  it('flags more assets than a design may carry', () => {
    const meshAssets = Object.fromEntries(
      Array.from({ length: MAX_MESH_ASSETS_PER_DESIGN + 1 }, (_, i) => [`a${i}`, asset(10)])
    );
    expect(hasOversizedMeshAsset({ meshAssets })).toBe(true);
  });

  it('tolerates params with no assets or a malformed shape', () => {
    expect(hasOversizedMeshAsset(undefined)).toBe(false);
    expect(hasOversizedMeshAsset(null)).toBe(false);
    expect(hasOversizedMeshAsset({})).toBe(false);
    expect(hasOversizedMeshAsset({ meshAssets: 'nope' })).toBe(false);
    expect(hasOversizedMeshAsset({ meshAssets: { a: null } })).toBe(false);
  });
});
