/**
 * Vertical keep-outs on a bin's outer wall face.
 *
 * Shared because two things now place features into the same band and must
 * agree on where it ends: the wall pattern (which is cut from it) and wall
 * text (which is cut into it and clears pattern behind itself). They live here
 * rather than in the worker so the designer's ghost overlay can resolve the
 * same band without importing the geometry kernel.
 */

/** Keep-out from the wall top edge (stacking-lip interface), in mm. */
export const TOP_KEEP_OUT = 1.5;

/** Solid border kept around a wall cutout, in mm. */
export const CUTOUT_BORDER_WIDTH = 1.5;

/**
 * Solid skirt left ABOVE the interior floor before a feature starts (mm).
 *
 * The bottom keep-out is `wallThickness + this`: one `wallThickness` clears the
 * floor slab, and the skirt is the actual solid band the lowest hex row anchors
 * to. Without it the lowest webs rise straight off the wall-floor seam as
 * unanchored fins and snap during FDM printing. Sized to match
 * {@link TOP_KEEP_OUT} and {@link CUTOUT_BORDER_WIDTH} (~7 layers at 0.2mm),
 * the minimum band that prints reliably while preserving the most hex rows.
 */
export const BOTTOM_SOLID_SKIRT = 1.5;
