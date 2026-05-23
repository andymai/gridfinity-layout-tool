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
 * @throws If the mesh is empty (zero triangles — emits spec-invalid 3MF/STL)
 * @throws If vertex count is not divisible by 9 (incomplete triangles)
 * @throws If normals length doesn't match vertices length
 */
export function validateMeshData(vertices: Float32Array, normals: Float32Array): void {
  // 3MF Core spec requires `<vertex>` minOccurs=3 and `<triangle>` minOccurs=1.
  // STL binary is technically valid with 0 triangles, but slicers reject it.
  // Reject at the shared boundary so neither path emits an unusable file.
  if (vertices.length === 0) {
    throw new Error(
      'Cannot export empty mesh (0 triangles): slicers reject empty meshes and 3MF Core spec forbids them'
    );
  }
  if (vertices.length % 9 !== 0) {
    throw new Error(`Invalid vertex count: ${vertices.length} is not divisible by 9`);
  }
  if (normals.length !== vertices.length) {
    throw new Error(`Normal/vertex length mismatch: ${normals.length} vs ${vertices.length}`);
  }
}
