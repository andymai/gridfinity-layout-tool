/**
 * Click-lock lid geometry constants.
 *
 * Profiles below model the standard click-lock lid geometry — a lid
 * floor with an inverted-lip mating shell underneath plus tapered click
 * rails on each straight wall.
 *
 * Coordinate convention (lid-local):
 *   Z = 0          : top surface of the lid floor
 *   Z = -topThickness : bottom of the lid floor (top of mating cavity)
 *   Z negative     : mating shell + click rails extend down
 *   Z positive     : optional Gridfinity stack grid
 *
 * All values are in millimeters.
 */

import { LIP_BIG_TAPER } from './generatorConstants';
import {
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_TOP_THICKNESS_BASE,
  LID_MAGNET_CEILING,
  LID_TRAY_FLOOR,
  LID_EXTRA_HEIGHT,
  LID_MAGNET_SEAT_GAP,
  LID_MAGNET_LIP_CLEARANCE,
  lidAnchorZ,
  lidWallBottomZ,
} from '@/shared/types/bin';

/* ──────────────────────────────────────────────────────────────────────
 * Public lid dimensions live in `@/features/bin-designer/types/lid.ts`
 * (single source of truth shared with the panel/preview). Re-exported
 * here so worker callers keep their existing import path.
 * ──────────────────────────────────────────────────────────────────────── */

export {
  LID_CORNER_RADIUS,
  LID_FIT_CLEARANCE,
  LID_TOP_THICKNESS_BASE,
  LID_MAGNET_CEILING,
  LID_TRAY_FLOOR,
  // Anchor math + seat gap live in the shared types module so the main thread
  // (compatibility checks, preview) can use the same formula the worker does.
  LID_EXTRA_HEIGHT,
  LID_MAGNET_SEAT_GAP,
  LID_MAGNET_LIP_CLEARANCE,
  lidAnchorZ,
  lidWallBottomZ,
};

/** Side-wall thickness in the lip-mating zone. Derived: the outer chamfer
 *  steps inward by `LIP_BIG_TAPER` and the inner cavity face sits at
 *  `LID_CORNER_RADIUS - LID_FIT_CLEARANCE`, so the wall is
 *  `(LID_CORNER_RADIUS - LID_FIT_CLEARANCE) - LIP_BIG_TAPER = 1.85mm`. */
export const LID_WALL_THICKNESS = LID_CORNER_RADIUS - LID_FIT_CLEARANCE - LIP_BIG_TAPER;

/* Floor-plate thickness and the cavity depth it consumes are resolved from
 * BinParams in `@/shared/types/bin` (`resolveLidPlateThickness` /
 * `resolveLidCavityExtraMm`) — the preview, thumbnail, and export assembly
 * need them too, and a second copy here would drift.
 */

/* ──────────────────────────────────────────────────────────────────────
 * Click rail cross-section dimensions (X = outward from corner-radius
 * line, Y = vertical). The polygon protrudes OUTWARD (positive X) to form
 * the rail bump that catches the lip's bottom chamfer when the lid clicks on.
 *
 * Body shape (top to bottom):
 *   - Top entry chamfer at TOP_CHAMFER thick lets the lid slide on smoothly
 *   - Bump face protrudes by OUT, then drops in by INSET via ENTRY_CHAMFER
 *   - Vertical rail body for BUMP + 0.1mm
 *   - Exit chamfer relieves geometry past the bump
 *   - Drop + tail provide structural depth below
 *   - Inner face (INNER) pushes into the bin cavity for grip
 * ──────────────────────────────────────────────────────────────────────── */

// Rail depth constants live in `types/lid` so the preview can reach them
// without pulling in brepjs; re-exported here to keep worker import paths.
export {
  LID_CLICK_RAIL_BUMP,
  LID_CLICK_RAIL_ENTRY_CHAMFER,
  LID_CLICK_RAIL_EXIT_CHAMFER,
  LID_CLICK_RAIL_DROP,
  LID_CLICK_RAIL_TAIL,
  LID_CLICK_RAIL_SHOULDER,
  LID_CLICK_RAIL_DROP_BELOW_WALL,
} from '@/shared/types/bin';

/** How far the rail's outer face protrudes from the corner-radius line. */
export const LID_CLICK_RAIL_OUT = 1.85;
/** Inward shift for the rail's body relative to outer protrusion. */
export const LID_CLICK_RAIL_INSET = 0.8;
/** Inner face of the rail (inside the bin cavity). */
export const LID_CLICK_RAIL_INNER = -0.8;
/** Top entry chamfer (lid slides over lip easily). */
export const LID_CLICK_RAIL_TOP_CHAMFER = 0.8;

/* ──────────────────────────────────────────────────────────────────────
 * Magnet positions are shared with the bin base via magnetPositionsForCell
 * (see lidMagnets.ts), so the lid holes always line up with the sockets of a
 * bin stacked on top — including the wall-distance clamp on small/non-square
 * cells. No lid-local offset constant is kept, to avoid the two drifting.
 * ──────────────────────────────────────────────────────────────────────── */

/** Coplanar margin used at boolean cut/fuse interfaces. */
export const LID_COPLANAR_MARGIN = 0.1;

/* ──────────────────────────────────────────────────────────────────────
 * Lid-retention magnets (issue #2694). Four corner magnets bond the lid
 * down onto the bin — a bin-side post rising to the lip top and a lid-side
 * boss hanging to meet it. Shared placement lives in
 * `retentionMagnetGeometry.ts`.
 * ──────────────────────────────────────────────────────────────────────── */

/** Radial plastic kept around a retention magnet inside its post/boss (mm).
 *  1.0mm (2–3 perimeters at a 0.4mm nozzle) keeps the corner post slim: because
 *  the magnet inset is `LID_MAGNET_LIP_CLEARANCE + bossRadius`, a thinner wall pulls the
 *  post's cavity-facing edge inboard (~1mm per 0.5mm of wall) while the boss's
 *  lip-side edge and the magnet mating stay put. */
export const LID_MAGNET_BOSS_WALL = 1.0;

/* `LID_MAGNET_LIP_CLEARANCE` is re-exported from the shared types module above
 * — the panel and the grip-relief depth clamp need it on the main thread. */

/** Retaining floor kept below a bin-post magnet pocket (mm). */
export const LID_MAGNET_POST_FLOOR = 0.6;

/** Tiny safety floor for rounded rectangle corner radii (avoids OCCT
 *  degeneracy when an inner inset equals the outer corner radius). */
export const LID_MIN_CORNER_RADIUS = 0.1;
