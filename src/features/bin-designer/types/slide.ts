/**
 * Sliding tray: a rail carried by the bin plus a companion tray that rides on
 * it, so a shallow tray can be pushed aside to reach what sits underneath.
 *
 * The rail runs along the FRONT and BACK walls, so the tray travels in X. That
 * is what makes the multi-bin case work without the layout knowing anything: a
 * rail spanning a bin's full length meets its neighbour's rail when two railed
 * bins are placed side by side, so a wide tray simply rides across both. The
 * ~8mm interruption at each junction (two corner radii plus the standard
 * bin-to-bin clearance) is bridged by any tray wider than a single unit.
 *
 * Not to be confused with `LidConfig.tray`, which turns a LID into a shallow
 * tray and does not slide.
 */

/**
 * Where the rail sits, which decides whether a tray can leave its own bin.
 *
 *  - `interior` — a ledge protruding inward from the front/back walls, below
 *    the rim. The tray drops into the bin. Travel is bounded by this bin's own
 *    side walls, so it never crosses to a neighbour.
 *  - `rim` — a rebate on top of the front/back walls. The tray rides above the
 *    rim and crosses freely between adjacent railed bins, which is the
 *    "two tall bins with a tray sliding over both" arrangement.
 */
export type SlideRailMount = 'interior' | 'rim';

export const SLIDE_RAIL_MOUNTS: readonly SlideRailMount[] = ['interior', 'rim'];

export interface SlideConfig {
  /** Master toggle. When false no rail is cut and no tray is generated. */
  readonly enabled: boolean;
  readonly railMount: SlideRailMount;
  /**
   * Tray width in GRID UNITS, not mm, and deliberately independent of the
   * host's width: a tray narrower than its bin can slide within it, and a tray
   * wider than its bin is the multi-bin case. Fractional halves are allowed to
   * match the rest of the app's half-grid support.
   */
  readonly trayWidthUnits: number;
  /** Tray interior depth (how deep the tray's own cavity is), mm. */
  readonly trayDepthMm: number;
  /** Tray wall thickness, mm. */
  readonly trayWallMm: number;
  /**
   * Rail top measured DOWN from the bin rim, mm. Zero puts the rail's top
   * flush with the rim. The generator additionally pushes an `interior` rail
   * clear of the stacking lip, which reaches further down the wall than its
   * own height suggests.
   */
  readonly railDropMm: number;
  /** How far the rail protrudes from the wall it is carried by, mm. */
  readonly railProtrusionMm: number;
  /** Rail thickness in Z, mm. */
  readonly railThicknessMm: number;
  /**
   * Gap held on EVERY face between rail and groove, mm.
   *
   * Deliberately its own number rather than the shared `CLEARANCE` (0.5mm):
   * that constant describes the bin-to-baseplate seating fit and is free to
   * move with the Gridfinity spec, while this one is the number a user tunes
   * against their own printer until the tray slides without rattling.
   */
  readonly clearanceMm: number;
}

export const SLIDE_CONSTRAINTS = {
  MIN_TRAY_WIDTH_UNITS: 0.5,
  MAX_TRAY_WIDTH_UNITS: 16,
  MIN_TRAY_DEPTH_MM: 3,
  MAX_TRAY_DEPTH_MM: 140,
  MIN_TRAY_WALL_MM: 0.4,
  MAX_TRAY_WALL_MM: 2.4,
  MIN_RAIL_DROP_MM: 0,
  MAX_RAIL_DROP_MM: 140,
  MIN_RAIL_PROTRUSION_MM: 0.8,
  MAX_RAIL_PROTRUSION_MM: 6,
  MIN_RAIL_THICKNESS_MM: 0.8,
  MAX_RAIL_THICKNESS_MM: 6,
  MIN_CLEARANCE_MM: 0.1,
  MAX_CLEARANCE_MM: 2,
} as const;

/**
 * Defaults chosen so enabling the feature on a stock bin produces something
 * printable without further tuning:
 *
 * - `interior` mount: it matches the arrangement the ecosystem actually
 *   builds (a tray sliding within one bin), so someone enabling the feature
 *   blind gets the mechanism that is known to work. `rim` remains available
 *   for the multi-bin case the request described.
 * - `clearanceMm: 0.25` — the SAME per-side gap Gridfinity itself uses (a
 *   41.5mm foot in a 42mm cell is 0.5mm total), so a printer already calibrated
 *   to seat bins in a baseplate needs no retuning. It is deliberately a little
 *   LOOSER than the usual FDM sliding fit (0.1-0.2mm per side), which is the
 *   right direction for a tray up to 250mm long: over that span binding is a
 *   worse failure than a little play, and warp adds error the short Gridfinity
 *   foot never sees. It matches what entry-level printers are advised to use
 *   (0.2-0.25mm per side).
 * - `railProtrusion` 2mm on a 1.2mm wall gives a shelf that supports the tray
 *   without eating the cavity.
 */
export const DEFAULT_SLIDE_CONFIG: SlideConfig = {
  enabled: false,
  railMount: 'interior',
  trayWidthUnits: 1,
  trayDepthMm: 20,
  trayWallMm: 1.2,
  // Sinks the default tray fully inside a bin rather than leaving it standing
  // ~18mm proud of the rim. Matches `trayDepthMm` + a millimetre; a user who
  // changes the tray depth has to revisit this, which the panel should warn on.
  railDropMm: 21,
  railProtrusionMm: 2,
  railThicknessMm: 2,
  clearanceMm: 0.25,
} as const;
