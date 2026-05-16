// BOSL2 rabbit_clip — battle-tested parametric snap connector for joining flat
// panels. https://github.com/BelfrySCAD/BOSL2/blob/master/joiners.scad
//
// A flat clip with two flexible ears. Two halves back-to-back ("double" form)
// straddle a seam: one half slides into each piece's socket. Inserting the
// clip squeezes the ears past the socket's waist; they spring back into the
// wider mid-section and lock there until squeezed again. Slicer setting that
// makes the ears actually flex: 2 wall loops, 0 % top/bottom, 0 % infill.

/** Slab-floor thickness above magnet pockets (mm). Shared with the worker
 *  generator's local MAGNET_FLOOR. */
export const MAGNET_FLOOR_MM = 0.5;

/** Half-clip length — depth one pin half penetrates a piece's socket (mm).
 *  Matches gridfinity-risers (2 z-units = 14 mm). */
export const SNAP_CLIP_LENGTH = 14;

/** Clip width across the ears (mm). Spans 1 grid-cell of the seam at default
 *  gridfinity 42 mm pitch — one clip per cell-boundary along a join edge. */
export const SNAP_CLIP_WIDTH = 14;

/** Clip vertical extrusion / socket depth (mm). Chosen so the slab still has
 *  ≥ 1 mm of material both above and below the pocket on a default-thickness
 *  slab (≈ 5.5 mm with magnets off). */
export const SNAP_CLIP_DEPTH = 3;

/** Ear-snap depth — how far the side bows in at the waist (mm). 0.25 = easy
 *  release, 0.75 = medium grip (gridfinity-risers default), 1.0+ = firm. */
export const SNAP_CLIP_SNAP = 0.75;

/** Clip wall thickness (mm). 1.6 mm ≈ 2 perimeters on a 0.4 mm nozzle. The
 *  clip prints as a thin-walled shell so the ears can flex elastically. */
export const SNAP_CLIP_THICKNESS = 1.6;

/** Ear over-width past nominal (mm). The pin is wider than the socket by
 *  this much at the ears; the resulting interference is what makes the snap
 *  press home with tension instead of slop. */
export const SNAP_CLIP_COMPRESSION = 0.2;

/** Per-side socket-to-pin clearance in the 2D outline (mm). Compensates for
 *  FDM tolerance on the horizontal extrusion plane. */
export const SNAP_CLIP_CLEARANCE = 0.1;

/** Extra socket depth past the clip depth (mm). Per BOSL2 docs: "Be sure to
 *  make the socket with a larger depth than the clip (try 0.4 mm) to allow
 *  ease of insertion." */
export const SNAP_CLIP_DEPTH_CLEARANCE = 0.4;
