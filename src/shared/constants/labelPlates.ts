/**
 * Swappable label plate + socket geometry.
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
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

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

/**
 * Hardware icons a plate can carry beside its text (gflabel-style fastener
 * silhouettes). Shared by the compartment icon picker, the server-side
 * validation allowlist, and the worker's icon geometry so they never drift.
 */
export const LABEL_PLATE_ICONS = [
  // Fasteners
  'bolt',
  'screw',
  'woodScrew',
  'nut',
  'washer',
  'nail',
  'hexSocketCap',
  'setScrew',
  'selfTapping',
  'threadedRod',
  'splitPin',
  'lockWasher',
  'wingNut',
  'squareNut',
  'threadedInsert',
  'eyeBolt',
  'thumbScrew',
  'standoff',
  // Tooling and consumables
  'drillBit',
  'hexKey',
  'tap',
  'countersink',
  'utilityBlade',
  'spring',
  'oRing',
  'bearing',
  'magnet',
  'zipTie',
  'sawBlade',
  'file',
  'endMill',
  'clip',
  'screwdriverBit',
  // Kitchen
  'teaspoon',
  'tablespoon',
  'fork',
  'knife',
  'spatula',
  'whisk',
  'tongs',
  'ladle',
  'chopsticks',
  'bottleOpener',
  'peeler',
  'rollingPin',
] as const;

export type LabelPlateIconId = (typeof LABEL_PLATE_ICONS)[number];

export function isLabelPlateIconId(value: unknown): value is LabelPlateIconId {
  return (LABEL_PLATE_ICONS as readonly unknown[]).includes(value);
}

/** Plate body: 11mm tall (Y), 1.2mm thick (Z), 0.5mm corner radius. */
export const LABEL_PLATE_HEIGHT_MM = 11;
export const LABEL_PLATE_THICKNESS_MM = 1.2;
export const LABEL_PLATE_CORNER_RADIUS_MM = 0.5;

/**
 * Ceiling for plate text/icon depth (mm) — the filament-swap two-color
 * contract. Also the worst-case emboss proudness above the plate top, which
 * is why `LABEL_SOCKET_STACK_RELIEF_MM` must account for it.
 */
export const LABEL_PLATE_TEXT_DEPTH_MAX_MM = 0.4;

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
 * Minimum plate material kept above a v1 channel cavity (mm). The roof
 * bridges the 2mm-wide cavity unsupported, so a single 0.2mm layer sags into
 * it and prints as a torn surface; two layers hold.
 */
export const LABEL_PLATE_V1_ROOF_MIN_MM = 0.4;

/** Plate material left above the v1 cavity once the text is cut (mm). */
export function labelPlateV1RoofMm(textMode: 'emboss' | 'deboss', textDepthMm: number): number {
  const cutDepth = textMode === 'deboss' ? Math.max(0, textDepthMm) : 0;
  return LABEL_PLATE_THICKNESS_MM - LABEL_PLATE_V1_CAVITY_TOP_MM - cutDepth;
}

/**
 * Whether a text-carrying plate can also keep the v1 channels. The channels
 * hollow the plate below `LABEL_PLATE_V1_CAVITY_TOP_MM` with the middle one at
 * x=0, dead under the text, so a debossed glyph deeper than the leftover roof
 * breaks clean through. Text wins that collision: every socket this app cuts
 * is v2, so the channels only buy legacy third-party compatibility.
 *
 * At the pinned 1.2/0.8 geometry the roof is 0.4mm and `snapTextDepthToLayers`
 * floors a deboss at one layer, so in practice EVERY debossed plate loses the
 * channels; the arithmetic is kept general so a future plate thickness or
 * cavity depth re-decides it on its own.
 */
export function labelPlateV1ChannelsFitText(
  textMode: 'emboss' | 'deboss',
  textDepthMm: number
): boolean {
  // The untouched roof (1.2 − 0.8) lands a float ULP under the 0.4mm minimum,
  // so an exact compare would strip the channels off every embossed plate.
  return labelPlateV1RoofMm(textMode, textDepthMm) >= LABEL_PLATE_V1_ROOF_MIN_MM - 1e-9;
}

/**
 * Socket pocket = plate + this TOTAL clearance in X and Y (`socket_offset`
 * in the standard) — total, not per-side.
 */
export const LABEL_SOCKET_CLEARANCE_MM = 0.3;

/** Spec pocket depth: the plate thickness, so the plate sits flush. */
export const LABEL_SOCKET_POCKET_DEPTH_MM = LABEL_PLATE_THICKNESS_MM;

/**
 * Extra depth cut into CLICK-IN pockets beyond the spec's flush fit (mm).
 * Flush leaves zero Z play, so any print excess (over-extrusion, an
 * elephant's foot on the bottom flange, a plate stopped on the ribs instead
 * of clicked past them) stands proud of the shelf. Retention is untouched —
 * the rib band is floor-relative, so the latch engagement moves down with the
 * floor. Slide-channel pockets keep the spec depth: their lip clamps the plate
 * against the floor, and slop there would only let it rattle.
 */
export const LABEL_SOCKET_CLICK_POCKET_RELIEF_MM = 0.2;

export const LABEL_SOCKET_CLICK_POCKET_DEPTH_MM =
  LABEL_SOCKET_POCKET_DEPTH_MM + LABEL_SOCKET_CLICK_POCKET_RELIEF_MM;

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
 * Slide-channel socket style: instead of click-past ribs,
 * retaining lips overhang the pocket's side and anchor walls, the mouth
 * opens through the tab's compartment-facing edge, and a floor detent at
 * the mouth parks the plate. Retention grips the plate's plain edges, so
 * slide sockets take the same standard plates as click-in ones.
 */
export type LabelSocketStyle = 'clickIn' | 'slideChannel';

export const LABEL_SOCKET_STYLES: readonly LabelSocketStyle[] = ['clickIn', 'slideChannel'];

/** Lip band above the plate: thickness (Z) and overhang into the pocket (XY). */
export const LABEL_SOCKET_LIP_THICKNESS_MM = 0.6;
export const LABEL_SOCKET_LIP_OVERHANG_MM = 1.2;
/** Vertical slide clearance between plate top and lip underside. */
export const LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM = 0.15;
/** Park detent at the mouth: height above the floor and Y extent. */
export const LABEL_SOCKET_DETENT_HEIGHT_MM = 0.3;
export const LABEL_SOCKET_DETENT_DEPTH_MM = 0.8;

/**
 * Solid floor kept beneath the pocket. The standard's socket test block
 * keeps a 1mm floor; 0.8mm (4 layers at 0.2) is enough to anchor the rib
 * bridge while keeping the shelf slim.
 */
export const LABEL_SOCKET_FLOOR_MM = 0.8;

/** Shelf plate thickness in socket mode: pocket depth + solid floor. */
export const LABEL_SOCKET_SHELF_THICKNESS_MM =
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM + LABEL_SOCKET_FLOOR_MM;

/** Slide-channel shelves host the spec-depth pocket + z-clearance + lip band. */
export const LABEL_SOCKET_SLIDE_SHELF_THICKNESS_MM =
  LABEL_SOCKET_POCKET_DEPTH_MM +
  LABEL_SOCKET_FLOOR_MM +
  LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM +
  LABEL_SOCKET_LIP_THICKNESS_MM;

/** Minimum solid wall kept around the pocket on each side (mm). */
export const LABEL_SOCKET_WALL_MM = 1;

/**
 * Minimum label-tab depth able to host a socket: front/back walls + pocket
 * height + clearance headroom. (1 + 11.3 + 1 rounds up to 14 with margin
 * for nozzle-scaled clearance growth.)
 */
export const MIN_LABEL_SOCKET_TAB_DEPTH_MM = 14;

/**
 * Stacking relief for click-in sockets on lipped bins (mm).
 *
 * A stacked bin's foot bottom seats TOLERANCE/2 (0.25mm) above the interior
 * ceiling — the plane the shelf top otherwise occupies — so anything standing
 * proud of the shelf lifts the bin above. The relief covers both failures
 * happening at once: a plate perched on the retention ribs instead of clicked
 * home (`RIB_START + RIB_HEIGHT` above the pocket floor, partly absorbed by
 * the deepened click-in pocket) AND carrying max-depth embossed text. The
 * 0.25mm seat gap is then pure margin over that worst case.
 *
 * Applied only where it matters: click-in sockets (slide-channel plates ride
 * under a retaining lip, already below the shelf top) on bins with a stacking
 * lip (no lip = nothing locates on top).
 */
export const LABEL_SOCKET_STACK_RELIEF_MM =
  LABEL_SOCKET_RIB_START_MM +
  LABEL_SOCKET_RIB_HEIGHT_MM +
  LABEL_PLATE_THICKNESS_MM -
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM +
  LABEL_PLATE_TEXT_DEPTH_MAX_MM;

/**
 * Optional raised rim on a label tab's free edge that stops a loose paper /
 * vinyl label sliding off. Height (mm) is user-tunable; the rim's
 * thickness follows the shelf wall. Only offered on text-mode tabs — socket
 * tabs already retain their plates, and the slide-channel socket's insertion
 * mouth is on the same free edge the lip would wall off.
 */
export const LABEL_TAB_LIP_HEIGHT_DEFAULT_MM = 1;
export const LABEL_TAB_LIP_HEIGHT_MIN_MM = 0.4;
export const LABEL_TAB_LIP_HEIGHT_MAX_MM = 5;

/** Label-tab config fields the shelf-plane resolvers need (structural
 * subset of `LabelTabConfig`, kept inline so this shared module doesn't
 * depend on feature types). */
export interface LabelShelfConfig {
  readonly height?: number;
  readonly mode?: 'text' | 'socket';
  readonly socketStyle?: LabelSocketStyle;
  readonly lip?: boolean;
  readonly lipHeight?: number;
}

/**
 * How far the label lip reserves the shelf top below the ceiling, so
 * the rim tops out at the interior ceiling rather than standing proud and
 * breaking stackability. Zero unless the lip is enabled on a text-mode tab.
 * Clamped to the supported range so a stale/out-of-bounds stored value can't
 * push the shelf past its guard band.
 */
export function labelLipReservationMm(label: LabelShelfConfig): number {
  if (!label.lip || (label.mode ?? 'text') !== 'text') return 0;
  const h = label.lipHeight ?? LABEL_TAB_LIP_HEIGHT_DEFAULT_MM;
  return Math.min(Math.max(h, LABEL_TAB_LIP_HEIGHT_MIN_MM), LABEL_TAB_LIP_HEIGHT_MAX_MM);
}

/**
 * Highest Z (above the cavity floor) a label shelf top may occupy: the wall
 * top, less the lip's bottom taper when a stacking lip narrows the interior.
 * Mirrors the generation pipeline's `interiorHeight` — UI ceilings and
 * warnings must use this, not the raw wall height, or they overshoot the
 * builder's guard band and tabs silently vanish.
 */
export function labelShelfCeilingMm(wallHeightMm: number, stackingLip: boolean): number {
  return stackingLip ? wallHeightMm - GRIDFINITY_SPEC.LIP_SMALL_TAPER : wallHeightMm;
}

/** Default shelf-top Z when `label.height` is unset: the ceiling, sunk by the
 * larger of the click-in-socket stacking relief (lipped bins) and the label
 * lip reservation. The two are mutually exclusive in practice — socket
 * relief is socket-only, the lip is text-only — so `max` just picks whichever
 * applies. */
export function defaultLabelShelfTopMm(
  ceilingMm: number,
  stackingLip: boolean,
  label: LabelShelfConfig,
  /**
   * Lid keep-out depth below the ceiling. A shelf left in the envelope
   * would have the wall-side band that welds it cut away, so it sinks by this
   * instead and keeps its full width. Zero on a design that predates the
   * relief, or one without a lid.
   */
  keepoutMm = 0
): number {
  const clickInSocket =
    (label.mode ?? 'text') === 'socket' && (label.socketStyle ?? 'clickIn') === 'clickIn';
  const socketRelief = clickInSocket && stackingLip ? LABEL_SOCKET_STACK_RELIEF_MM : 0;
  return ceilingMm - Math.max(socketRelief, labelLipReservationMm(label), keepoutMm);
}

/**
 * The shelf-top Z the geometry builder anchors to. Single source for the
 * worker, the panel's displayed height, and the ghost preview — three
 * independent `label.height ?? …` fallbacks is how they drift apart.
 *
 * Where the stacking relief applies an explicit height is capped at the
 * relieved plane: the height control positions the shelf, it is not a licence
 * to park a plate where the next bin up has to sit.
 */
export function resolveLabelShelfTopMm(
  ceilingMm: number,
  stackingLip: boolean,
  label: LabelShelfConfig,
  keepoutMm = 0
): number {
  const defaultTop = defaultLabelShelfTopMm(ceilingMm, stackingLip, label, keepoutMm);
  if (label.height === undefined) return defaultTop;
  const reliefApplies = defaultTop < ceilingMm;
  return reliefApplies ? Math.min(label.height, defaultTop) : label.height;
}

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
 * 1-layer..max band.
 */
export function snapTextDepthToLayers(depthMm: number, layerHeightMm: number): number {
  if (!Number.isFinite(layerHeightMm) || layerHeightMm <= 0) {
    return Math.min(LABEL_PLATE_TEXT_DEPTH_MAX_MM, depthMm);
  }
  const snapped = Math.round(depthMm / layerHeightMm) * layerHeightMm;
  return (
    Math.round(Math.min(LABEL_PLATE_TEXT_DEPTH_MAX_MM, Math.max(layerHeightMm, snapped)) * 100) /
    100
  );
}

/** Outer X span a socket needs for a given plate width (pocket + walls). */
export function labelSocketOuterWidthMm(widthU: LabelPlateWidthU, clearanceMm: number): number {
  return labelPlateWidthMm(widthU) + clearanceMm + 2 * LABEL_SOCKET_WALL_MM;
}

/** Outer span across the plate's short axis a socket needs (pocket + walls). */
export function labelSocketOuterDepthMm(clearanceMm: number): number {
  return LABEL_PLATE_HEIGHT_MM + clearanceMm + 2 * LABEL_SOCKET_WALL_MM;
}

/**
 * How far a socket cut into a shadow board's fill surface must sink below it
 * (mm).
 *
 * A plate stopped on the retention ribs instead of clicked home, carrying
 * max-depth embossed text, stands `LABEL_SOCKET_STACK_RELIEF_MM` proud of the
 * pocket's own top plane, enough to perch the bin stacked above on the plate
 * rather than on the rim. A board that has already lowered its fill surface
 * has spent that headroom in advance, so only the shortfall is taken. Without
 * a stacking lip nothing locates on top and nothing needs to sink.
 */
export function cutoutSocketSinkMm(stackingLip: boolean, topOffsetMm: number): number {
  if (!stackingLip) return 0;
  const spent = Number.isFinite(topOffsetMm) ? Math.max(0, topOffsetMm) : 0;
  return Math.max(0, LABEL_SOCKET_STACK_RELIEF_MM - spent);
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
