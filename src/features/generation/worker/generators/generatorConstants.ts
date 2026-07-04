/**
 * Gridfinity specification constants used across generator modules.
 *
 * All values are in millimeters unless otherwise noted.
 * Sources: Gridfinity spec v5, measured from reference models.
 */

import { GRIDFINITY } from '@/shared/constants/bin';
import { OVER_TILE_MIN_MARGIN_MM, SOLID_FLOOR_DEFAULT_MM } from '@/core/constants';
import { clamp } from '@/shared/utils/math';
export const SIZE = GRIDFINITY.GRID_SIZE;
export const HEIGHT_UNIT = GRIDFINITY.HEIGHT_UNIT;
export const CLEARANCE = GRIDFINITY.TOLERANCE;
export const CORNER_RADIUS = GRIDFINITY.SOCKET_CORNER_RADIUS;
export const BOX_CORNER_RADIUS = GRIDFINITY.BOX_CORNER_RADIUS;
export const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;
export const SOCKET_SMALL_TAPER = GRIDFINITY.SOCKET_SMALL_TAPER;
export const SOCKET_BIG_TAPER = GRIDFINITY.SOCKET_BIG_TAPER;
export const SOCKET_VERTICAL_PART = SOCKET_HEIGHT - SOCKET_SMALL_TAPER - SOCKET_BIG_TAPER;
export const SOCKET_TAPER_WIDTH = SOCKET_SMALL_TAPER + SOCKET_BIG_TAPER;
export const TOP_FILLET = GRIDFINITY.TOP_FILLET;
export const LIP_SMALL_TAPER = GRIDFINITY.LIP_SMALL_TAPER; // 0.7mm bottom chamfer
export const LIP_VERTICAL_PART = GRIDFINITY.LIP_VERTICAL_PART; // 1.8mm vertical
export const LIP_BIG_TAPER = GRIDFINITY.LIP_BIG_TAPER; // 1.9mm top chamfer
export const LIP_HEIGHT = LIP_SMALL_TAPER + LIP_VERTICAL_PART + LIP_BIG_TAPER; // 4.4mm total
export const LIP_TAPER_WIDTH = LIP_SMALL_TAPER + LIP_BIG_TAPER; // 2.6mm horizontal inset
export const LIP_OVERLAP = GRIDFINITY.LIP_OVERLAP;

/** Corner radius for baseplate outer perimeter (same as socket corner radius) */
export const PLATE_CORNER_RADIUS = CORNER_RADIUS;

/** Thin floor under each magnet hole — retains the magnet (mm) */
export const MAGNET_FLOOR = 0.5;

/**
 * Height of solid floor left under the baseplate sockets, in mm — the single
 * source of truth for the pocket-depth-vs-slab-height relationship shared by the
 * BREP build, the direct-mesh draft, and the split/connector heights.
 *
 * Two independent contributions, summed so the plate height is predictable:
 *   - Magnets need a retaining floor (MAGNET_FLOOR + magnetDepth) to seat in.
 *   - The `solidFloor` option adds its chosen thickness *below* that — the plate
 *     grows by exactly the floor thickness, and it keeps the underside continuous
 *     (see the lightweight suppression in the generator).
 * The blind magnet holes are always cut magnetDepth deep from the socket bottom,
 * so the extra solid floor just adds retaining material below them (both the BREP
 * build and the direct-mesh draft anchor the hole the same way). Neither on =
 * through-cut (0).
 */
export function baseplateFloorDepth(params: {
  readonly magnetHoles: boolean;
  readonly magnetDepth: number;
  readonly solidFloor?: boolean;
  readonly solidFloorThickness?: number;
}): number {
  const magnetFloor = params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0;
  const solidFloor = params.solidFloor ? (params.solidFloorThickness ?? SOLID_FLOOR_DEFAULT_MM) : 0;
  return magnetFloor + solidFloor;
}

/**
 * Smallest printable clipped grid tile / edge foot (mm). Below this the tapered
 * socket profile's insets collapse, so a fractional remainder this narrow is
 * dropped (flat bottom) or falls back to solid padding. Aliases the shared
 * `OVER_TILE_MIN_MARGIN_MM` so the worker geometry and the baseplate UI's
 * per-side tiling feedback can't drift.
 */
export const MIN_PRINTABLE_TILE_MM = OVER_TILE_MIN_MARGIN_MM;

/** Z extension above/below to avoid coplanar boolean failures (mm). */
export const COPLANAR_MARGIN = 1;

/**
 * Tiny volumetric overlap between mating solids at a fuse/cut interface.
 * Defeats OCCT's coplanar-face handling, which otherwise produces
 * non-manifold topology that slicers repair as solid infill.
 * Used by slot cutters (slotBuilder) and dovetail tongues (baseplateGenerator).
 */
export const COPLANAR_OVERLAP = 0.01;

/** Distance from cell center to magnet position (Gridfinity spec, mm) */
export const HOLE_OFFSET = 13;

/** Inset at pocket bottom (same taper profile as bin socket at full cell size) */
export const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

/** Magnet position offsets relative to cell center (4 corners per cell) */
export const MAGNET_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-HOLE_OFFSET, -HOLE_OFFSET],
  [HOLE_OFFSET, -HOLE_OFFSET],
  [HOLE_OFFSET, HOLE_OFFSET],
  [-HOLE_OFFSET, HOLE_OFFSET],
];

/** Compute pocket corner radius for a given cell size (clamped to fit) */
export function pocketCornerRadius(cellW_mm: number, cellD_mm: number): number {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  return Math.min(CORNER_RADIUS, maxRadius);
}

/**
 * Resolve per-corner radii from params, applying defaults and clamping.
 * Priority: cornerRadii > cornerRadius > PLATE_CORNER_RADIUS (spec default).
 */
export function resolveCornerRadii(
  params: {
    cornerRadius?: number;
    cornerRadii?: { tl: number; tr: number; bl: number; br: number };
  },
  maxRadius: number
): { tl: number; tr: number; bl: number; br: number } {
  const defaultR = params.cornerRadius ?? PLATE_CORNER_RADIUS;
  const radii = params.cornerRadii ?? { tl: defaultR, tr: defaultR, bl: defaultR, br: defaultR };
  return {
    tl: clamp(radii.tl, 0, maxRadius),
    tr: clamp(radii.tr, 0, maxRadius),
    bl: clamp(radii.bl, 0, maxRadius),
    br: clamp(radii.br, 0, maxRadius),
  };
}

// Dovetail connector geometry is shared with the baseplate feature (which can't
// import worker constants across the module boundary), so it lives in shared/.
export {
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  PUZZLE_NECK_HALF,
  PUZZLE_NECK_PROTRUSION,
  PUZZLE_HEAD_HALF,
  PUZZLE_PROTRUSION,
  PUZZLE_ARMPIT_FILLET,
  PUZZLE_HEAD_FILLET,
  TONGUE_CLEARANCE,
  DOVETAIL_KEY_CLEARANCE,
  SNAP_CLIP,
  SNAP_CLIP_CLEARANCE,
  snapClipLevels,
  effectiveClearance,
} from '@/shared/constants/connectors';
export type { SnapClipLevels } from '@/shared/constants/connectors';

export const NUB_DIAMETER = 1.5;
export const NUB_DEPTH = 0.8;
const HOLE_CLEARANCE = 0.1;
export const HOLE_DIAMETER = NUB_DIAMETER + 2 * HOLE_CLEARANCE;
export const HOLE_DEPTH = NUB_DEPTH + HOLE_CLEARANCE;
export const NUB_CIRCLE_SEGMENTS = 12;
