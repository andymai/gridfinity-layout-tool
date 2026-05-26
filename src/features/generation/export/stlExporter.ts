/**
 * Binary STL file exporter.
 *
 * Produces valid binary STL from mesh vertex/normal arrays.
 * Binary format is preferred over ASCII for smaller file sizes (~50 bytes/tri vs ~200).
 *
 * Format spec:
 *   Header:  80 bytes (any text, zero-padded)
 *   Count:   4 bytes (uint32 LE triangle count)
 *   Per tri: 50 bytes (normal 3×f32 + 3 vertices × 3×f32 + attr uint16)
 */

import { validateMeshData } from './validation';

/**
 * Generates a binary STL Blob from mesh data.
 *
 * @param vertices - Flat vertex array (every 9 floats = 1 triangle, 3 vertices × XYZ)
 * @param normals - Flat normal array (matching vertices layout; uses first vertex normal per triangle)
 * @param name - Model name for the STL header (truncated to 80 chars)
 * @returns Binary STL as a Blob with correct MIME type
 *
 * @throws If vertex count is not divisible by 9 (incomplete triangles)
 * @throws If normals length doesn't match vertices length
 */
export function exportSTL(
  vertices: Float32Array,
  normals: Float32Array,
  name: string = 'gridfinity-bin'
): Blob {
  const buffer = buildSTLBuffer(vertices, normals, name);
  return new Blob([buffer], { type: 'application/sla' });
}

/**
 * Builds the raw binary STL ArrayBuffer.
 * Exposed separately for direct testing without Blob API limitations.
 */
export function buildSTLBuffer(
  vertices: Float32Array,
  normals: Float32Array,
  name: string = 'gridfinity-bin'
): ArrayBuffer {
  validateMeshData(vertices, normals);

  const triangleCount = vertices.length / 9;
  const HEADER_SIZE = 80;
  const COUNT_SIZE = 4;
  const TRIANGLE_SIZE = 50; // 12 (normal) + 36 (3 vertices) + 2 (attr)
  const fileSize = HEADER_SIZE + COUNT_SIZE + triangleCount * TRIANGLE_SIZE;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Write header (80 bytes, zero-padded ASCII)
  writeHeader(view, name);

  // Write triangle count (uint32 LE at offset 80)
  view.setUint32(HEADER_SIZE, triangleCount, true);

  // Write triangles
  let offset = HEADER_SIZE + COUNT_SIZE;
  for (let tri = 0; tri < triangleCount; tri++) {
    const vBase = tri * 9;

    // Flat shading: renormalize first-vertex normal so the output's unit-
    // vector invariant holds even if upstream meshes contain unnormalized
    // normals (a known hazard after boolean operations).
    const nx = normals[vBase];
    const ny = normals[vBase + 1];
    const nz = normals[vBase + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    view.setFloat32(offset, nx / len, true);
    view.setFloat32(offset + 4, ny / len, true);
    view.setFloat32(offset + 8, nz / len, true);
    offset += 12;

    // 3 vertices (9 floats)
    for (let v = 0; v < 3; v++) {
      const idx = vBase + v * 3;
      view.setFloat32(offset, vertices[idx], true);
      view.setFloat32(offset + 4, vertices[idx + 1], true);
      view.setFloat32(offset + 8, vertices[idx + 2], true);
      offset += 12;
    }

    // Attribute byte count (always 0 for standard STL)
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Writes a zero-padded ASCII header into the DataView.
 */
function writeHeader(view: DataView, name: string): void {
  let header = `Exported by Gridfinity Layout Tool - ${name}`;
  // Binary STL header MUST NOT begin with "solid" — parsers detect ASCII STL
  // by that prefix and will misread our binary file as text. Prefix is safe
  // today, but guard against future refactors that reorder the format.
  if (/^solid/i.test(header)) {
    header = ' ' + header;
  }
  const encoder = new TextEncoder();
  const bytes = encoder.encode(header);

  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < bytes.length ? bytes[i] : 0);
  }
}

/**
 * Builds a binary STL ArrayBuffer from indexed mesh data.
 *
 * Dereferences vertices and normals via the index buffer, computing face
 * normals from the cross product when per-vertex normals are unavailable.
 */
export function buildSTLBufferFromIndexed(
  vertices: Float32Array,
  normals: Float32Array,
  indices: Uint32Array,
  name: string = 'gridfinity-bin'
): ArrayBuffer {
  if (indices.length === 0 || indices.length % 3 !== 0) {
    throw new Error(`Indexed STL: indices length ${indices.length} must be > 0 and divisible by 3`);
  }
  if (vertices.length === 0 || vertices.length % 3 !== 0) {
    throw new Error(
      `Indexed STL: vertices length ${vertices.length} must be > 0 and divisible by 3`
    );
  }
  if (normals.length > 0 && normals.length !== vertices.length) {
    throw new Error(
      `Indexed STL: normals length ${normals.length} must be 0 or match vertices length ${vertices.length}`
    );
  }
  const vertexCount = vertices.length / 3;
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= vertexCount) {
      throw new Error(
        `Indexed STL: index ${indices[i]} at position ${i} out of range [0, ${vertexCount})`
      );
    }
  }

  const triangleCount = indices.length / 3;
  const HEADER_SIZE = 80;
  const COUNT_SIZE = 4;
  const TRIANGLE_SIZE = 50;
  const fileSize = HEADER_SIZE + COUNT_SIZE + triangleCount * TRIANGLE_SIZE;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  writeHeader(view, name);
  view.setUint32(HEADER_SIZE, triangleCount, true);

  const hasNormals = normals.length > 0;
  let offset = HEADER_SIZE + COUNT_SIZE;

  for (let tri = 0; tri < triangleCount; tri++) {
    const i0 = indices[tri * 3];
    const i1 = indices[tri * 3 + 1];
    const i2 = indices[tri * 3 + 2];

    if (hasNormals) {
      // Flat shading: first-vertex normal renormalized so STL viewers that use
      // it for shading match the cross-product fallback below.
      const nx = normals[i0 * 3];
      const ny = normals[i0 * 3 + 1];
      const nz = normals[i0 * 3 + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      view.setFloat32(offset, nx / len, true);
      view.setFloat32(offset + 4, ny / len, true);
      view.setFloat32(offset + 8, nz / len, true);
    } else {
      // Compute face normal from cross product
      const ax = vertices[i1 * 3] - vertices[i0 * 3];
      const ay = vertices[i1 * 3 + 1] - vertices[i0 * 3 + 1];
      const az = vertices[i1 * 3 + 2] - vertices[i0 * 3 + 2];
      const bx = vertices[i2 * 3] - vertices[i0 * 3];
      const by = vertices[i2 * 3 + 1] - vertices[i0 * 3 + 1];
      const bz = vertices[i2 * 3 + 2] - vertices[i0 * 3 + 2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      view.setFloat32(offset, nx / len, true);
      view.setFloat32(offset + 4, ny / len, true);
      view.setFloat32(offset + 8, nz / len, true);
    }
    offset += 12;

    // 3 vertices
    for (const vi of [i0, i1, i2]) {
      view.setFloat32(offset, vertices[vi * 3], true);
      view.setFloat32(offset + 4, vertices[vi * 3 + 1], true);
      view.setFloat32(offset + 8, vertices[vi * 3 + 2], true);
      offset += 12;
    }

    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Computes the file size in bytes for a given triangle count.
 * Useful for pre-flight checks or progress reporting.
 */
export function getSTLFileSize(triangleCount: number): number {
  return 80 + 4 + triangleCount * 50;
}
