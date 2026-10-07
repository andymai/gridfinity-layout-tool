/**
 * Upload-side validation of a stored mesh file: one imported imprint mesh,
 * named by the lowercase hex SHA-256 of its bytes.
 *
 * MIRROR: the layout is defined by `src/shared/generation/meshFile.ts`, and the
 * geometry checks mirror `decodeMeshBytes` in `src/shared/generation/meshAsset.ts`
 * (api/ cannot import from src/). `meshFile.crossBoundary.test.ts` runs both
 * sides over the same files and requires the same verdict, so the server never
 * stores a file the client cannot decode.
 */

import { createHash } from 'node:crypto';
import { CONSTRAINTS } from './designerValidationConstants.js';

const MAGIC = 0x48534d47; // 'GMSH' read as a little-endian u32
export const MESH_FILE_VERSION = 1;
export const MESH_FILE_HEADER_BYTES = 20;
const RING_SIZE_BYTES = 4;
const POINT_BYTES = 16;

export const MAX_MESH_FILE_GEOMETRY_BYTES = (CONSTRAINTS.MAX_MESH_DATA_LENGTH / 4) * 3;
export const MAX_MESH_FILE_RINGS = Math.floor(CONSTRAINTS.MAX_MESH_OUTLINE_POINTS / 3);

/**
 * Request body cap. The largest file the layout admits is about 745 KB (675 KB
 * of geometry, 64 KB of outline points, the ring table), so 1 MiB turns junk
 * away before it is hashed or inflated without pinching a real mesh. Vercel's
 * 4.5 MB request limit is the only bound in front of this one.
 */
export const MAX_MESH_UPLOAD_BYTES = 1024 * 1024;

const GEOMETRY_MAGIC = 0x314d4741;
const GEOMETRY_HEADER_BYTES = 36;
/** MIRROR: `MAX_DECODED_MESH_BYTES` in `src/shared/generation/meshAsset.ts`. */
export const MAX_DECODED_MESH_BYTES =
  GEOMETRY_HEADER_BYTES + CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES * (3 * 6 + 12) * 2;

const MESH_HASH_REGEX = /^[0-9a-f]{64}$/;

export function meshBlobPath(hash: string): string {
  return `meshes/${hash}`;
}

export function isMeshHash(value: unknown): value is string {
  return typeof value === 'string' && MESH_HASH_REGEX.test(value);
}

export function meshFileHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export type MeshFileCheck = { ok: true; triangleCount: number } | { ok: false; error: string };

function invalid(reason: string): MeshFileCheck {
  return { ok: false, error: `Mesh file invalid: ${reason}` };
}

function countsError(
  triangleCount: number,
  geometryBytes: number,
  ringCount: number
): string | null {
  if (triangleCount < 1 || triangleCount > CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES) {
    return `triangle count must be in [1, ${CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES}]`;
  }
  if (geometryBytes < 1 || geometryBytes > MAX_MESH_FILE_GEOMETRY_BYTES) {
    return `geometry must be 1 to ${MAX_MESH_FILE_GEOMETRY_BYTES} bytes`;
  }
  if (ringCount < 1 || ringCount > MAX_MESH_FILE_RINGS) {
    return `outline ring count must be in [1, ${MAX_MESH_FILE_RINGS}]`;
  }
  return null;
}

function pointError(v: number): string | null {
  if (!Number.isFinite(v) || Math.abs(v) > CONSTRAINTS.MAX_MESH_SIZE_MM) {
    return `outline points must be finite and within ±${CONSTRAINTS.MAX_MESH_SIZE_MM}mm`;
  }
  if (Object.is(v, -0)) return 'outline points must not be -0';
  return null;
}

/**
 * Inflate, aborting once the output passes `limit`. Checking the size only
 * after a full inflate would let a tiny deflate bomb allocate gigabytes first.
 */
async function inflateBounded(input: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([input.slice()]).stream().pipeThrough(new DecompressionStream('deflate'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error('mesh geometry exceeds the decompressed size limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Returns the geometry's triangle count, or an error string. */
async function checkGeometry(compressed: Uint8Array): Promise<number | string> {
  let raw: Uint8Array;
  try {
    raw = await inflateBounded(compressed, MAX_DECODED_MESH_BYTES);
  } catch {
    return 'corrupt geometry';
  }
  if (raw.byteLength < GEOMETRY_HEADER_BYTES) return 'truncated geometry header';
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (view.getUint32(0, true) !== GEOMETRY_MAGIC) return 'bad geometry magic';
  const vertexCount = view.getUint32(4, true);
  const triangleCount = view.getUint32(8, true);
  const expected = GEOMETRY_HEADER_BYTES + vertexCount * 3 * 2 + triangleCount * 3 * 4;
  if (raw.byteLength !== expected || vertexCount === 0 || triangleCount === 0) {
    return 'geometry size mismatch';
  }
  for (let offset = 12; offset < GEOMETRY_HEADER_BYTES; offset += 4) {
    if (!Number.isFinite(view.getFloat32(offset, true))) return 'non-finite geometry bounds';
  }
  const indexOffset = GEOMETRY_HEADER_BYTES + vertexCount * 3 * 2;
  for (let i = 0; i < triangleCount * 3; i++) {
    if (view.getUint32(indexOffset + i * 4, true) >= vertexCount) {
      return 'geometry index out of range';
    }
  }
  return triangleCount;
}

/**
 * Full validation of an uploaded mesh file: header, counts, exact length,
 * outline bounds, and geometry that decodes to no more triangles than the
 * file declares. A design carries the declared count and its triangle caps are
 * checked against it, so a file that understates it would slip geometry past them.
 */
export async function validateMeshFile(bytes: Uint8Array): Promise<MeshFileCheck> {
  if (bytes.byteLength < MESH_FILE_HEADER_BYTES) return invalid('truncated header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== MAGIC) return invalid('bad magic');
  if (view.getUint32(4, true) !== MESH_FILE_VERSION) return invalid('unsupported version');

  const triangleCount = view.getUint32(8, true);
  const geometryBytes = view.getUint32(12, true);
  const ringCount = view.getUint32(16, true);
  const counts = countsError(triangleCount, geometryBytes, ringCount);
  if (counts !== null) return invalid(counts);

  const geometryOffset = MESH_FILE_HEADER_BYTES + ringCount * RING_SIZE_BYTES;
  if (bytes.byteLength < geometryOffset) return invalid('size mismatch');
  let totalPoints = 0;
  for (let r = 0; r < ringCount; r++) {
    const size = view.getUint32(MESH_FILE_HEADER_BYTES + r * RING_SIZE_BYTES, true);
    if (size < 3) return invalid('outline rings need at least 3 points');
    totalPoints += size;
    if (totalPoints > CONSTRAINTS.MAX_MESH_OUTLINE_POINTS) {
      return invalid(`outlines exceed ${CONSTRAINTS.MAX_MESH_OUTLINE_POINTS} total points`);
    }
  }

  const pointsOffset = geometryOffset + geometryBytes;
  if (bytes.byteLength !== pointsOffset + totalPoints * POINT_BYTES) {
    return invalid('size mismatch');
  }
  for (let offset = pointsOffset; offset < bytes.byteLength; offset += 8) {
    const bad = pointError(view.getFloat64(offset, true));
    if (bad !== null) return invalid(bad);
  }

  const decoded = await checkGeometry(bytes.subarray(geometryOffset, pointsOffset));
  if (typeof decoded === 'string') return invalid(decoded);
  if (decoded > triangleCount) {
    return invalid('geometry holds more triangles than the file declares');
  }
  return { ok: true, triangleCount };
}
