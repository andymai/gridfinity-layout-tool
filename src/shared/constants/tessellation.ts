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

/** Angular tolerance (RADIANS) for analytic edge-line sampling via `meshEdges`
 *  on extract-time kernels. UNITS MATTER: the brepkit kernel reads this as
 *  radians (its own default is ~0.35 rad ≈ 20°), so a degrees-magnitude value
 *  (e.g. 4) reads as ~229° and disables curve refinement entirely. ~0.02 rad
 *  (≈1.1°) keeps rounded corners / lip rims / scoop arcs smooth, ≈ OCCT curve
 *  density. OCCT ignores this arg (its edges follow the linear tolerance), so
 *  it only affects brepkit. Build-time (manifold) edges use creaseEdges instead
 *  and are unaffected. */
export const EDGE_ANGULAR_TOLERANCE_RAD = 0.02;
