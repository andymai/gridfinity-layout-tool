/**
 * Binary STL parser for extracting mesh arrays.
 *
 * Used to convert worker-generated STL data into vertex/normal arrays
 * suitable for 3MF export via threemfExporter.
 *
 * Binary STL format:
 *   Header:  80 bytes
 *   Count:   4 bytes (uint32 LE)
 *   Per tri: 50 bytes (normal 3×f32 + 3 vertices × 3×f32 + attr uint16)
 */

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
 * @throws If the buffer is too small or triangle count doesn't match buffer size
 */
export function parseSTLBinary(buffer: ArrayBuffer): ParsedSTLMesh {
  if (buffer.byteLength < MIN_FILE_SIZE) {
    throw new Error(`Invalid STL: buffer too small (${buffer.byteLength} bytes)`);
  }

  const view = new DataView(buffer);
  const triangleCount = view.getUint32(COUNT_OFFSET, true);

  const payloadBytes = buffer.byteLength - MIN_FILE_SIZE;

  // Ensure payload length aligns with fixed per-triangle record size
  if (payloadBytes % TRIANGLE_SIZE !== 0) {
    throw new Error(
      `Invalid STL: payload size (${payloadBytes} bytes) is not a multiple of triangle record size (${TRIANGLE_SIZE} bytes)`
    );
  }

  const expectedSize = MIN_FILE_SIZE + triangleCount * TRIANGLE_SIZE;
  if (buffer.byteLength !== expectedSize) {
    const actualTriangleCount = payloadBytes / TRIANGLE_SIZE;
    throw new Error(
      `Invalid STL: triangle count header (${triangleCount}) does not match payload (${actualTriangleCount} triangles)`
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

  return { vertices, normals };
}
