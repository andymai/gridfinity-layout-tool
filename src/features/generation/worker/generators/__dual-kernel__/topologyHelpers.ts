/**
 * Reusable helpers for inspecting BREP topology via the raw brepkit kernel.
 *
 * These helpers encapsulate the repetitive face/edge iteration + type
 * classification pattern used across diagnostic and parity tests.
 */
import type { RawBrepkitKernel } from './dualKernelInit';

/** Collect face surface type breakdown for a solid. */
export function collectFaceTypeBreakdown(
  rawKernel: RawBrepkitKernel,
  solidId: number
): Record<string, number> {
  const faces = Array.from(rawKernel.getSolidFaces(solidId));
  const types: Record<string, number> = {};
  for (const fid of faces) {
    try {
      const t = rawKernel.getSurfaceType(fid);
      types[t] = (types[t] ?? 0) + 1;
    } catch {
      /* unsupported surface type */
    }
  }
  return types;
}

/** Collect edge curve type breakdown for a solid. */
export function collectEdgeTypeBreakdown(
  rawKernel: RawBrepkitKernel,
  solidId: number
): Record<string, number> {
  const edges = Array.from(rawKernel.getSolidEdges(solidId));
  const types: Record<string, number> = {};
  for (const eid of edges) {
    try {
      const t = rawKernel.getEdgeCurveType(eid);
      types[t] = (types[t] ?? 0) + 1;
    } catch {
      /* unsupported curve type */
    }
  }
  return types;
}

/** Collect wire edge curve type breakdown. */
export function collectWireEdgeTypes(
  rawKernel: RawBrepkitKernel,
  wireId: number
): { count: number; types: Record<string, number> } {
  const edges = Array.from(rawKernel.getWireEdges(wireId));
  const types: Record<string, number> = {};
  for (const eid of edges) {
    try {
      const t = rawKernel.getEdgeCurveType(eid);
      types[t] = (types[t] ?? 0) + 1;
    } catch {
      /* unsupported curve type */
    }
  }
  return { count: edges.length, types };
}

/** Get entity counts as a named object (instead of raw array). */
export function getEntityCounts(
  rawKernel: RawBrepkitKernel,
  solidId: number
): { faces: number; edges: number; verts: number } {
  const c = rawKernel.getEntityCounts(solidId);
  return { faces: c[0], edges: c[1], verts: c[2] };
}

/** Sum all values in a type breakdown record. */
export function totalCount(breakdown: Record<string, number>): number {
  return Object.values(breakdown).reduce((a, b) => a + b, 0);
}
