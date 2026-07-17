/**
 * STL parser (binary + ASCII) for extracting mesh arrays.
 *
 * Used to convert worker-generated STL data into vertex/normal arrays
 * suitable for 3MF export via threemfExporter, and to parse user-uploaded
 * STL files for mesh imprint import.
 *
 * Binary STL format:
 *   Header:  80 bytes
 *   Count:   4 bytes (uint32 LE)
 *   Per tri: 50 bytes (normal 3×f32 + 3 vertices × 3×f32 + attr uint16)
 *
 * ASCII STL format:
 *   solid <name> / facet normal nx ny nz / outer loop / vertex ×3 / endloop /
 *   endfacet ... endsolid
 */

import { err, ok, validationImportFailed } from '@/core/result';
import type { Result, ValidationError } from '@/core/result';

/** Parsed mesh arrays from binary STL */
export interface ParsedSTLMesh {
  /** Flat vertex array (every 9 floats = 1 triangle, 3 vertices × XYZ) */
  readonly vertices: Float32Array;
  /** Flat normal array (face normal replicated per vertex, matching vertices layout) */
  readonly normals: Float32Array;
}

const HEADER_SIZE = 80;
const COUNT_OFFSET = 80;
const COUNT_SIZE = 4;
const TRIANGLE_SIZE = 50;
const MIN_FILE_SIZE = HEADER_SIZE + COUNT_SIZE;

/**
 * Extracts vertex and normal arrays from a binary STL ArrayBuffer.
 *
 * Each triangle's face normal is replicated to all three vertices
 * (flat shading), matching the layout expected by threemfExporter.
 *
 * Returns Err(validationImportFailed) if the buffer is malformed.
 */
export function parseSTLBinary(buffer: ArrayBuffer): Result<ParsedSTLMesh, ValidationError> {
  if (buffer.byteLength < MIN_FILE_SIZE) {
    return err(
      validationImportFailed([`Invalid STL: buffer too small (${buffer.byteLength} bytes)`])
    );
  }

  const view = new DataView(buffer);
  const triangleCount = view.getUint32(COUNT_OFFSET, true);

  const payloadBytes = buffer.byteLength - MIN_FILE_SIZE;

  // Ensure payload length aligns with fixed per-triangle record size
  if (payloadBytes % TRIANGLE_SIZE !== 0) {
    return err(
      validationImportFailed([
        `Invalid STL: payload size (${payloadBytes} bytes) is not a multiple of triangle record size (${TRIANGLE_SIZE} bytes)`,
      ])
    );
  }

  const expectedSize = MIN_FILE_SIZE + triangleCount * TRIANGLE_SIZE;
  if (buffer.byteLength !== expectedSize) {
    const actualTriangleCount = payloadBytes / TRIANGLE_SIZE;
    return err(
      validationImportFailed([
        `Invalid STL: triangle count header (${triangleCount}) does not match payload (${actualTriangleCount} triangles)`,
      ])
    );
  }

  const vertices = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);

  let offset = HEADER_SIZE + COUNT_SIZE;

  for (let tri = 0; tri < triangleCount; tri++) {
    // Read face normal
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;

    const base = tri * 9;

    // Read 3 vertices and replicate face normal
    for (let v = 0; v < 3; v++) {
      const vIdx = base + v * 3;
      vertices[vIdx] = view.getFloat32(offset, true);
      vertices[vIdx + 1] = view.getFloat32(offset + 4, true);
      vertices[vIdx + 2] = view.getFloat32(offset + 8, true);
      normals[vIdx] = nx;
      normals[vIdx + 1] = ny;
      normals[vIdx + 2] = nz;
      offset += 12;
    }

    // Skip attribute byte count (2 bytes)
    offset += 2;
  }

  return ok({ vertices, normals });
}

/**
 * A buffer is treated as binary STL when the 84-byte header's triangle count
 * exactly predicts the file size. This is checked BEFORE any text sniffing
 * because binary files exported by some tools begin with the bytes "solid"
 * in their free-form 80-byte header.
 */
function isBinarySTL(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < MIN_FILE_SIZE) return false;
  const count = new DataView(buffer).getUint32(COUNT_OFFSET, true);
  return buffer.byteLength === MIN_FILE_SIZE + count * TRIANGLE_SIZE;
}

function looksLikeAsciiSTL(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(
    buffer.slice(0, Math.min(buffer.byteLength, 512))
  );
  return head.trimStart().toLowerCase().startsWith('solid');
}

/**
 * Parses an ASCII STL buffer into the same flat triangle-soup arrays as the
 * binary parser (face normal replicated per vertex).
 */
export function parseSTLAscii(buffer: ArrayBuffer): Result<ParsedSTLMesh, ValidationError> {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const lines = text.split('\n');

  const vertices: number[] = [];
  const normals: number[] = [];
  let currentNormal: [number, number, number] = [0, 0, 0];
  let facetVertexCount = -1;

  for (let i = 0; i < lines.length; i++) {
    // Keyword matching is case-insensitive (some exporters write FACET/VERTEX);
    // lowercasing the whole line is safe for the numeric tokens too (only an
    // exponent 'E' can change, and Number() accepts either case).
    const line = lines[i].trim().toLowerCase();
    if (line.startsWith('vertex')) {
      if (facetVertexCount < 0) {
        return err(
          validationImportFailed([`Invalid ASCII STL: vertex outside facet (line ${i + 1})`])
        );
      }
      if (facetVertexCount >= 3) {
        return err(
          validationImportFailed([
            `Invalid ASCII STL: more than 3 vertices in facet (line ${i + 1})`,
          ])
        );
      }
      const parts = line.split(/\s+/);
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return err(validationImportFailed([`Invalid ASCII STL: malformed vertex (line ${i + 1})`]));
      }
      vertices.push(x, y, z);
      normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
      facetVertexCount++;
    } else if (line.startsWith('facet')) {
      const parts = line.split(/\s+/);
      // "facet normal nx ny nz" — tolerate missing/garbage normals (many
      // exporters write zeros); downstream import recomputes them anyway.
      const nx = Number(parts[2]);
      const ny = Number(parts[3]);
      const nz = Number(parts[4]);
      currentNormal = [
        Number.isFinite(nx) ? nx : 0,
        Number.isFinite(ny) ? ny : 0,
        Number.isFinite(nz) ? nz : 0,
      ];
      facetVertexCount = 0;
    } else if (line.startsWith('endfacet')) {
      if (facetVertexCount !== 3) {
        return err(
          validationImportFailed([
            `Invalid ASCII STL: facet with ${facetVertexCount} vertices (line ${i + 1})`,
          ])
        );
      }
      facetVertexCount = -1;
    }
  }

  if (facetVertexCount !== -1) {
    return err(validationImportFailed(['Invalid ASCII STL: unterminated facet at end of file']));
  }
  if (vertices.length === 0) {
    return err(validationImportFailed(['Invalid ASCII STL: no facets found']));
  }

  return ok({ vertices: Float32Array.from(vertices), normals: Float32Array.from(normals) });
}

/**
 * Parses an STL buffer of either format. Binary detection (exact size match
 * from the header's triangle count) wins over text sniffing, since binary
 * headers may begin with "solid"; buffers that are neither fall through to
 * the binary parser for its precise structural error messages.
 */
export function parseSTL(buffer: ArrayBuffer): Result<ParsedSTLMesh, ValidationError> {
  if (isBinarySTL(buffer)) return parseSTLBinary(buffer);
  if (looksLikeAsciiSTL(buffer)) return parseSTLAscii(buffer);
  return parseSTLBinary(buffer);
}
