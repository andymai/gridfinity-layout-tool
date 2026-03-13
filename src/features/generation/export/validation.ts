/**
 * Shared mesh data validation for export formats (STL, 3MF).
 *
 * Centralizes the vertex/normal array checks that were duplicated
 * across stlExporter.ts and threemfExporter.ts.
 */

/**
 * Validates mesh data arrays before export.
 *
 * @param vertices - Flat vertex array (every 9 floats = 1 triangle, 3 vertices x XYZ)
 * @param normals - Flat normal array (must match vertices length)
 * @throws If vertex count is not divisible by 9 (incomplete triangles)
 * @throws If normals length doesn't match vertices length
 */
export function validateMeshData(vertices: Float32Array, normals: Float32Array): void {
  if (vertices.length % 9 !== 0) {
    throw new Error(`Invalid vertex count: ${vertices.length} is not divisible by 9`);
  }
  if (normals.length !== vertices.length) {
    throw new Error(`Normal/vertex length mismatch: ${normals.length} vs ${vertices.length}`);
  }
}
