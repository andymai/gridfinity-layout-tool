/**
 * Mesh conversion utilities and helpers for the bin generation pipeline.
 *
 * Provides progress callback types, boolean options, sketch helpers,
 * cancellation checks, and mesh format conversion.
 */

import type { Drawing, PlaneName, SketchInterface, BooleanOptions } from 'brepjs';
import type { MeshData } from '../../bridge/types';

// ─── Progress Callback ───────────────────────────────────────────────────────

/** Progress callback for reporting generation stages */
export type ProgressFn = (stage: string, progress: number) => void;

// ─── Boolean Options Type ────────────────────────────────────────────────────

/** Boolean operation options including AbortSignal for cancellation. */
export type BooleanOpts = BooleanOptions;

// ─── Sketch Helper ───────────────────────────────────────────────────────────

/**
 * Sketch a drawing on a plane, narrowing to SketchInterface.
 * All our drawings are single closed wires, so SketchInterface is always the
 * correct runtime type. This eliminates repeated `as SketchInterface` casts.
 */
export function sketch(drawing: Drawing, plane?: PlaneName, origin?: number): SketchInterface {
  return drawing.sketchOnPlane(plane, origin) as SketchInterface;
}

// ─── Cancellation ────────────────────────────────────────────────────────────

/** Throw if the AbortSignal has been triggered (mid-operation cancellation). */
export function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Generation cancelled', 'AbortError');
}

// ─── Mesh Conversion ─────────────────────────────────────────────────────────

/**
 * Convert brepjs indexed mesh to our MeshData format, keeping indexed representation.
 *
 * @param meshResult brepjs mesh with indexed vertices/normals/triangles
 * @param skipNormals If true, returns empty normals array (GPU will compute flat shading)
 */
export function toIndexedMeshData(
  meshResult: {
    vertices: ArrayLike<number>;
    normals: ArrayLike<number>;
    triangles: ArrayLike<number>;
    faceGroups?: ReadonlyArray<{ start: number; count: number; faceId: number; origin?: number }>;
  },
  skipNormals = false,
  edgeVertices?: ArrayLike<number>,
  originToTag?: ReadonlyMap<number, number>
): MeshData {
  const faceGroups = meshResult.faceGroups?.map((g) => ({
    start: g.start,
    count: g.count,
    tag: (g.origin !== undefined ? originToTag?.get(g.origin) : undefined) ?? 255, // FeatureTag.UNKNOWN
  }));

  const toFloat32Array = (data: ArrayLike<number>): Float32Array =>
    data instanceof Float32Array ? data : new Float32Array(data);

  const toUint32Array = (data: ArrayLike<number>): Uint32Array =>
    data instanceof Uint32Array ? data : new Uint32Array(data);

  return {
    vertices: toFloat32Array(meshResult.vertices),
    normals: skipNormals ? new Float32Array(0) : toFloat32Array(meshResult.normals),
    indices: toUint32Array(meshResult.triangles),
    edgeVertices: edgeVertices ? toFloat32Array(edgeVertices) : new Float32Array(0),
    triangleCount: meshResult.triangles.length / 3,
    faceGroups,
  };
}
