/**
 * Swappable label plate + socket geometry (issue #2666).
 *
 * Dimensions are pinned against the Cullenect v2.0.0 parametric source
 * (CullenJWebb/Cullenect-Labels `OpenSCAD/Cullenect.scad`), the de-facto
 * click-in label interchange standard, so sockets generated here accept
 * plates from the existing ecosystem (gflabel `--base cullenect`, printed
 * plate libraries). The v1.1 legacy plate was 36.4mm wide; v2.0.0 defines
 * width as `42·U − 6` (36.0 / 78.0 / 120.0) — the two must not be mixed.
 *
 * Lives in `shared/` so the generation worker (which cuts the socket), the
 * bin-designer UI (fit warnings, width pickers), and the future plate
 * generator consume the SAME numbers and can't drift.
 */

import { scaleClearance } from '@/shared/printSettings/connectorScaling';

/**
 * The label standard's grid pitch (mm). Deliberately NOT the app's
 * `gridUnitMm` setting: plates are interchange parts sized by the published
 * standard, so they stay 42mm-pitch-derived even when a user customizes
 * their grid unit.
 */
const PLATE_PITCH_MM = 42;

/** Standard plate widths, in pitch units. Every socket uses one of these. */
export const LABEL_PLATE_WIDTHS_U = [1, 2, 3] as const;

export type LabelPlateWidthU = (typeof LABEL_PLATE_WIDTHS_U)[number];

/** Plate width in mm for a standard width (`42·U − 6`): 36 / 78 / 120. */
export function labelPlateWidthMm(widthU: LabelPlateWidthU): number {
  return widthU * PLATE_PITCH_MM - 6;
}

export function isLabelPlateWidthU(value: unknown): value is LabelPlateWidthU {
  return (LABEL_PLATE_WIDTHS_U as readonly unknown[]).includes(value);
}

/** Plate body: 11mm tall (Y), 1.2mm thick (Z), 0.5mm corner radius. */
export const LABEL_PLATE_HEIGHT_MM = 11;
export const LABEL_PLATE_THICKNESS_MM = 1.2;
export const LABEL_PLATE_CORNER_RADIUS_MM = 0.5;

/**
 * Plate perimeter latch groove (the negative the socket ribs click into):
 * inset depth per side (`latchX`), band height (`latchZ`), and start height
 * above the plate bottom. Full-footprint bottom (0.2) and top (0.4) flanges
 * remain on either side of the band.
 */
export const LABEL_PLATE_LATCH_INSET_MM = 0.2;
export const LABEL_PLATE_LATCH_BAND_MM = 0.6;
export const LABEL_PLATE_LATCH_START_MM = 0.2;

/**
 * v1 backward-compat channels on 1U plates (the standard's default): three
 * T-profile channels cut into the underside at these X offsets, letting the
 * plate also click into legacy v1 sockets. Mouth 1.0mm wide × 0.2mm tall at
 * the bottom face, widening to a 2.0mm cavity up to 0.8mm.
 */
export const LABEL_PLATE_V1_CHANNEL_XS_MM: readonly number[] = [-12.133, 0, 12.133];
export const LABEL_PLATE_V1_MOUTH_WIDTH_MM = 1;
export const LABEL_PLATE_V1_MOUTH_HEIGHT_MM = 0.2;
export const LABEL_PLATE_V1_CAVITY_WIDTH_MM = 2;
export const LABEL_PLATE_V1_CAVITY_TOP_MM = 0.8;

/**
 * Socket pocket = plate + this TOTAL clearance in X and Y (`socket_offset`
 * in the standard) — total, not per-side.
 */
export const LABEL_SOCKET_CLEARANCE_MM = 0.3;

/** Pocket depth equals the plate thickness — the plate sits flush. */
export const LABEL_SOCKET_POCKET_DEPTH_MM = LABEL_PLATE_THICKNESS_MM;

/**
 * Retention ribs on the two LONG pocket walls (full X span): protrusion into
 * the pocket, band height, and start height above the pocket floor. The rib
 * band (0.2–0.6mm above the floor) engages the plate's perimeter latch
 * groove (0.2mm inset from 0.2 to 0.8mm); the plate's full-width top flange
 * clicks past the rib.
 */
export const LABEL_SOCKET_RIB_PROTRUSION_MM = 0.2;
export const LABEL_SOCKET_RIB_HEIGHT_MM = 0.4;
export const LABEL_SOCKET_RIB_START_MM = 0.2;

/**
 * Solid floor kept beneath the pocket. The standard's socket test block
 * keeps a 1mm floor; 0.8mm (4 layers at 0.2) is enough to anchor the rib
 * bridge while keeping the shelf slim.
 */
export const LABEL_SOCKET_FLOOR_MM = 0.8;

/** Shelf plate thickness in socket mode: pocket depth + solid floor. */
export const LABEL_SOCKET_SHELF_THICKNESS_MM = LABEL_SOCKET_POCKET_DEPTH_MM + LABEL_SOCKET_FLOOR_MM;

/** Minimum solid wall kept around the pocket on each side (mm). */
export const LABEL_SOCKET_WALL_MM = 1;

/**
 * Minimum label-tab depth able to host a socket: front/back walls + pocket
 * height + clearance headroom. (1 + 11.3 + 1 rounds up to 14 with margin
 * for nozzle-scaled clearance growth.)
 */
export const MIN_LABEL_SOCKET_TAB_DEPTH_MM = 14;

/**
 * User-tunable fit offset bounds (mm, signed, added to the TOTAL socket
 * clearance). Range keeps the effective clearance within [0.1, 0.8] at the
 * 0.4mm nozzle baseline. Mirrored in `api/lib/designerValidationConstants.ts`.
 */
export const LABEL_PLATE_FIT_OFFSET_MIN = -0.2;
export const LABEL_PLATE_FIT_OFFSET_MAX = 0.5;
export const LABEL_PLATE_FIT_OFFSET_STEP = 0.05;

/**
 * Effective TOTAL pocket clearance: spec 0.3mm grown for nozzles above the
 * 0.4mm baseline (`scaleClearance`), plus the user's signed fit offset.
 * Clamped non-negative so a hostile payload can't produce a pocket smaller
 * than the plate.
 */
export function effectiveLabelSocketClearance(
  nozzleSizeMm: number | undefined,
  plateFitOffset: number | undefined
): number {
  const scaled = scaleClearance(LABEL_SOCKET_CLEARANCE_MM, nozzleSizeMm ?? 0);
  const offset = Number.isFinite(plateFitOffset) ? (plateFitOffset as number) : 0;
  return Math.max(0, scaled + offset);
}

/**
 * Snap a text depth to a whole multiple of the layer height, clamped to the
 * 1-layer..0.4mm band — the filament-swap two-color contract for plates.
 */
export function snapTextDepthToLayers(depthMm: number, layerHeightMm: number): number {
  if (!Number.isFinite(layerHeightMm) || layerHeightMm <= 0) return Math.min(0.4, depthMm);
  const snapped = Math.round(depthMm / layerHeightMm) * layerHeightMm;
  return Math.round(Math.min(0.4, Math.max(layerHeightMm, snapped)) * 100) / 100;
}

/** Outer X span a socket needs for a given plate width (pocket + walls). */
export function labelSocketOuterWidthMm(widthU: LabelPlateWidthU, clearanceMm: number): number {
  return labelPlateWidthMm(widthU) + clearanceMm + 2 * LABEL_SOCKET_WALL_MM;
}

/**
 * Largest standard plate width whose socket fits in `availableWidthMm`,
 * or null when even 1U does not fit.
 */
export function largestFittingPlateWidthU(
  availableWidthMm: number,
  clearanceMm: number
): LabelPlateWidthU | null {
  for (let i = LABEL_PLATE_WIDTHS_U.length - 1; i >= 0; i--) {
    const u = LABEL_PLATE_WIDTHS_U[i];
    if (labelSocketOuterWidthMm(u, clearanceMm) <= availableWidthMm) return u;
  }
  return null;
}
