/**
 * Mesh-based STL serialization — a fallback for OCCT's `StlAPI.Write`.
 *
 * OCCT's STL writer silently rejects some valid-but-tricky topologies that
 * `mesh()` triangulates cleanly (scoop ramp + tall walls #1760, scoop cusp
 * rims #1850, and assorted user feature combinations that surface in
 * production as `STL_EXPORT_FAILED`). Writing STL ourselves from the meshed
 * triangle buffer removes the dependency on OCCT's writer: it runs on the
 * exact same triangles the preview already renders cleanly, so it succeeds
 * whenever the preview does.
 *
 * The split-bin export path (`splitBinBuilder`) has bypassed OCCT this way
 * since #1760; this shares that proven path with the single-piece exporter.
 */

import { mesh, exportSTL } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { buildSTLBufferFromIndexed } from '@/features/generation/export/stlExporter';
import { unwrapExportBlob } from './exportUnwrap';

/**
 * Tessellate `solid` and serialize it to a binary STL ArrayBuffer, bypassing
 * OCCT's STL writer entirely.
 *
 * Tolerances must match the caller's so the triangles (and any parallel
 * `faceGroups` derived from the same `mesh()` call) line up.
 */
export function exportSolidMeshToStl(
  solid: Shape3D,
  name: string,
  tolerance: number,
  angularTolerance: number
): ArrayBuffer {
  const m = mesh(solid, { tolerance, angularTolerance, cache: true });
  const vertices = m.vertices instanceof Float32Array ? m.vertices : new Float32Array(m.vertices);
  const normals = m.normals instanceof Float32Array ? m.normals : new Float32Array(m.normals);
  const indices = m.triangles instanceof Uint32Array ? m.triangles : new Uint32Array(m.triangles);
  return buildSTLBufferFromIndexed(vertices, normals, indices, name);
}

/**
 * Export `solid` to a binary STL ArrayBuffer, trying OCCT's writer first and
 * falling back to the meshed-triangle writer when OCCT rejects the geometry.
 *
 * OCCT stays primary so successful exports remain byte-identical (and 3MF
 * face-group alignment, which depends on OCCT's tessellation cache, is
 * preserved). The fallback only runs on failure, recovering exports that would
 * otherwise hard-fail with `STL_EXPORT_FAILED`. If meshing also fails, the
 * geometry is genuinely unexportable; rethrow OCCT's actionable error.
 */
export async function exportSolidToStl(
  solid: Shape3D,
  name: string,
  tolerance: number,
  angularTolerance: number
): Promise<ArrayBuffer> {
  try {
    const blob = unwrapExportBlob(
      exportSTL(solid, { tolerance, angularTolerance, binary: true }),
      'STL'
    );
    return await blob.arrayBuffer();
  } catch (occtStlError) {
    try {
      return exportSolidMeshToStl(solid, name, tolerance, angularTolerance);
    } catch (meshFallbackError) {
      // Both writers failed — the geometry is genuinely unexportable. Rethrow
      // OCCT's error (its message carries the user-facing actionable hint, and
      // its `cause` the structured BrepError), but record the fallback failure
      // on a separate property so telemetry can tell "OCCT failed, fallback
      // also failed" apart from "OCCT failed, fallback succeeded".
      if (occtStlError instanceof Error) {
        (occtStlError as Error & { meshFallbackCause?: unknown }).meshFallbackCause =
          meshFallbackError;
      }
      throw occtStlError;
    }
  }
}
