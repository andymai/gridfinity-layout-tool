/**
 * Hinged-lid geometry: where the barrel runs, which knuckles each part owns,
 * and the one envelope that keeps the lid clear of the bin through the swing.
 *
 * Lives in `shared` for the reason `labelTabPlan`, `dividerRailPlan` and
 * `slideLidPlan` do: several layers consume it and most of them cannot import
 * brepjs. The worker builds the bin's knuckles and the lid's from one call
 * here, so the two cannot disagree about where the axis is; the panel reads
 * the pin length; `checkLidCompatibility` explains a design this rejects; and
 * the preview poses the lid on the axis this names.
 *
 * ── THE AXIS ─────────────────────────────────────────────────────────────
 *
 * One number decides everything else, and it is chosen so that two unrelated
 * requirements land on the same value.
 *
 * The axis sits `BARREL_RADIUS + FACE_RELIEF` inboard of the wall's OUTER face,
 * so the barrel stops just short of that face. The bin's footprint therefore
 * does not grow by a single micron: it still drops into its own baseplate cell
 * and never fouls the bin behind it. A hinge that stuck out would be easier to
 * build and would not be a Gridfinity bin, which is why `hingeSwing.scenario`
 * asserts both parts against the SPEC width and not merely against each other.
 *
 * Exact tangency — inset by the radius alone — was the first attempt and is a
 * trap. It looks like the elegant answer (the barrel emerging from the face
 * with no step) and it means the cylinder meets the plane along a single line,
 * which is where booleans leave slivers and coincident faces. See
 * {@link LID_HINGE_FACE_RELIEF_MM}.
 *
 * Its height is the plane of the lid plate's UNDERSIDE. That is the plane at
 * which the following is true:
 *
 *     every lid point INBOARD of the axis sweeps forward and UP;
 *     every lid point OUTBOARD of the axis sweeps DOWN, into the bin's rim.
 *
 * ── THE INVARIANT ────────────────────────────────────────────────────────
 *
 * Which gives the rule the whole feature rests on:
 *
 *     A hinged lid keeps material outboard of the axis ONLY where that
 *     material lies inside the barrel envelope.
 *
 * The builder enforces it with ONE cut rather than a checklist. That single
 * boolean removes the mating shell on the hinge wall, trims the rear ends of
 * the two side shells (which would otherwise swing down into the lip), and
 * rounds the lid's nose into the tangent arc that reads as a piano hinge. A
 * feature added to the lid later is trimmed by it without its author knowing
 * the hinge exists — the same reason `lid.relieveInterior` runs last
 * (CLAUDE.md gotcha #18).
 *
 * The bin's half is the mirror of it:
 *
 *     The bin may keep material outboard of the axis ANYWHERE the lid has
 *     already swept past — everything below the trim plane at rest.
 *
 * That is the room the knuckle's root lives in, and it needs room because the
 * barrel reaches no bin material at all. See
 * {@link HingeGeometry.rootDepthBelowLipTopMm}.
 *
 * ── THE STOP ─────────────────────────────────────────────────────────────
 *
 * The trim plane sets WHEN the lid stops and a small lobe gives it the reach to
 * do so, and it is worth writing down why it takes both.
 *
 * Rotated by θ, the trim face sweeps a ray at `ψ₀ − θ`. The only bin material
 * anywhere along that ray is ONE point — the lip-top outer corner, `axisInsetMm`
 * outboard of the axis and `axisAboveLipTopMm` below it. Inboard of the corner
 * the ray is above the rim (air); outboard of it, past the wall (air). The face
 * reaches that point at exactly `ψ₀ − ψ_corner`, which is
 * {@link LID_HINGE_STOP_ANGLE_DEG} — and that is what `trimTiltDeg` is solved
 * for.
 *
 * What the face lacked was reach: at a knuckle it ends at `barrelRadiusMm`,
 * ~0.5mm short of the corner. {@link HingeGeometry.stopRadiusMm} is that
 * shortfall closed. The lobe's leading face IS the trim plane rather than a
 * surface of its own, so the two cannot disagree about the angle — widening the
 * lobe moves only its trailing edge.
 *
 * ── WHAT ACTUALLY BLOCKS A KNUCKLE ───────────────────────────────────────
 *
 * Only an ABSENCE at the rim: a wall cutout, an intruding handle, a knife
 * slot's blade exit, or a grip relief's bin dip. Those take away the material
 * the knuckle welds to.
 *
 * Compartment dividers and label tabs deliberately do NOT block, and saying so
 * is not an oversight. Both live inboard of the inner wall face and below the
 * rim; the barrel sits above the rim and hard against the OUTER face, so their
 * footprints and its envelope never meet. CLAUDE.md gotcha #19(b) is the
 * warning that which walls an obstruction takes is a question about its
 * footprint and never a property of its anchor — this is that question asked
 * in the other direction, and answered no.
 *
 * Blocking is never a whole-wall disable. A cutout in the middle of a wide
 * wall leaves usable stretches either side, each of which carries its own
 * knuckle group and its own pin.
 *
 * ── WHAT STILL HAS TO READ THIS, AND CANNOT YET ──────────────────────────
 *
 * The hinge NOTCHES the bin's stacking lip across every LID knuckle, and that
 * is lip an upper stacked bin registers on. Nothing measures it today.
 *
 * The natural home is a `LipGap` source alongside `cutout`, `handle` and
 * `knifeSlot`, which is what `unlippedSides` and the compatibility checks
 * already read — but `lipGapPlan` cannot import this module, because this one
 * imports `lipGaps` to find its own blocks. That cycle is the reason, and it
 * is worth knowing before someone tries: the fix is to lift the block-finding
 * half out, not to add the import. Until then a consumer must call
 * `planHingeLid` directly. CLAUDE.md gotcha #19 is exactly this failure in the
 * other direction — a plan that says "no lip here" that nothing reads.
 *
 * ── THE FRAME ────────────────────────────────────────────────────────────
 *
 * Runs and knuckles are stated in the bin's CENTRED INTERIOR frame along the
 * hinge wall, because that is the frame {@link WallSpanBlock} already uses and
 * a second frame would be a second chance to get an axis backwards. The cross
 * offset and the height are stated separately, and {@link HingeGeometry.rotationDeg}
 * maps the canonical wall (+Y, axis along X) onto the one the user chose.
 */

import {
  LID_FIT_CLEARANCE,
  LID_HINGE_BARREL_RADIUS_MM,
  LID_HINGE_BORE_MM,
  LID_HINGE_CORNER_INSET_MM,
  LID_HINGE_ENTRY_BORE_MM,
  LID_HINGE_FACE_RELIEF_MM,
  LID_HINGE_FIT_DEFAULT_MM,
  LID_HINGE_FIT_MAX_MM,
  LID_HINGE_FIT_MIN_MM,
  LID_HINGE_KNUCKLE_MIN_MM,
  LID_HINGE_KNUCKLE_TARGET_MM,
  LID_HINGE_MAX_KNUCKLES,
  LID_HINGE_MIN_KNUCKLES,
  LID_HINGE_MIN_RUN_MM,
  LID_HINGE_SEAM_CHAMFER_MM,
  LID_HINGE_STOP_ANGLE_DEG,
  LID_HINGE_STOP_MARGIN_MM,
  LID_HINGE_STOP_SECTOR_DEG,
  hingeOppositeSide,
  isHingeLid,
  lidAnchorZ,
  resolveLidCavityExtraMm,
  resolveLidHinge,
  resolveLidPlateThickness,
} from '@/shared/types/bin';
import type {
  BinParams,
  LidCompatibilitySide,
  LidHingeCatch,
  LidRailSide,
} from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { isPartialMask } from '@/shared/utils/cellMask';
import { labelTabInteriorDims, subtractSpan } from '@/shared/utils/labelTabPlan';
import type { RailSegment, WallSpanBlock } from '@/shared/utils/labelTabPlan';
import { lipGapRailBlocks, lipGaps } from '@/shared/utils/lipGapPlan';

/**
 * Recess (mm) at each end of a run between the pin's end and the barrel's.
 *
 * Keeps a cut-a-little-long pin from standing proud of the bin's face, which
 * is both the one visible failure of an otherwise invisible joint and the
 * thing that would stop two railed bins sitting side by side.
 */
const PIN_END_RECESS_MM = 0.5;

/** Why a design produces no hinge. Each one is explained by the panel. */
export type HingeRejection =
  /** The lid is not hinged. Not a fault — the resolver's "nothing to do". */
  | 'disabled'
  /** Custom-shape (cellMask) bins have no polygon-edge mapping yet. */
  | 'unsupported-shape'
  /** No stacking lip: nothing for the barrel to notch into, or the catch to grip. */
  | 'no-lip'
  /** The wall is shorter than the shortest run that can hold knuckles. */
  | 'wall-too-short'
  /** Cutouts, handles or a bin dip left no surviving stretch long enough. */
  | 'wall-obstructed';

/** One knuckle, and which part owns it. Nominal bands: they tile exactly. */
export interface HingeKnuckle {
  readonly lo: number;
  readonly hi: number;
  readonly owner: 'bin' | 'lid';
}

/** One unobstructed stretch of the hinge wall, and the knuckles laid in it. */
export interface HingeRun {
  readonly lo: number;
  readonly hi: number;
  readonly knuckles: readonly HingeKnuckle[];
  /**
   * Length (mm) of the filament offcut this run takes.
   *
   * Per run, not per hinge: a cutout that splits the wall leaves two barrels
   * that do not share an axis segment, so they take two pins. A bill of
   * materials that said "1 pin" there would be wrong in the one case the
   * segmentation exists to handle.
   */
  readonly pinLengthMm: number;
}

/** Everything the builders, the panel and the preview need. */
export interface HingeGeometry {
  readonly side: LidRailSide;
  /** True when the axis runs along X — the front and back walls. */
  readonly alongX: boolean;
  /** Rotation (deg, about Z) taking the canonical +Y wall onto {@link side}. */
  readonly rotationDeg: number;
  /**
   * Distance from the interior frame's centre to the axis, across the wall.
   * Always positive; {@link rotationDeg} decides which way it points.
   */
  readonly axisCrossMm: number;
  /**
   * Height of the axis above the bin's lip top.
   *
   * Derived from the lid rather than the bin: it is the plate underside's
   * plane, expressed in the bin's frame through the seam anchor that already
   * maps one to the other. Restating it from the bin's side would be a second
   * copy of the chain CLAUDE.md gotcha #14 warns about.
   */
  readonly axisAboveLipTopMm: number;
  readonly barrelRadiusMm: number;
  /**
   * Distance the axis sits inboard of the wall's OUTER face.
   *
   * The barrel's radius plus {@link LID_HINGE_FACE_RELIEF_MM}, so the two
   * builders resolve the axis from their own face rather than from a shared
   * coordinate — which is what lets the bin measure in its interior frame and
   * the lid in its own without either restating the other's origin.
   */
  readonly axisInsetMm: number;
  /**
   * Depth (mm) below the lip top that a bin knuckle's root reaches for.
   *
   * The barrel touches the bin NOWHERE. Inset from the outer face by its radius
   * plus a relief and raised to the plate's underside, it clears the lip's top
   * chamfer entirely: that chamfer recedes inboard as it rises, so the nearest
   * lip material lies `(axisInsetMm + axisAboveLipTopMm)/√2` from the axis,
   * further than {@link barrelRadiusMm} on every lip this app builds. Anything
   * that has to be ATTACHED must reach past that, not merely to the rim.
   *
   * The chamfer stops receding once it meets the lip's vertical section, which
   * is how deep a root has to go to stand on full-thickness material and no
   * deeper.
   */
  readonly rootDepthBelowLipTopMm: number;
  /**
   * Tilt (deg) of the plane that trims the lid's material outboard of the axis.
   *
   * DERIVED, not chosen. The trim face comes to rest against the bin's lip-top
   * outer corner, and that corner is not at the axis's height — it sits
   * `axisAboveLipTopMm` below it, `axisInsetMm` outboard, so it subtends
   * `atan2(-axisAboveLipTopMm, axisInsetMm)` — about -28° on a stock bin.
   * Tilting the trim by the stop angle alone would therefore stop the lid
   * ~28° early, and the first version of this did exactly that.
   *
   * Stated here rather than in the builder because it is the statement that
   * makes {@link stopAngleDeg} true, and a builder-local copy would be a
   * second place for the two to disagree.
   */
  readonly trimTiltDeg: number;
  /**
   * Radius (mm) the stop lobe reaches, measured from the axis.
   *
   * The lid's trim face is what butts against the bin, and the only bin
   * material along the ray it sweeps is ONE point: the lip-top outer corner,
   * `axisInsetMm` outboard and `axisAboveLipTopMm` below. At a knuckle the face
   * reaches only `barrelRadiusMm` — about half a millimetre short — so the stop
   * is not a missing mechanism but a missing half-millimetre of reach.
   */
  readonly stopRadiusMm: number;
  /** Angular width (deg) of that lobe. See {@link LID_HINGE_STOP_SECTOR_DEG}. */
  readonly stopSectorDeg: number;
  readonly boreMm: number;
  readonly entryBoreMm: number;
  readonly fitMm: number;
  readonly stopAngleDeg: number;
  readonly seamChamferMm: number;
  readonly runs: readonly HingeRun[];
  /** The wall the catch and the thumb lift belong on. */
  readonly catchSide: LidRailSide;
  /**
   * The catch the design asks for.
   *
   * Carried, validated and persisted; NOT yet built. No detent and no magnet
   * boss is generated for a hinged lid today, so a hinged bin closes on
   * friction and gravity alone. Stated here rather than left implicit because
   * a config field that silently does nothing is worse than an absent one, and
   * `hingeSwing.scenario` pins the absence so it cannot be forgotten.
   */
  readonly catchMode: LidHingeCatch;
}

export interface HingePlan {
  readonly geometry: HingeGeometry | null;
  readonly rejection: HingeRejection | null;
}

/** Rotation (deg about Z) taking the canonical +Y (back) wall onto `side`. */
function rotationForSide(side: LidRailSide): number {
  switch (side) {
    case 'back':
      return 0;
    case 'left':
      return 90;
    case 'front':
      return 180;
    case 'right':
      return 270;
  }
}

/**
 * Lay knuckles across one run.
 *
 * Always an ODD count, so the two END knuckles belong to the BIN. That is
 * three separate wins for one constraint: the roots at the ends are the ones
 * carrying the lid's weight and they are supported by the wall on both sides;
 * the lid is captured axially rather than able to slide off its own pin; and
 * the pin enters through bin material at both ends, which is what lets the
 * entry knuckle hold it.
 *
 * Returns `null` when the run cannot hold {@link LID_HINGE_MIN_KNUCKLES} at
 * the minimum width — a run filled with knuckles too small to hold is worse
 * than no run, because it looks like a hinge.
 */
function layKnuckles(lo: number, hi: number): readonly HingeKnuckle[] | null {
  const len = hi - lo;
  if (len < LID_HINGE_MIN_RUN_MM) return null;

  // Round to the nearest odd count at the target width, then walk down in
  // twos (staying odd) until every knuckle clears the minimum.
  const ideal = Math.round(len / LID_HINGE_KNUCKLE_TARGET_MM);
  let n = ideal % 2 === 0 ? ideal + 1 : ideal;
  n = Math.min(LID_HINGE_MAX_KNUCKLES, Math.max(LID_HINGE_MIN_KNUCKLES, n));
  while (n > LID_HINGE_MIN_KNUCKLES && len / n < LID_HINGE_KNUCKLE_MIN_MM) n -= 2;
  if (len / n < LID_HINGE_KNUCKLE_MIN_MM) return null;

  const w = len / n;
  const out: HingeKnuckle[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ lo: lo + i * w, hi: lo + (i + 1) * w, owner: i % 2 === 0 ? 'bin' : 'lid' });
  }
  return out;
}

/**
 * Stretches of the hinge wall no absence has taken.
 *
 * Only {@link lipGapRailBlocks} feeds this — see the module header on why
 * dividers and label tabs are deliberately absent from the list.
 */
function clearRuns(params: BinParams, side: LidCompatibilitySide, span: number): RailSegment[] {
  const lo = -span / 2 + LID_HINGE_CORNER_INSET_MM;
  const hi = span / 2 - LID_HINGE_CORNER_INSET_MM;
  if (hi <= lo) return [];

  let segments: RailSegment[] = [{ lo, hi }];
  const blocks: readonly WallSpanBlock[] = lipGapRailBlocks(lipGaps(params));
  for (const b of blocks) {
    if (b.side !== side) continue;
    segments = subtractSpan(segments, b.lo, b.hi);
    if (segments.length === 0) break;
  }
  return segments.filter((s) => s.hi - s.lo >= LID_HINGE_MIN_RUN_MM);
}

/** Clamp a stored fit clearance into the range the panel offers. */
export function resolveHingeFitMm(raw: number): number {
  if (!Number.isFinite(raw)) return LID_HINGE_FIT_DEFAULT_MM;
  return Math.min(LID_HINGE_FIT_MAX_MM, Math.max(LID_HINGE_FIT_MIN_MM, raw));
}

/**
 * Resolve this design's hinge, or say why it has none.
 *
 * Every rejection the builders could hit is decided here, so a caller that has
 * a `geometry` never has to repeat a check — the same contract
 * `resolveSlideGeometry` offers.
 */
export function planHingeLid(params: BinParams): HingePlan {
  if (!params.lid.enabled || !isHingeLid(params.lid)) {
    return { geometry: null, rejection: 'disabled' };
  }
  if (isPartialMask(params.cellMask)) {
    return { geometry: null, rejection: 'unsupported-shape' };
  }
  if (!params.base.stackingLip) {
    return { geometry: null, rejection: 'no-lip' };
  }
  const dims = labelTabInteriorDims(params);
  if (!dims) return { geometry: null, rejection: 'unsupported-shape' };

  const hinge = resolveLidHinge(params.lid);
  const side = hinge.side;
  const alongX = side === 'front' || side === 'back';
  const alongSpan = alongX ? dims.innerW : dims.innerD;
  const crossSpan = alongX ? dims.innerD : dims.innerW;

  if (alongSpan - 2 * LID_HINGE_CORNER_INSET_MM < LID_HINGE_MIN_RUN_MM) {
    return { geometry: null, rejection: 'wall-too-short' };
  }

  const runs: HingeRun[] = [];
  for (const seg of clearRuns(params, side, alongSpan)) {
    const knuckles = layKnuckles(seg.lo, seg.hi);
    if (!knuckles) continue;
    runs.push({
      lo: seg.lo,
      hi: seg.hi,
      knuckles,
      pinLengthMm: Math.round((seg.hi - seg.lo - 2 * PIN_END_RECESS_MM) * 10) / 10,
    });
  }
  if (runs.length === 0) return { geometry: null, rejection: 'wall-obstructed' };

  // Inboard of the OUTER face by the radius plus a relief, so the barrel stops
  // just short of the face instead of touching it along a tangent line.
  const axisInsetMm = LID_HINGE_BARREL_RADIUS_MM + LID_HINGE_FACE_RELIEF_MM;
  const axisCrossMm = crossSpan / 2 + params.wallThickness - axisInsetMm;

  // The plate's underside, expressed in the bin's frame. `lidAnchorZ` is where
  // the bin's lip top lands in lid-local Z, so subtracting it converts.
  const plateThickness = resolveLidPlateThickness(params);
  const anchorZ = lidAnchorZ(
    params.heightUnitMm,
    LID_FIT_CLEARANCE,
    resolveLidCavityExtraMm(params)
  );
  const axisAboveLipTopMm = -plateThickness - anchorZ;

  return {
    rejection: null,
    geometry: {
      side,
      alongX,
      rotationDeg: rotationForSide(side),
      axisCrossMm,
      axisAboveLipTopMm,
      axisInsetMm,
      rootDepthBelowLipTopMm: GRIDFINITY_SPEC.LIP_BIG_TAPER,
      barrelRadiusMm: LID_HINGE_BARREL_RADIUS_MM,
      trimTiltDeg:
        LID_HINGE_STOP_ANGLE_DEG -
        90 +
        (Math.atan2(-axisAboveLipTopMm, axisInsetMm) * 180) / Math.PI,
      // Reach to the corner, plus margin. The corner's ANGLE sets the stop and
      // is already folded into `trimTiltDeg`; its DISTANCE only says how far
      // the lobe has to stick out to touch it.
      stopRadiusMm: Math.hypot(axisInsetMm, axisAboveLipTopMm) + LID_HINGE_STOP_MARGIN_MM,
      stopSectorDeg: LID_HINGE_STOP_SECTOR_DEG,
      boreMm: LID_HINGE_BORE_MM,
      entryBoreMm: LID_HINGE_ENTRY_BORE_MM,
      fitMm: resolveHingeFitMm(hinge.fitClearanceMm),
      stopAngleDeg: LID_HINGE_STOP_ANGLE_DEG,
      seamChamferMm: LID_HINGE_SEAM_CHAMFER_MM,
      runs,
      catchSide: hingeOppositeSide(side),
      catchMode: hinge.catchMode,
    },
  };
}

/**
 * Every filament offcut this design needs, longest first.
 *
 * The export dialog's hardware line and the panel's live readout both read
 * this, so neither can quote a length the geometry does not use.
 */
export function hingePinLengths(params: BinParams): readonly number[] {
  const { geometry } = planHingeLid(params);
  if (!geometry) return [];
  return geometry.runs.map((r) => r.pinLengthMm).sort((a, b) => b - a);
}
