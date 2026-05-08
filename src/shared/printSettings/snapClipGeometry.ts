// Snap clip = small arched saddle that sits on the slab top at every grid
// boundary along a join edge. Two short pegs hang from its underside and
// drop into shallow blind holes — one peg in each adjacent piece, straddling
// the seam. No through-cuts, no recess. Whole part is ~6×4mm in plan.

/** Slab-floor thickness above magnet pockets (mm). Mirrors `MAGNET_FLOOR`
 *  in the worker generator's local constants. */
export const MAGNET_FLOOR_MM = 0.5;

/** Peg shaft diameter (mm). Small for a tight friction fit in PETG. */
export const SNAP_PEG_DIAMETER = 1.5;

/** Distance from the seam to each peg's centerline (mm). The two pegs
 *  straddle the seam at ±SNAP_PEG_INSET. */
export const SNAP_PEG_INSET = 2.0;

/** How far the peg projects below the saddle's underside (mm). Sized to
 *  bottom out comfortably above the pocket floor even with magnets enabled. */
export const SNAP_PEG_LENGTH = 2.0;

/** Saddle base length across the seam (mm). Total = 2 * (INSET + MARGIN). */
export const SNAP_SADDLE_LENGTH_MARGIN = 1.0;

/** Saddle width along the seam (mm). */
export const SNAP_SADDLE_WIDTH = 4.0;

/** Saddle base block height before the arch begins (mm). */
export const SNAP_SADDLE_BASE_HEIGHT = 1.5;

/** Arch rise above the saddle base (mm). The arch is a half-cylinder
 *  capping the top, giving the clip its rounded silhouette. */
export const SNAP_SADDLE_ARCH_RISE = 1.5;

/** Per-side clearance between peg and blind hole (mm). */
export const SNAP_HOLE_CLEARANCE = 0.15;

/** Computed blind-hole diameter cut into the slab top. */
export const SNAP_HOLE_DIAMETER = SNAP_PEG_DIAMETER + 2 * SNAP_HOLE_CLEARANCE;

/** Hole depth into the slab top (mm). Slightly deeper than the peg so the
 *  saddle seats flush regardless of FDM layer roundoff at the hole bottom. */
export const SNAP_HOLE_DEPTH = SNAP_PEG_LENGTH + 0.3;

/** Per-side clearance between the saddle base and its slab-top recess (mm). */
export const SNAP_RECESS_CLEARANCE = 0.2;

/** Slab-top recess depth — equals the saddle base height so the saddle's
 *  shoulder sits flush with the slab top, leaving only the arch raised. */
export const SNAP_RECESS_DEPTH = SNAP_SADDLE_BASE_HEIGHT;
