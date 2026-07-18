/**
 * Compressed mesh asset codec for imported STL imprint meshes.
 *
 * An imported tool mesh is decimated in the worker, then stored inside the
 * design as a compact string: positions quantized to a uint16 grid over the
 * mesh bounding box (≤0.01mm resolution at drawer-tool scale), deflated via
 * CompressionStream, base64-encoded. The codec is symmetric and lossless
 * apart from the quantization step.
 *
 * Binary layout before compression (little-endian):
 *   magic   u32  'GMA1'
 *   vCount  u32  vertex count
 *   tCount  u32  triangle count
 *   bbox    6×f32  minX minY minZ maxX maxY maxZ
 *   pos     vCount×3 × u16  normalized to bbox per axis
 *   idx     tCount×3 × u32
 */

import { err, ok, validationImportFailed } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';

/** A 2D silhouette ring point in mm, in the mesh's lay-flat XY frame. */
export interface MeshOutlinePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A stored imprint mesh: decimated, lay-flat oriented, compressed. Lives in
 * `BinParams.meshAssets`, referenced from cutouts with `shape: 'mesh'`.
 */
export interface MeshAsset {
  /** Original file name (sanitized, extension stripped by the importer). */
  readonly name: string;
  /** base64(deflate(quantized mesh)) — see codec layout above. */
  readonly data: string;
  readonly triangleCount: number;
  /** Oriented (lay-flat) bounding box size in mm. */
  readonly sizeMm: { readonly x: number; readonly y: number; readonly z: number };
  /**
   * Top-down silhouette outer rings (holes dropped), simplified. Powers the 2D
   * footprint render, clearance offset, and chamfer rim without decoding the
   * mesh on the main thread. Mutable array types (like `BinParams.cutouts`)
   * so the asset nests cleanly inside immer drafts of `BinParams`.
   */
  readonly outlines: MeshOutlinePoint[][];
}

/** Why a mesh import failed — drives the user-facing toast + analytics reason. */
export type MeshImportErrorReason = 'too_large' | 'parse_failed' | 'not_manifold' | 'empty';

/** Rotation in degrees applied about each axis AFTER auto lay-flat. */
export interface MeshImportRotation {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Hard cap on the uploaded STL file size (bytes). */
export const MAX_MESH_FILE_BYTES = 50 * 1024 * 1024;
/** Triangle budget an imported mesh is decimated to fit. */
export const MAX_MESH_ASSET_TRIANGLES = 50_000;
/** Max mesh assets per design. */
export const MAX_MESH_ASSETS_PER_DESIGN = 8;
/** Max total silhouette points across all outlines of one asset. */
export const MAX_MESH_OUTLINE_POINTS = 4000;

const MAGIC = 0x314d4741; // 'GMA1'
const HEADER_BYTES = 4 + 4 + 4 + 6 * 4;
const QUANT_MAX = 65535;

/** Decoded mesh arrays: indexed triangles, positions in mm. */
export interface DecodedMeshData {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
}

async function pipeThrough(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const src = new Blob([input as BlobPart]).stream().pipeThrough(stream);
  const buffer = await new Response(src).arrayBuffer();
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encodes indexed mesh arrays (positions in mm) into the compressed asset
 * string. Rejects empty or non-finite geometry.
 */
export async function encodeMeshData(
  positions: Float32Array,
  indices: Uint32Array
): Promise<Result<string, ValidationError>> {
  const vertexCount = positions.length / 3;
  const triangleCount = indices.length / 3;
  if (
    vertexCount === 0 ||
    triangleCount === 0 ||
    !Number.isInteger(vertexCount) ||
    !Number.isInteger(triangleCount)
  ) {
    return err(validationImportFailed(['Mesh encode failed: empty or malformed arrays']));
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const v = positions[i];
    if (!Number.isFinite(v)) {
      return err(validationImportFailed(['Mesh encode failed: non-finite vertex position']));
    }
    const axis = i % 3;
    if (v < min[axis]) min[axis] = v;
    if (v > max[axis]) max[axis] = v;
  }

  const raw = new ArrayBuffer(HEADER_BYTES + vertexCount * 3 * 2 + triangleCount * 3 * 4);
  const view = new DataView(raw);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, vertexCount, true);
  view.setUint32(8, triangleCount, true);
  for (let axis = 0; axis < 3; axis++) {
    view.setFloat32(12 + axis * 4, min[axis], true);
    view.setFloat32(24 + axis * 4, max[axis], true);
  }

  const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const quantized = new Uint16Array(raw, HEADER_BYTES, vertexCount * 3);
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3;
    quantized[i] =
      extent[axis] > 0 ? Math.round(((positions[i] - min[axis]) / extent[axis]) * QUANT_MAX) : 0;
  }

  const idxOffset = HEADER_BYTES + vertexCount * 3 * 2;
  const idxView = new DataView(raw, idxOffset);
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= vertexCount) {
      return err(validationImportFailed(['Mesh encode failed: index out of range']));
    }
    idxView.setUint32(i * 4, indices[i], true);
  }

  const compressed = await pipeThrough(new Uint8Array(raw), new CompressionStream('deflate'));
  return ok(bytesToBase64(compressed));
}

/**
 * Decodes an asset string back to indexed mesh arrays (positions in mm).
 * Validates structure so a corrupted or foreign string never yields NaN
 * geometry downstream.
 */
export async function decodeMeshData(
  data: string
): Promise<Result<DecodedMeshData, ValidationError>> {
  let raw: Uint8Array;
  try {
    raw = await pipeThrough(base64ToBytes(data), new DecompressionStream('deflate'));
  } catch {
    return err(validationImportFailed(['Mesh decode failed: corrupt asset data']));
  }

  if (raw.byteLength < HEADER_BYTES) {
    return err(validationImportFailed(['Mesh decode failed: truncated header']));
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (view.getUint32(0, true) !== MAGIC) {
    return err(validationImportFailed(['Mesh decode failed: bad magic']));
  }
  const vertexCount = view.getUint32(4, true);
  const triangleCount = view.getUint32(8, true);
  const expected = HEADER_BYTES + vertexCount * 3 * 2 + triangleCount * 3 * 4;
  if (raw.byteLength !== expected || vertexCount === 0 || triangleCount === 0) {
    return err(validationImportFailed(['Mesh decode failed: size mismatch']));
  }

  const min = [view.getFloat32(12, true), view.getFloat32(16, true), view.getFloat32(20, true)];
  const max = [view.getFloat32(24, true), view.getFloat32(28, true), view.getFloat32(32, true)];
  if (![...min, ...max].every(Number.isFinite)) {
    return err(validationImportFailed(['Mesh decode failed: non-finite bounds']));
  }

  const positions = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3;
    const q = view.getUint16(HEADER_BYTES + i * 2, true);
    positions[i] = min[axis] + (q / QUANT_MAX) * (max[axis] - min[axis]);
  }

  const indices = new Uint32Array(triangleCount * 3);
  const idxOffset = HEADER_BYTES + vertexCount * 3 * 2;
  for (let i = 0; i < indices.length; i++) {
    const idx = view.getUint32(idxOffset + i * 4, true);
    if (idx >= vertexCount) {
      return err(validationImportFailed(['Mesh decode failed: index out of range']));
    }
    indices[i] = idx;
  }

  return ok({ positions, indices });
}
