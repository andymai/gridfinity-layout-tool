/**
 * STL Export Utilities
 *
 * Exports Three.js geometry as STL files for 3D printing.
 * Uses the STLExporter from Three.js examples.
 */

import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export interface STLExportOptions {
  /** Use binary STL format (default: true, more compact) */
  binary?: boolean;
}

/**
 * Convert a BufferGeometry to STL data.
 *
 * @param geometry - The Three.js BufferGeometry to export
 * @param options - Export options
 * @returns DataView for binary STL, string for ASCII STL
 */
export function geometryToSTL(
  geometry: THREE.BufferGeometry,
  options: STLExportOptions = {}
): DataView | string {
  const { binary = true } = options;

  // STLExporter requires a Mesh, not just geometry
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  const exporter = new STLExporter();
  const result = exporter.parse(mesh, { binary });

  // Clean up the temporary material
  material.dispose();

  return result;
}

/**
 * Download a BufferGeometry as an STL file.
 *
 * @param geometry - The Three.js BufferGeometry to export
 * @param filename - The filename (should end with .stl)
 * @param options - Export options
 */
export function downloadGeometryAsSTL(
  geometry: THREE.BufferGeometry,
  filename: string,
  options: STLExportOptions = {}
): void {
  const { binary = true } = options;
  const stlData = geometryToSTL(geometry, { binary });

  // Create blob with appropriate MIME type
  // Binary STL returns DataView - extract underlying ArrayBuffer
  const blob = binary
    ? new Blob([(stlData as DataView).buffer as ArrayBuffer], {
        type: 'application/octet-stream',
      })
    : new Blob([stlData as string], { type: 'text/plain' });

  // Use the standard download pattern
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.stl') ? filename : `${filename}.stl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
