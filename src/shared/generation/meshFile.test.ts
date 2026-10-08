import { describe, it, expect } from 'vitest';
import { isErr, isOk, unwrap } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';
import { bytesToBase64, encodeMeshData, MAX_MESH_ASSET_TRIANGLES } from './meshAsset';
import type { MeshAsset } from './meshAsset';
import {
  decodeMeshFile,
  encodeMeshFile,
  MAX_MESH_FILE_GEOMETRY_BYTES,
  MAX_MESH_FILE_RINGS,
  MESH_FILE_HEADER_BYTES,
} from './meshFile';
import type { MeshFileContent } from './meshFile';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 40 },
];

async function tetrahedronAsset(): Promise<MeshAsset> {
  const positions = new Float32Array([0, 0, 0, 40, 0, 0, 0, 40, 0, 0, 0, 40]);
  const indices = new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
  return {
    name: 'tetra',
    data: unwrap(await encodeMeshData(positions, indices)),
    triangleCount: 4,
    sizeMm: { x: 40, y: 40, z: 40 },
    outlines: [SQUARE, [...SQUARE].reverse().map((p) => ({ x: p.x / 2 + 10, y: p.y / 2 + 10 }))],
  };
}

function reason(result: Result<unknown, ValidationError>): string {
  if (result.ok) return 'ok';
  return 'errors' in result.error ? result.error.errors.join('; ') : result.error.message;
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

async function validFile(): Promise<Uint8Array> {
  return unwrap(encodeMeshFile(await tetrahedronAsset()));
}

describe('encodeMeshFile / decodeMeshFile', () => {
  it('round-trips the asset content exactly', async () => {
    const asset = await tetrahedronAsset();
    const decoded = unwrap(await decodeMeshFile(unwrap(encodeMeshFile(asset))));
    expect(decoded).toEqual({
      data: asset.data,
      triangleCount: asset.triangleCount,
      outlines: asset.outlines,
    });
  });

  it('carries the asset data bytes verbatim, not re-compressed', async () => {
    const asset = await tetrahedronAsset();
    const file = unwrap(encodeMeshFile(asset));
    const geometryOffset = MESH_FILE_HEADER_BYTES + asset.outlines.length * 4;
    const geometryBytes = new DataView(file.buffer).getUint32(12, true);
    expect(bytesToBase64(file.subarray(geometryOffset, geometryOffset + geometryBytes))).toBe(
      asset.data
    );
  });

  it('ignores the name and size, so one mesh imported twice is one file', async () => {
    const asset = await tetrahedronAsset();
    const renamed: MeshAsset = { ...asset, name: 'other', sizeMm: { x: 1, y: 2, z: 3 } };
    expect(unwrap(encodeMeshFile(renamed))).toEqual(unwrap(encodeMeshFile(asset)));
  });
});

describe('determinism', () => {
  it('encodes equal content to identical bytes', async () => {
    const asset = await tetrahedronAsset();
    expect(unwrap(encodeMeshFile(asset))).toEqual(unwrap(encodeMeshFile(asset)));
  });

  it('encodes an asset that went through JSON to the same bytes', async () => {
    const asset = await tetrahedronAsset();
    const viaJson = JSON.parse(JSON.stringify(asset)) as MeshAsset;
    expect(unwrap(encodeMeshFile(viaJson))).toEqual(unwrap(encodeMeshFile(asset)));
  });

  it('writes -0 as 0, matching what a JSON round trip does to it', async () => {
    const asset = await tetrahedronAsset();
    const negativeZero: MeshFileContent = {
      ...asset,
      outlines: [[{ x: -0, y: -0 }, ...SQUARE.slice(1)], asset.outlines[1]],
    };
    expect(unwrap(encodeMeshFile(negativeZero))).toEqual(unwrap(encodeMeshFile(asset)));
  });

  it('re-encodes a decoded file to the same bytes', async () => {
    const file = await validFile();
    const decoded = unwrap(await decodeMeshFile(file));
    expect(unwrap(encodeMeshFile(decoded))).toEqual(file);
  });

  it('keeps full f64 precision in outline points', async () => {
    const asset = await tetrahedronAsset();
    const precise: MeshFileContent = {
      ...asset,
      outlines: [[{ x: 0.1 + 0.2, y: 1 / 3 }, ...SQUARE.slice(1)]],
    };
    const decoded = unwrap(await decodeMeshFile(unwrap(encodeMeshFile(precise))));
    expect(decoded.outlines[0][0]).toEqual({ x: 0.1 + 0.2, y: 1 / 3 });
  });
});

describe('decodeMeshFile rejections', () => {
  it('rejects a truncated header', async () => {
    const file = await validFile();
    expect(reason(await decodeMeshFile(file.subarray(0, MESH_FILE_HEADER_BYTES - 1)))).toMatch(
      'truncated header'
    );
  });

  it('rejects a bad magic', async () => {
    expect(reason(await decodeMeshFile(setU32(await validFile(), 0, 0x31414d47)))).toMatch(
      'bad magic'
    );
  });

  it('rejects an unknown version', async () => {
    expect(reason(await decodeMeshFile(setU32(await validFile(), 4, 2)))).toMatch(
      'unsupported version'
    );
  });

  it('rejects a declared triangle count over the import budget', async () => {
    const file = setU32(await validFile(), 8, MAX_MESH_ASSET_TRIANGLES + 1);
    expect(reason(await decodeMeshFile(file))).toMatch('triangle count');
  });

  it('rejects a declared triangle count of zero', async () => {
    expect(reason(await decodeMeshFile(setU32(await validFile(), 8, 0)))).toMatch('triangle count');
  });

  it('rejects geometry that holds more triangles than declared', async () => {
    const asset = await tetrahedronAsset();
    const file = unwrap(encodeMeshFile({ ...asset, triangleCount: 3 }));
    expect(reason(await decodeMeshFile(file))).toMatch('more triangles than declared');
  });

  it('accepts geometry that holds fewer triangles than declared', async () => {
    const asset = await tetrahedronAsset();
    const file = unwrap(encodeMeshFile({ ...asset, triangleCount: 5 }));
    expect(isOk(await decodeMeshFile(file))).toBe(true);
  });

  it('rejects geometry that is not a mesh', async () => {
    const asset = await tetrahedronAsset();
    const file = unwrap(encodeMeshFile({ ...asset, data: bytesToBase64(new Uint8Array(64)) }));
    expect(reason(await decodeMeshFile(file))).toMatch('Mesh decode failed');
  });

  it('rejects a geometry length over the cap', async () => {
    const file = setU32(await validFile(), 12, MAX_MESH_FILE_GEOMETRY_BYTES + 1);
    expect(reason(await decodeMeshFile(file))).toMatch('geometry must be');
  });

  it('rejects a file with no outline rings', async () => {
    expect(reason(await decodeMeshFile(setU32(await validFile(), 16, 0)))).toMatch('ring count');
  });

  it('rejects more rings than the point budget allows', async () => {
    const file = setU32(await validFile(), 16, MAX_MESH_FILE_RINGS + 1);
    expect(reason(await decodeMeshFile(file))).toMatch('ring count');
  });

  it('rejects a ring under 3 points', async () => {
    const file = setU32(await validFile(), MESH_FILE_HEADER_BYTES, 2);
    expect(reason(await decodeMeshFile(file))).toMatch('at least 3 points');
  });

  it('rejects outlines over the point budget', async () => {
    const file = setU32(await validFile(), MESH_FILE_HEADER_BYTES, 4001);
    expect(reason(await decodeMeshFile(file))).toMatch('exceed 4000 total points');
  });

  it('rejects trailing bytes', async () => {
    const file = await validFile();
    const padded = new Uint8Array(file.byteLength + 1);
    padded.set(file);
    expect(reason(await decodeMeshFile(padded))).toMatch('size mismatch');
  });

  it('rejects a missing byte', async () => {
    const file = await validFile();
    expect(reason(await decodeMeshFile(file.subarray(0, file.byteLength - 1)))).toMatch(
      'size mismatch'
    );
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['out of range', 1000.5],
  ])('rejects a %s outline coordinate', async (_label, value) => {
    expect(reason(await decodeMeshFile(setLastF64(await validFile(), value)))).toMatch(
      'outline points must be finite'
    );
  });

  it('rejects a -0 outline coordinate, which no encoder writes', async () => {
    expect(reason(await decodeMeshFile(setLastF64(await validFile(), -0)))).toMatch('-0');
  });
});

describe('encodeMeshFile rejections', () => {
  it('rejects data that is not base64', async () => {
    const asset = await tetrahedronAsset();
    expect(reason(encodeMeshFile({ ...asset, data: 'not base64!' }))).toMatch('not base64');
  });

  it('rejects a fractional triangle count', async () => {
    const asset = await tetrahedronAsset();
    expect(reason(encodeMeshFile({ ...asset, triangleCount: 3.5 }))).toMatch('integer');
  });

  it('rejects outlines over the point budget before allocating', async () => {
    const asset = await tetrahedronAsset();
    const ring = Array.from({ length: 4001 }, (_, i) => ({ x: i % 100, y: 0 }));
    expect(reason(encodeMeshFile({ ...asset, outlines: [ring] }))).toMatch('exceed 4000');
  });

  it('rejects an out-of-range outline point', async () => {
    const asset = await tetrahedronAsset();
    const outlines = [[{ x: 2000, y: 0 }, ...SQUARE.slice(1)]];
    expect(isErr(encodeMeshFile({ ...asset, outlines }))).toBe(true);
  });

  it('rejects an asset with no outlines', async () => {
    const asset = await tetrahedronAsset();
    expect(reason(encodeMeshFile({ ...asset, outlines: [] }))).toMatch('ring count');
  });
});
