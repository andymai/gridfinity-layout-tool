import { describe, it, expect } from 'vitest';
import { unwrap } from '../../src/core/result/index.js';
import { encodeMeshData } from '../../src/shared/generation/meshAsset.js';
import { encodeMeshFile } from '../../src/shared/generation/meshFile.js';
import type { MeshFileContent } from '../../src/shared/generation/meshFile.js';
import { CONSTRAINTS } from './designerValidationConstants.js';
import {
  MAX_MESH_FILE_GEOMETRY_BYTES,
  MAX_MESH_FILE_RINGS,
  MESH_FILE_HEADER_BYTES,
  isMeshHash,
  meshBlobPath,
  meshFileHash,
  validateMeshFile,
} from './meshFile.js';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
];

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw.slice()]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

async function tetrahedron(): Promise<MeshFileContent> {
  const positions = new Float32Array([0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    outlines: [SQUARE],
  };
}

/** Raw GMA1 bytes for one triangle, before deflate, so tests can corrupt them. */
function rawTriangle(): Uint8Array {
  const raw = new Uint8Array(36 + 3 * 3 * 2 + 3 * 4);
  const view = new DataView(raw.buffer);
  view.setUint32(0, 0x314d4741, true);
  view.setUint32(4, 3, true);
  view.setUint32(8, 1, true);
  for (let axis = 0; axis < 3; axis++) view.setFloat32(24 + axis * 4, 10, true);
  view.setUint16(36 + 3 * 2, 65535, true);
  view.setUint16(36 + 7 * 2, 65535, true);
  view.setUint32(54, 0, true);
  view.setUint32(58, 1, true);
  view.setUint32(62, 2, true);
  return raw;
}

async function fileWithGeometry(compressed: Uint8Array): Promise<Uint8Array> {
  return unwrap(
    encodeMeshFile({ data: toBase64(compressed), triangleCount: 1, outlines: [SQUARE] })
  );
}

function setU32(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(offset, value, true);
  return copy;
}

function setLastF64(bytes: Uint8Array, value: number): Uint8Array {
  const copy = bytes.slice();
  new DataView(copy.buffer).setFloat64(copy.byteLength - 8, value, true);
  return copy;
}

async function errorOf(bytes: Uint8Array): Promise<string> {
  const result = await validateMeshFile(bytes);
  return result.ok ? 'ok' : result.error;
}

describe('meshFileHash', () => {
  it('is the lowercase hex SHA-256 of the bytes', () => {
    expect(meshFileHash(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

describe('isMeshHash', () => {
  it('accepts 64 lowercase hex characters only', () => {
    expect(isMeshHash('a'.repeat(64))).toBe(true);
    expect(isMeshHash('A'.repeat(64))).toBe(false);
    expect(isMeshHash('a'.repeat(63))).toBe(false);
    expect(isMeshHash('g'.repeat(64))).toBe(false);
    expect(isMeshHash(`${'a'.repeat(64)}/x`)).toBe(false);
    expect(isMeshHash(undefined)).toBe(false);
  });
});

describe('meshBlobPath', () => {
  it('stores each file under meshes/ by its hash', () => {
    expect(meshBlobPath('ab'.repeat(32))).toBe(`meshes/${'ab'.repeat(32)}`);
  });
});

describe('validateMeshFile', () => {
  it('accepts a well-formed file and reports its declared triangle count', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await validateMeshFile(file)).toEqual({ ok: true, triangleCount: 4 });
  });

  it('accepts a file declaring more triangles than its geometry holds', async () => {
    const file = unwrap(encodeMeshFile({ ...(await tetrahedron()), triangleCount: 5 }));
    expect(await validateMeshFile(file)).toEqual({ ok: true, triangleCount: 5 });
  });

  it('rejects a truncated header', async () => {
    expect(await errorOf(new Uint8Array(MESH_FILE_HEADER_BYTES - 1))).toMatch('truncated header');
  });

  it('rejects a bad magic', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, 0, 0x31414d47))).toMatch('bad magic');
  });

  it('rejects an unknown version', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, 4, 2))).toMatch('unsupported version');
  });

  it('rejects a declared triangle count over the import budget', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, 8, CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES + 1))).toMatch(
      'triangle count'
    );
  });

  it('rejects geometry holding more triangles than declared', async () => {
    const file = unwrap(encodeMeshFile({ ...(await tetrahedron()), triangleCount: 3 }));
    expect(await errorOf(file)).toMatch('more triangles than the file declares');
  });

  it('rejects a geometry length over the cap', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, 12, MAX_MESH_FILE_GEOMETRY_BYTES + 1))).toMatch(
      'geometry must be'
    );
  });

  it('rejects a ring count of zero or past the point budget', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, 16, 0))).toMatch('ring count');
    expect(await errorOf(setU32(file, 16, MAX_MESH_FILE_RINGS + 1))).toMatch('ring count');
  });

  it('rejects a ring under 3 points', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, MESH_FILE_HEADER_BYTES, 2))).toMatch('at least 3 points');
  });

  it('rejects outlines over the point budget', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setU32(file, MESH_FILE_HEADER_BYTES, 4001))).toMatch(
      'exceed 4000 total points'
    );
  });

  it('rejects a length that disagrees with the header', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    const padded = new Uint8Array(file.byteLength + 1);
    padded.set(file);
    expect(await errorOf(padded)).toMatch('size mismatch');
    expect(await errorOf(file.subarray(0, file.byteLength - 1))).toMatch('size mismatch');
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.NEGATIVE_INFINITY],
    ['out of range', -1000.5],
  ])('rejects a %s outline coordinate', async (_label, value) => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setLastF64(file, value))).toMatch('outline points must be finite');
  });

  it('rejects a -0 outline coordinate', async () => {
    const file = unwrap(encodeMeshFile(await tetrahedron()));
    expect(await errorOf(setLastF64(file, -0))).toMatch('-0');
  });

  describe('geometry', () => {
    it('accepts a hand-built one-triangle mesh', async () => {
      expect(await errorOf(await fileWithGeometry(await deflate(rawTriangle())))).toBe('ok');
    });

    it('rejects bytes that are not a deflate stream', async () => {
      expect(await errorOf(await fileWithGeometry(new Uint8Array([1, 2, 3, 4])))).toMatch(
        'corrupt geometry'
      );
    });

    it('rejects junk after the end of the deflate stream', async () => {
      const compressed = await deflate(rawTriangle());
      const padded = new Uint8Array(compressed.byteLength + 3);
      padded.set(compressed);
      expect(await errorOf(await fileWithGeometry(padded))).toMatch('corrupt geometry');
    });

    it('rejects a deflate bomb before inflating it in full', async () => {
      const bomb = await deflate(new Uint8Array(20_000_000));
      expect(bomb.byteLength).toBeLessThan(MAX_MESH_FILE_GEOMETRY_BYTES);
      expect(await errorOf(await fileWithGeometry(bomb))).toMatch('corrupt geometry');
    });

    it('rejects a bad geometry magic', async () => {
      const raw = setU32(rawTriangle(), 0, 0);
      expect(await errorOf(await fileWithGeometry(await deflate(raw)))).toMatch(
        'bad geometry magic'
      );
    });

    it('rejects geometry whose counts disagree with its length', async () => {
      const raw = setU32(rawTriangle(), 8, 2);
      expect(await errorOf(await fileWithGeometry(await deflate(raw)))).toMatch(
        'geometry size mismatch'
      );
    });

    it('rejects non-finite geometry bounds', async () => {
      const raw = rawTriangle();
      new DataView(raw.buffer).setFloat32(12, Number.NaN, true);
      expect(await errorOf(await fileWithGeometry(await deflate(raw)))).toMatch(
        'non-finite geometry bounds'
      );
    });

    it('rejects an index past the vertex count', async () => {
      const raw = setU32(rawTriangle(), 62, 3);
      expect(await errorOf(await fileWithGeometry(await deflate(raw)))).toMatch(
        'index out of range'
      );
    });
  });
});
