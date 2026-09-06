/**
 * Sliding-lid geometry: the channel fused to the bin, the plate that runs in
 * it, and the envelope neither may share with anything else.
 *
 * Lives in `shared` for the reason `labelTabPlan` and `dividerRailPlan` do:
 * five layers consume it and two of them cannot import brepjs. The worker
 * builds the channel and the plate from one call here, so the two cannot
 * disagree about where the bearing surfaces are; `checkLidCompatibility`
 * blocks a design the resolver rejects and reports what the travel envelope
 * will trim; the cutout window measures the plate's own footprint; and the
 * preview slides the plate along the axis the plan names.
 *
 * ── THE JOINT ────────────────────────────────────────────────────────────
 *
 * A half-dovetail, and every face of it is chosen so neither part needs
 * support. Section at one channel wall, `u` measured inboard from that wall's
 * inner face and `z` from the plate's top plane:
 *
 *        u=0                          u grows inboard →
 *     wall │
 *          │████████████            retainer
 *          │████████╱               underside RISES inboard at 45°
 *          │█████╱
 *          │══╱═══════════════      ← plate's chamfered top edge, parallel,
 *          │ ╱                        one clearance below
 *          │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      ← plate
 *          │────────────────────    ← shelf top: FLAT, the bearing face
 *          │╲
 *          │  ╲                     45° gusset back to the wall
 *          │    ╲
 *
 * Three consequences, and the reason this is not the square rebate the
 * OpenSCAD design it was modelled on uses:
 *
 * 1. NOTHING OVERHANGS. The retainer's underside rises as it reaches inboard,
 *    so its first layer sits ON the wall and each one after grows 45° off the
 *    last. Slope it the other way — the intuitive dovetail direction, narrowing
 *    toward the channel's mouth — and the retainer's first material is a line
 *    floating over the channel. The shelf's gusset is the same argument
 *    upside-down. A square channel needs support on both faces.
 * 2. IT STILL HOLDS. Two parallel planes a clearance apart block motion normal
 *    to them, so lifting the plate closes the gap and stops. The plate can
 *    shift sideways by the slop it is given and gain height on one edge, but
 *    the engagement is `wedge` and the slop is `2 * clearance`, so it stays
 *    captive with an order of magnitude to spare.
 * 3. THE WEDGE EATS SLOP. A square channel is either loose or tight; this one
 *    is loose until something lifts it and then it is not.
 *
 * The plate prints flat on the bed, which puts the chamfer on a TOP edge — no
 * overhang at all — and puts its thickness on the Z axis, the one an FDM
 * printer holds best. That matters here more than it does for a cap: the fit
 * this joint has to hit is a sliding one.
 *
 * ── THE FRAME ────────────────────────────────────────────────────────────
 *
 * Everything below is CANONICAL: the plate travels along X and withdraws
 * toward +X, the channel walls are the ±Y ones, and `z = 0` is the plate's top
 * plane. {@link SlideLidGeometry.rotationDeg} maps that onto the wall the user
 * actually chose. One section-building code path, one rotation, and no chance
 * of an axis being handled backwards in three places out of four — which is
 * also why the builder can stay on the `sketchOnPlane('YZ', …)` idiom
 * CLAUDE.md gotcha #12 recommends.
 *
 * Origin is the CAVITY's centre, not the bin's: the channel hangs off the
 * cavity walls, and under asymmetric overhang the two are not the same point.
 * The builder translates by `innerOffsetX/Y` after rotating.
 */

import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { LID_SLIDE_PLATE_MIN_MM } from '@/features/bin-designer/types/lid';
import type { LidRailSide, LidSlideConfig, LidSlidePull } from '@/shared/types/bin';

const LIP_TAPER_WIDTH = GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/**
 * Bearing overlap (mm) the plate gets on each shelf, past the clearance.
 *
 * The load path: everything the plate carries, plus whatever is pressed onto
 * it, arrives here. 2mm is five extrusions at a 0.4mm nozzle and costs the
 * opening `2 * (clearance + 2)` across the span — under half what a click
 * lid's rail band already takes out of the same walls, so a design that
 * tolerated a click lid tolerates this.
 */
export const SLIDE_BEARING_MM = 2;

/** Shelf thickness (mm) at its free tip, before the 45° gusset thickens it. */
export const SLIDE_SHELF_TIP_MM = 0.8;

/** Retainer thickness (mm) at its inboard tip, so the wedge is not a knife. */
export const SLIDE_ROOF_TIP_MM = 0.8;

/**
 * Nominal 45° engagement (mm) — the rise of the retaining wedge, which equals
 * its run.
 *
 * How far the plate may lift before its chamfer meets the retainer. 1mm is
 * five layers at 0.2 and roughly four times the lateral slop the plate is
 * given, which is the ratio that decides whether it can be worked out of the
 * channel by rocking.
 */
export const SLIDE_WEDGE_MM = 1;

/**
 * Material (mm) kept at the plate's outer edge once the wedge is chamfered off
 * it.
 *
 * Without this the chamfer runs the full plate thickness and the running edge
 * is a knife: it prints as a ragged line, it is the first thing to peel, and it
 * is the exact edge the joint bears on when the plate is lifted.
 */
export const SLIDE_PLATE_EDGE_MIN_MM = 0.6;

/** Smallest plate span (mm) across the travel axis worth generating. */
const MIN_PLATE_SPAN_MM = 10;

/** Smallest plate length (mm) along the travel axis worth generating. */
const MIN_PLATE_LENGTH_MM = 10;

/**
 * Clearance (mm) between the plate's swept volume and anything the bin keeps.
 *
 * Same stack and the same dominant term as {@link LID_KEEPOUT_CLEARANCE} in
 * `lidKeepout` — warp across a long part, not the nominal fit. Stated here
 * rather than imported because that constant is sized for a rail hooking a lip
 * and this one for a plate sweeping an opening; they agree today by argument,
 * not by derivation, and tying them together would make a future change to one
 * silently move the other.
 */
export const SLIDE_KEEPOUT_CLEARANCE_MM = 1;

/**
 * The detent: a ramped bump on each shelf and a matching pocket in the plate's
 * underside that it drops into when the lid is shut.
 *
 * A bump alone does not work, and the reason is worth stating because the
 * obvious arrangement is the one that fails. A shut plate covers the whole
 * channel, so its only free boundary is the leading edge — and that edge moves
 * AWAY from anything behind it as the lid opens. A ramp there is never climbed
 * in either direction; it is simply a bump the plate stops short of. Measured:
 * zero shared volume at every position on the travel.
 *
 * So the pair is the feature. The plate rides over the bump for the last few
 * millimetres of closing and drops into its pocket at the end, and opening has
 * to lift it back out — a definite click, and a definite closed position.
 *
 * The rise is held UNDER the vertical clearance so the ride-over costs no
 * flex: the plate simply floats within the slop it already has, instead of
 * jamming against the retainer for the last stretch of every close.
 */
const DETENT_RISE_FRACTION_OF_CLEARANCE = 0.6;
const DETENT_MAX_RISE_MM = 0.4;
/**
 * How far inboard of the plate's leading edge the bump sits (mm).
 *
 * Far enough that the pocket has plate on both sides of it — a pocket opening
 * onto the leading edge would be a notch, and the plate would slide straight
 * out of it.
 */
const DETENT_POCKET_INSET_MM = 4;
/** Extra depth and width (mm) the pocket has over the bump, so it seats. */
const DETENT_POCKET_SLACK_MM = 0.15;

/**
 * Free span (mm) past which a plate is reported as liable to bow.
 *
 * A 1.6mm plate spanning three grid units is already 120mm of unsupported PLA
 * held on two edges. The number is a threshold for a warning, never a clamp:
 * the panel names the thickness that would carry the span and leaves the trade
 * to the user, the way the grip-relief depth clamp reports itself.
 */
export const SLIDE_SAG_SPAN_MM = 90;

/** Plate thickness (mm) recommended for a given free span. */
export function slideSagSafeThicknessMm(spanMm: number): number {
  // Bending stiffness goes as thickness cubed, so the span it carries goes as
  // thickness to the 1.5. Inverting that against the 1.6mm plate the threshold
  // was set for, then rounding up to a whole layer at 0.2mm.
  const ratio = Math.max(spanMm / SLIDE_SAG_SPAN_MM, 1);
  const raw = LID_SLIDE_PLATE_MIN_MM * Math.pow(ratio, 2 / 3);
  return Math.ceil(raw / 0.2) * 0.2;
}

/** Why no sliding-lid geometry was produced. `null` when the resolve succeeded. */
export type SlideLidRejection =
  /** The design's lid is not a sliding one. */
  | 'not-slide'
  /** A solid bin has no cavity for the plate to cover. */
  | 'no-cavity'
  /** A base-only tile has no cavity either, and no walls to carry a channel. */
  | 'no-walls'
  /** Slotted bins cut divider slots into the very walls the channel runs along. */
  | 'slot-conflict'
  /** Custom shapes: a channel has no polygon-edge mapping yet. */
  | 'unsupported-shape'
  /** The interior is not deep enough to hold the channel and leave usable space. */
  | 'bin-too-shallow'
  /** The plate would be narrower than {@link MIN_PLATE_SPAN_MM}. */
  | 'bin-too-narrow'
  /** The plate would be shorter than {@link MIN_PLATE_LENGTH_MM}. */
  | 'bin-too-short'
  /** The plate is too thin to carry the wedge and keep a real outer edge. */
  | 'plate-too-thin';

/** One channel bar: a YZ cross-section swept along canonical X. */
export interface SlideLidBar {
  readonly xMin: number;
  readonly xMax: number;
  /** Closed polygon of [y, z] points, canonical frame. */
  readonly section: readonly (readonly [number, number])[];
  /** Which channel wall this bar belongs to, for tagging and for tests. */
  readonly wall: 'yMin' | 'yMax';
  readonly kind: 'shelf' | 'retainer';
}

/** The ramped bump that holds the plate closed, on one shelf. */
export interface SlideLidDetent {
  /** Canonical X of the ramp's peak. */
  readonly peakX: number;
  /** 45° run each side of the peak. */
  readonly runMm: number;
  /** Height above the shelf's top face. */
  readonly riseMm: number;
  readonly yMin: number;
  readonly yMax: number;
  /** Shelf top plane the bump stands on, canonical z. */
  readonly baseZ: number;
}

/** An axis-aligned box in the canonical frame. */
export interface SlideLidBox {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
  readonly zMax: number;
}

/** The plate's own section, for the builder and for the seating tests. */
export interface SlideLidPlate {
  /** Full width across the travel axis (canonical Y). */
  readonly spanMm: number;
  /** Full length along the travel axis (canonical X). */
  readonly lengthMm: number;
  readonly thicknessMm: number;
  /** 45° chamfer run and rise on each running edge. */
  readonly wedgeMm: number;
  /** Radius on the two LEADING corners, so the plate nests into the cavity. */
  readonly cornerRadiusMm: number;
  /** Canonical X of the leading (closed-end) edge. */
  readonly leadingX: number;
  /** Canonical X of the trailing edge — the bin's outer face at the entry. */
  readonly trailingX: number;
  /** Pull treatment on the trailing edge. */
  readonly pull: LidSlidePull;
  /** Span (mm) of the pull feature across the trailing edge. */
  readonly pullSpanMm: number;
  /** How far the pull cuts in, or stands out. */
  readonly pullReachMm: number;
  /**
   * The detent pockets cut into the plate's underside, one per shelf, that the
   * bumps drop into when the lid is shut. Empty when the design has no detent.
   *
   * Carried on the PLATE rather than derived beside the bumps so the two can
   * only ever be built from one set of numbers: a pocket that missed its bump
   * by a millimetre would leave a lid that shuts, does not click, and shows
   * nothing wrong in either solid.
   */
  readonly detentPockets: readonly SlideLidDetentPocket[];
}

/** A pocket in the plate's underside, in the plate's own canonical frame. */
export interface SlideLidDetentPocket {
  readonly centerX: number;
  readonly yMin: number;
  readonly yMax: number;
  /** Full length along X, ramps included. */
  readonly lengthMm: number;
  readonly depthMm: number;
}

export interface SlideLidGeometry {
  /** Z rotation mapping the canonical (+X entry) plan onto the chosen wall. */
  readonly rotationDeg: number;
  readonly entrySide: LidRailSide;
  /** Bars fused onto the bin. */
  readonly bars: readonly SlideLidBar[];
  /** Detent bumps, empty when the design turned them off. */
  readonly detents: readonly SlideLidDetent[];
  /** Window cut through the entry wall, in canonical coords. */
  readonly entryNotch: SlideLidBox;
  /**
   * The volume the plate sweeps, plus clearance — what `relieveInterior` cuts
   * out of the cavity, and what a compatibility check measures features
   * against. Its top is the retainer's top plane, deliberately NOT the wall
   * top: on the recessed placement everything above that belongs to the
   * stacking lip, and a cutter reaching into the lip's angled support would
   * back-fill the taper a foot has to seat in (CLAUDE.md gotcha #10).
   */
  readonly travelEnvelope: SlideLidBox;
  readonly plate: SlideLidPlate;
  /**
   * How far below the bin's WALL TOP the plate's top plane sits. Everything
   * else in this plan is stated against that plane, so a collar
   * (`extraWallHeightMm`) carries the whole joint up for free — the same
   * reason `lidKeepoutRing` measures from the wall top.
   */
  readonly plateTopBelowWallTopMm: number;
  /** Distance from closed to fully withdrawn, for the preview's slider. */
  readonly travelMm: number;
  /** Unsupported span the plate bridges, for the sag warning. */
  readonly freeSpanMm: number;
  /** Per-side clearance actually used, after clamping. */
  readonly clearanceMm: number;
}

export interface SlideLidPlan {
  readonly geometry: SlideLidGeometry | null;
  readonly rejection: SlideLidRejection | null;
}

export interface SlideLidPlanInput {
  readonly slide: LidSlideConfig;
  /** Resolved plate thickness — `resolveLidPlateThickness`, already floored. */
  readonly plateThicknessMm: number;
  readonly innerW: number;
  readonly innerD: number;
  readonly wallThickness: number;
  /** Thickness (mm) of the entry wall, which overhang can make uneven. */
  readonly entryWallThicknessMm: number;
  /**
   * Cavity floor to wall top (mm) — the budget the joint has to fit inside.
   *
   * Stated as `wallHeight - wallThickness` so both sides of the worker boundary
   * can compute it from fields they already hold, rather than one of them
   * reaching for a differently-defined `interiorHeight`.
   */
  readonly cavityDepthMm: number;
  readonly hasLip: boolean;
  readonly isPolygon: boolean;
  readonly isSolid: boolean;
  readonly isSlotted: boolean;
  readonly isTile: boolean;
}

const NO_GEOMETRY = (rejection: SlideLidRejection): SlideLidPlan => ({
  geometry: null,
  rejection,
});

/**
 * The bin measurements a plan needs, in the shape both threads can supply.
 *
 * The worker fills it from `dimensions`, the panel from `binDimensions` plus
 * the overhang expansion. Declared here so the ONE place that turns bin
 * measurements into plan input is shared: deriving the entry wall's thickness
 * twice is exactly how a plate ends up a millimetre proud of the face it is
 * supposed to finish flush with.
 */
export interface SlideLidBinDims {
  /** Outer body extents, overhang folded in. */
  readonly outerW: number;
  readonly outerD: number;
  /** Cavity extents, overhang folded in. */
  readonly innerW: number;
  readonly innerD: number;
  /** Cavity centre relative to the bin origin. Zero without asymmetric overhang. */
  readonly innerOffsetX: number;
  readonly innerOffsetY: number;
  /** Floor bottom to wall top. */
  readonly wallHeight: number;
  readonly hasLip: boolean;
  readonly isSolid: boolean;
  readonly isSlotted: boolean;
  readonly isTile: boolean;
}

/**
 * Thickness (mm) of one wall, which asymmetric overhang makes uneven.
 *
 * The outer body spans `±outer/2` about the bin origin while the cavity spans
 * `±inner/2` about `innerOffset`, so each side's wall is whatever is left
 * between them — not `params.wallThickness`, which describes the nominal case
 * only.
 */
export function slideWallThicknessMm(side: LidRailSide, dims: SlideLidBinDims): number {
  switch (side) {
    case 'right':
      return dims.outerW / 2 - (dims.innerOffsetX + dims.innerW / 2);
    case 'left':
      return dims.innerOffsetX - dims.innerW / 2 + dims.outerW / 2;
    case 'back':
      return dims.outerD / 2 - (dims.innerOffsetY + dims.innerD / 2);
    case 'front':
      return dims.innerOffsetY - dims.innerD / 2 + dims.outerD / 2;
  }
}

/** Plan input from a lid config plus resolved bin measurements. */
export function slideLidPlanInput(
  slide: LidSlideConfig,
  plateThicknessMm: number,
  wallThickness: number,
  isPolygon: boolean,
  dims: SlideLidBinDims
): SlideLidPlanInput {
  return {
    slide,
    plateThicknessMm,
    innerW: dims.innerW,
    innerD: dims.innerD,
    wallThickness,
    entryWallThicknessMm: slideWallThicknessMm(slide.entrySide, dims),
    cavityDepthMm: dims.wallHeight - wallThickness,
    hasLip: dims.hasLip,
    isPolygon,
    isSolid: dims.isSolid,
    isSlotted: dims.isSlotted,
    isTile: dims.isTile,
  };
}

/**
 * Z rotation carrying the canonical +X entry onto each wall.
 *
 * Read straight off the outward normals the rest of the lid code uses
 * (`gripPlacements`): back is +Y, front is −Y, right is +X, left is −X.
 */
const ENTRY_ROTATION_DEG: Record<LidRailSide, number> = {
  right: 0,
  back: 90,
  left: 180,
  front: -90,
};

/** True when the entry wall is a ±X one, so the plate travels along X. */
export function slideTravelsAlongX(entrySide: LidRailSide): boolean {
  return entrySide === 'left' || entrySide === 'right';
}

/**
 * How far below the wall top the plate's top plane sits.
 *
 * `flush` parks the retainer's top face at the rim, which is the deepest
 * cavity a sliding lid can leave and the reason the placement exists. It has
 * no room for a stacking lip, which `checkLidCompatibility` reports as a
 * blocker rather than forcing — turning the lip off changes a part the user
 * did not ask about.
 *
 * `recessed` drops the whole joint clear of the lip's angled support, which
 * reaches `LIP_TAPER_WIDTH` below the lip's own base plane. A retainer fused
 * inside that band would either back-fill the taper or come out thinner than
 * asked for, and neither is visible to a bounding-box or watertight check
 * (CLAUDE.md gotcha #10).
 *
 * On a bin with no lip the two placements coincide, which is correct rather
 * than an error: there is nothing above the rim to get out of the way of.
 */
export function slidePlateTopBelowWallTopMm(
  placement: LidSlideConfig['placement'],
  clearanceMm: number,
  hasLip: boolean
): number {
  const roofTop = clearanceMm + SLIDE_ROOF_TIP_MM;
  if (placement === 'flush' || !hasLip) return roofTop;
  return LIP_TAPER_WIDTH + roofTop;
}

/**
 * Resolve the sliding-lid geometry, or say why there is none.
 *
 * Every rejection is a real refusal to build, not a clamp: a channel that
 * silently shrank to fit would produce a plate that rattles out of a bin the
 * panel said was fine.
 */
export function resolveSlideLidPlan(input: SlideLidPlanInput): SlideLidPlan {
  const { slide, wallThickness, innerW, innerD } = input;

  // Style and shape gates first, so the panel can explain a design that
  // produces nothing rather than leaving the user to guess. Slotted is the
  // subtle one and it is the same conflict the tray rail has: `slotBuilder`
  // cuts divider slots into two opposite walls, which is exactly where the
  // channel runs, and the pipeline cuts after it fuses — so the slots would
  // notch the bearing faces.
  if (input.isSolid) return NO_GEOMETRY('no-cavity');
  if (input.isTile) return NO_GEOMETRY('no-walls');
  if (input.isSlotted) return NO_GEOMETRY('slot-conflict');
  if (input.isPolygon) return NO_GEOMETRY('unsupported-shape');

  const c = slide.clearanceMm;
  const t = input.plateThicknessMm;

  // The wedge is whatever the plate can spare while keeping a real outer edge.
  // Reported through the rejection rather than clamped to nothing: a joint with
  // 0.1mm of engagement is a plate resting in a groove, not a captive one.
  const wedge = Math.min(SLIDE_WEDGE_MM, t - SLIDE_PLATE_EDGE_MIN_MM);
  if (wedge <= c) return NO_GEOMETRY('plate-too-thin');

  const travelsX = slideTravelsAlongX(slide.entrySide);
  // Canonical: travel along X, span along Y.
  const travelInner = travelsX ? innerW : innerD;
  const spanInner = travelsX ? innerD : innerW;

  const halfSpan = spanInner / 2;
  const plateHalfSpan = halfSpan - c;
  const plateSpan = 2 * plateHalfSpan;
  if (plateSpan < MIN_PLATE_SPAN_MM) return NO_GEOMETRY('bin-too-narrow');

  // Shelf and retainer reach, measured inboard from the channel wall's face.
  // The shelf reaches further: it carries, and the retainer only has to hook
  // the chamfer. Past `c + wedge` the retainer's underside has already risen
  // clear of the plate's flat top, so more reach would block the opening
  // without adding engagement.
  const shelfReach = c + SLIDE_BEARING_MM;
  const roofReach = c + wedge;
  // Bearing has to leave the plate a floor between the two shelves.
  if (plateSpan - 2 * shelfReach < MIN_PLATE_SPAN_MM / 2) return NO_GEOMETRY('bin-too-narrow');

  const plateTopBelowWallTop = slidePlateTopBelowWallTopMm(slide.placement, c, input.hasLip);
  // Everything the joint occupies below the plate's top plane: the plate, the
  // shelf's tip and its gusset. Checked against the interior so a 1U bin is
  // refused rather than shipped with a channel through its floor.
  const jointDepth = t + SLIDE_SHELF_TIP_MM + shelfReach;
  if (plateTopBelowWallTop + jointDepth >= input.cavityDepthMm) {
    return NO_GEOMETRY('bin-too-shallow');
  }

  const detentRise = slide.detent
    ? Math.min(c * DETENT_RISE_FRACTION_OF_CLEARANCE, DETENT_MAX_RISE_MM)
    : 0;
  const detentRun = detentRise;

  // Canonical X: the far wall's inner face, and the entry wall's outer face.
  // The plate seats one clearance off the far wall — which is the hard stop —
  // and reaches the outer face at the entry, so a closed lid fills its own
  // notch and the bin reads as finished.
  const leadingX = -travelInner / 2 + c;
  const detentPeakX = leadingX + DETENT_POCKET_INSET_MM;
  const trailingX = travelInner / 2 + input.entryWallThicknessMm;
  const plateLength = trailingX - leadingX;
  if (plateLength < MIN_PLATE_LENGTH_MM) return NO_GEOMETRY('bin-too-short');

  // Bars run the cavity's whole straight stretch, corner arcs included. Running
  // one INTO the arc is harmless — past the tangent the bar is inside the bin's
  // own corner material and the fuse is a no-op — and stopping short of it
  // instead would leave the detent's ramp, which sits right at the far end,
  // with no shelf under it to grow from.
  const cornerR = Math.max(GRIDFINITY_SPEC.BOX_CORNER_RADIUS - wallThickness, 0);
  const barXMin = -travelInner / 2;
  const barXMax = travelInner / 2;

  const bars: SlideLidBar[] = [];
  for (const wall of ['yMin', 'yMax'] as const) {
    // `inward` points from this wall toward the cavity centre.
    const wallY = wall === 'yMin' ? -halfSpan : halfSpan;
    const inward = wall === 'yMin' ? 1 : -1;
    const at = (u: number): number => wallY + inward * u;

    // SHELF. Flat top at the plate's underside — the plate rests ON it, since
    // clearance is a side gap and gravity settles the plate onto its bearing.
    // Underside runs back to the wall at 45°, so the cantilever the reference
    // design leaves unsupported is not there to support.
    bars.push({
      wall,
      kind: 'shelf',
      xMin: barXMin,
      xMax: barXMax,
      section: [
        [at(0), -t],
        [at(shelfReach), -t],
        [at(shelfReach), -t - SLIDE_SHELF_TIP_MM],
        [at(0), -t - SLIDE_SHELF_TIP_MM - shelfReach],
      ],
    });

    // RETAINER. Underside on the plane `z = u - wedge`, which is exactly one
    // clearance above the plate's chamfer at every u the two share — that
    // parallelism is what makes the joint hold without a square roof to bridge.
    bars.push({
      wall,
      kind: 'retainer',
      xMin: barXMin,
      xMax: barXMax,
      section: [
        [at(0), -wedge],
        [at(roofReach), roofReach - wedge],
        [at(roofReach), roofReach - wedge + SLIDE_ROOF_TIP_MM],
        [at(0), c + SLIDE_ROOF_TIP_MM],
      ],
    });
  }

  const detents: SlideLidDetent[] = [];
  const detentPockets: SlideLidDetentPocket[] = [];
  // Only when the ramp has shelf either side of it to grow from, and the pocket
  // has plate either side of it to be a pocket rather than a notch.
  if (
    slide.detent &&
    detentRise > 0.05 &&
    detentPeakX - detentRun >= barXMin &&
    detentPeakX + detentRun <= trailingX - 1
  ) {
    for (const wall of ['yMin', 'yMax'] as const) {
      const wallY = wall === 'yMin' ? -halfSpan : halfSpan;
      const inward = wall === 'yMin' ? 1 : -1;
      // Kept off the shelf's own tip so the bump has a full-thickness shelf
      // under it rather than the thin free edge.
      const near = wallY + inward * 0.2;
      const far = wallY + inward * (shelfReach - 0.2);
      detents.push({
        peakX: detentPeakX,
        runMm: detentRun,
        riseMm: detentRise,
        yMin: Math.min(near, far),
        yMax: Math.max(near, far),
        baseZ: -t,
      });
      // The pocket: the bump's own footprint plus slack on every face, so the
      // two seat rather than interfere. Derived here, from the bump that was
      // just placed, for the reason the field's own note gives.
      detentPockets.push({
        centerX: detentPeakX,
        yMin: Math.min(near, far) - DETENT_POCKET_SLACK_MM,
        yMax: Math.max(near, far) + DETENT_POCKET_SLACK_MM,
        lengthMm: 2 * (detentRun + DETENT_POCKET_SLACK_MM),
        depthMm: detentRise + DETENT_POCKET_SLACK_MM,
      });
    }
  }

  // ENTRY NOTCH. A window through the entry wall wide enough for the plate and
  // tall enough for it to pass under the retainers, cut clear THROUGH the rim
  // and the stacking lip above it.
  //
  // All the way through, not merely past the plate: anything left above the
  // window spans the whole opening as a horizontal bridge with no support under
  // it, and on a 3-wide bin that is 120mm of unsupported lintel. Stopping just
  // above the wall top is the version that looks right and is not — it leaves
  // exactly the lip band bridging, which is both the worst overhang on the part
  // and a contradiction of what the panel tells the user is happening.
  //
  // So the stacking lip really is interrupted on this one wall. That is the
  // trade `grip.binDip` already makes, `slideRimInterrupted` reports it, and
  // the bin still stacks on its other three walls and its corners.
  const notchTopAboveWallTop = input.hasLip ? GRIDFINITY_SPEC.LIP_HEIGHT + 1 : 1;
  const entryNotch: SlideLidBox = {
    xMin: travelInner / 2 - 0.1,
    xMax: trailingX + 1,
    yMin: -plateHalfSpan - c,
    yMax: plateHalfSpan + c,
    zMin: -t - c,
    zMax: plateTopBelowWallTop + notchTopAboveWallTop,
  };

  // TRAVEL ENVELOPE. Spans the whole cavity, because the plate sweeps the whole
  // opening — unlike a click lid's perimeter ring, which only has to clear a
  // rail at the walls. Its top is the retainer's top plane so a recessed
  // channel's cutter never enters the lip's band.
  const travelEnvelope: SlideLidBox = {
    xMin: -travelInner / 2,
    xMax: travelInner / 2,
    yMin: -halfSpan,
    yMax: halfSpan,
    zMin: -t - SLIDE_KEEPOUT_CLEARANCE_MM,
    zMax: c + SLIDE_ROOF_TIP_MM,
  };

  const pullSpan = Math.min(Math.max(plateSpan * 0.3, 12), 40);
  const pullReach = slide.pull === 'tab' ? 6 : slide.pull === 'notch' ? 5 : 0;

  return {
    rejection: null,
    geometry: {
      rotationDeg: ENTRY_ROTATION_DEG[slide.entrySide],
      entrySide: slide.entrySide,
      bars,
      detents,
      entryNotch,
      travelEnvelope,
      plate: {
        spanMm: plateSpan,
        lengthMm: plateLength,
        thicknessMm: t,
        wedgeMm: wedge,
        cornerRadiusMm: cornerR,
        leadingX,
        trailingX,
        pull: slide.pull,
        pullSpanMm: pullSpan,
        pullReachMm: pullReach,
        detentPockets,
      },
      plateTopBelowWallTopMm: plateTopBelowWallTop,
      // Clear of the bin once the leading edge passes the entry wall's outer
      // face — what the preview's slider runs to.
      travelMm: plateLength,
      freeSpanMm: plateSpan - 2 * shelfReach,
      clearanceMm: c,
    },
  };
}
