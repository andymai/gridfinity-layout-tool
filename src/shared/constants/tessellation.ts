/**
 * Tessellation / edge constants shared by the generation worker (draft crease
 * edge extraction) and the client renderer (normal splitting + edge fallback).
 *
 * COUPLING: the manifold draft tessellates curves into flat facets. The worker
 * extracts edges wherever the angle between adjacent face normals exceeds
 * CREASE_ANGLE_DEG. So the draft's per-facet circular angle MUST stay below
 * CREASE_ANGLE_DEG — otherwise every curve facet becomes an edge (longitudinal
 * wireframe noise). Keep DRAFT_MIN_CIRCULAR_ANGLE_DEG comfortably under it.
 */

/** Dihedral/crease threshold (degrees). Catches lip chamfers (~45°) and curve
 *  rims (90°) while leaving sub-threshold facets smooth. */
export const CREASE_ANGLE_DEG = 35;

/** Same threshold in radians (for THREE normal splitting). */
export const CREASE_ANGLE_RAD = (CREASE_ANGLE_DEG * Math.PI) / 180;

/** Manifold draft min circular angle (degrees per facet). Lower = rounder
 *  curves, slower draft. MUST stay below CREASE_ANGLE_DEG (see COUPLING). */
export const DRAFT_MIN_CIRCULAR_ANGLE_DEG = 20;
