/**
 * Stored mesh file: one imported imprint mesh as a standalone immutable blob,
 * named by the lowercase hex SHA-256 of its exact bytes.
 *
 * Layout (little-endian):
 *   magic      u32  'GMSH'
 *   version    u32
 *   tCount     u32  declared triangle count
 *   geomBytes  u32  length of the geometry section
 *   ringCount  u32
 *   ringSizes  ringCount × u32  points per outline ring
 *   geometry   geomBytes  the asset's deflated GMA1 bytes, verbatim
 *   points     Σ ringSizes × 2 × f64  outline x, y in mm
 *
 * The name is a content hash, so the same mesh must always produce the same
 * bytes. That is why geometry is copied rather than re-deflated (deflate
 * output is not guaranteed identical across browsers), outlines are f64
 * (lossless, so a decoded file re-encodes to itself), and -0 is written as 0
 * (JSON turns -0 into 0, so a design that went through JSON would otherwise
 * hash differently).
 *
 * MIRROR: `api/lib/meshFile.ts` validates this layout on upload (api/ cannot
 * import from src/). `api/lib/meshFile.crossBoundary.test.ts` pins the two.
 */

import { err, isErr, ok, validationImportFailed } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';
import {
  MAX_MESH_ASSET_DATA_LENGTH,
  MAX_MESH_ASSET_TRIANGLES,
  MAX_MESH_OUTLINE_POINTS,
  base64ToBytes,
  bytesToBase64,
  decodeMeshBytes,
} from './meshAsset';
import type { MeshAsset, MeshOutlinePoint } from './meshAsset';

/** Name and size stay in the design, so one mesh imported under two names is one file. */
export type MeshFileContent = Pick<MeshAsset, 'data' | 'triangleCount' | 'outlines'>;

const MAGIC = 0x48534d47; // 'GMSH' read as a little-endian u32
export const MESH_FILE_VERSION = 1;
export const MESH_FILE_HEADER_BYTES = 20;
const RING_SIZE_BYTES = 4;
const POINT_BYTES = 16;

/** The decoded size of the largest `data` string the design validator accepts. */
export const MAX_MESH_FILE_GEOMETRY_BYTES = (MAX_MESH_ASSET_DATA_LENGTH / 4) * 3;
/** Every ring has at least 3 points, so the point budget bounds the ring count. */
export const MAX_MESH_FILE_RINGS = Math.floor(MAX_MESH_OUTLINE_POINTS / 3);
/** MIRROR: `CONSTRAINTS.MAX_MESH_SIZE_MM` in `api/lib/designerValidationConstants.ts`. */
export const MAX_MESH_OUTLINE_COORD_MM = 1000;

interface ParsedMeshFile {
  readonly triangleCount: number;
  readonly geometry: Uint8Array;
  readonly outlines: MeshOutlinePoint[][];
}

function invalid(reason: string): Result<never, ValidationError> {
  return err(validationImportFailed([`Mesh file invalid: ${reason}`]));
}

function countsError(
  triangleCount: number,
  geometryBytes: number,
  ringCount: number
): string | null {
  if (triangleCount < 1 || triangleCount > MAX_MESH_ASSET_TRIANGLES) {
    return `triangle count must be in [1, ${MAX_MESH_ASSET_TRIANGLES}]`;
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
  if (!Number.isFinite(v) || Math.abs(v) > MAX_MESH_OUTLINE_COORD_MM) {
    return `outline points must be finite and within ±${MAX_MESH_OUTLINE_COORD_MM}mm`;
  }
  if (Object.is(v, -0)) return 'outline points must not be -0';
  return null;
}

function parseMeshFile(bytes: Uint8Array): Result<ParsedMeshFile, ValidationError> {
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
  const ringSizes: number[] = [];
  let totalPoints = 0;
  for (let r = 0; r < ringCount; r++) {
    const size = view.getUint32(MESH_FILE_HEADER_BYTES + r * RING_SIZE_BYTES, true);
    if (size < 3) return invalid('outline rings need at least 3 points');
    totalPoints += size;
    if (totalPoints > MAX_MESH_OUTLINE_POINTS) {
      return invalid(`outlines exceed ${MAX_MESH_OUTLINE_POINTS} total points`);
    }
    ringSizes.push(size);
  }

  const pointsOffset = geometryOffset + geometryBytes;
  if (bytes.byteLength !== pointsOffset + totalPoints * POINT_BYTES) {
    return invalid('size mismatch');
  }

  const outlines: MeshOutlinePoint[][] = [];
  let offset = pointsOffset;
  for (const size of ringSizes) {
    const ring: MeshOutlinePoint[] = [];
    for (let p = 0; p < size; p++) {
      const x = view.getFloat64(offset, true);
      const y = view.getFloat64(offset + 8, true);
      offset += POINT_BYTES;
      const bad = pointError(x) ?? pointError(y);
      if (bad !== null) return invalid(bad);
      ring.push({ x, y });
    }
    outlines.push(ring);
  }

  return ok({
    triangleCount,
    geometry: bytes.subarray(geometryOffset, pointsOffset),
    outlines,
  });
}

export function encodeMeshFile(content: MeshFileContent): Result<Uint8Array, ValidationError> {
  let geometry: Uint8Array;
  try {
    geometry = base64ToBytes(content.data);
  } catch {
    return invalid('asset data is not base64');
  }
  if (!Number.isInteger(content.triangleCount)) return invalid('triangle count must be an integer');
  const counts = countsError(content.triangleCount, geometry.byteLength, content.outlines.length);
  if (counts !== null) return invalid(counts);
  const totalPoints = content.outlines.reduce((sum, ring) => sum + ring.length, 0);
  if (totalPoints > MAX_MESH_OUTLINE_POINTS) {
    return invalid(`outlines exceed ${MAX_MESH_OUTLINE_POINTS} total points`);
  }

  const ringCount = content.outlines.length;
  const geometryOffset = MESH_FILE_HEADER_BYTES + ringCount * RING_SIZE_BYTES;
  const pointsOffset = geometryOffset + geometry.byteLength;
  const bytes = new Uint8Array(pointsOffset + totalPoints * POINT_BYTES);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, MESH_FILE_VERSION, true);
  view.setUint32(8, content.triangleCount, true);
  view.setUint32(12, geometry.byteLength, true);
  view.setUint32(16, ringCount, true);
  content.outlines.forEach((ring, r) => {
    view.setUint32(MESH_FILE_HEADER_BYTES + r * RING_SIZE_BYTES, ring.length, true);
  });
  bytes.set(geometry, geometryOffset);
  let offset = pointsOffset;
  for (const ring of content.outlines) {
    for (const point of ring) {
      view.setFloat64(offset, point.x === 0 ? 0 : point.x, true);
      view.setFloat64(offset + 8, point.y === 0 ? 0 : point.y, true);
      offset += POINT_BYTES;
    }
  }

  const parsed = parseMeshFile(bytes);
  return isErr(parsed) ? parsed : ok(bytes);
}

export async function decodeMeshFile(
  bytes: Uint8Array
): Promise<Result<MeshFileContent, ValidationError>> {
  const parsed = parseMeshFile(bytes);
  if (isErr(parsed)) return parsed;
  const { triangleCount, geometry, outlines } = parsed.value;

  const decoded = await decodeMeshBytes(geometry);
  if (isErr(decoded)) return decoded;
  if (decoded.value.indices.length / 3 > triangleCount) {
    return invalid('geometry holds more triangles than the file declares');
  }

  return ok({ data: bytesToBase64(geometry), triangleCount, outlines });
}
