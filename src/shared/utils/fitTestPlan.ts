/**
 * Cutout fit-test card planning — pure, kernel-free, and shared.
 *
 * The card is a horizontal slice of the bin's own top, so three layers have to
 * agree about the same band: the worker that cuts it, the export dialog that
 * offers a thickness and an estimate before anything is generated, and the
 * seam nudge that keeps an oversize card's cut planes out of a cutout.
 * Re-deriving the band in each is the drift `labelTabPlan` exists to prevent,
 * so they all read this instead.
 *
 * The band's absolute Z is deliberately NOT here: the worker derives it from
 * `deriveDimensions` rather than restating the height chain (gotcha #14). This
 * plan answers how THICK the card is and what is in it, never where the bin's
 * fill surface sits.
 */

import type { BinParams, Cutout } from '@/shared/types/bin';
import {
  CHAMFER_SHAPES,
  CLEARANCE_SHAPES,
  DEFAULT_POLYGON_SIDES,
  resolveCutoutLeanDeg,
} from '@/shared/types/bin';
import { regularPolygonPoints } from '@/shared/utils/cutoutPolygon';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { overhangExpansion, resolveOverhang } from '@/shared/utils/overhang';
import { countFilled, isPartialMask } from '@/shared/utils/cellMask';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';

/** Thinnest card the field accepts (mm). Below this a chamfered rim has no
 *  straight wall under it and the card tears off the plate. */
export const FIT_TEST_MIN_THICKNESS_MM = 1;

/** Band the default thickness is clamped into (mm). The floor keeps a straight
 *  wall under the deepest entry chamfer the editor allows; the cap stops a
 *  20mm tool channel from printing most of a bin. */
const DEFAULT_THICKNESS_FLOOR_MM = 3;
const DEFAULT_THICKNESS_CAP_MM = 5;

/** Material kept between a seam and the nearest cutout (mm), so a nudged seam
 *  never shaves the wall of the hole being measured. */
export const FIT_TEST_SEAM_MARGIN_MM = 2;

/** A 1D interval on one axis, in the bin-centred model frame (mm). */
export interface AxisSpan {
  readonly min: number;
  readonly max: number;
}

/**
 * Every cutout the card physically contains: visible only, arrays expanded to
 * their instances. Hidden cutouts are excluded for the same reason the
 * generator excludes them — the card must match the bin it slices. Text
 * elements cut no pocket, so there is nothing on a card to test the fit of.
 */
export function fitTestCutouts(params: BinParams): Cutout[] {
  return params.cutouts
    .filter((c) => c.hidden !== true && c.shape !== 'text')
    .flatMap(expandCutoutArray);
}

/**
 * True when this design can produce a fit-test card at all.
 *
 * Gated on `base.solid` rather than `style === 'solid'` because that is what
 * `deriveDimensions` reads to decide the bin is filled, and what the Cutouts
 * section itself renders on. The two are kept in lockstep by the constraint
 * engine, but only one of them is the geometry's authority.
 */
export function canBuildFitTest(params: BinParams): boolean {
  return params.base.solid && fitTestCutouts(params).length > 0;
}

/** Deepest cut the card would have to reach to keep every pocket's floor (mm). */
export function deepestCutoutDepthMm(params: BinParams): number {
  return fitTestCutouts(params).reduce((deepest, c) => Math.max(deepest, c.cutDepth), 0);
}

/**
 * Thickness the dialog opens on: deep enough that a shallow board keeps every
 * floor, capped so a deep one stays a card rather than most of a bin.
 */
export function defaultFitTestThicknessMm(params: BinParams): number {
  const deepest = deepestCutoutDepthMm(params);
  return Math.min(DEFAULT_THICKNESS_CAP_MM, Math.max(DEFAULT_THICKNESS_FLOOR_MM, deepest));
}

/**
 * Legal thickness range. The ceiling is the deepest cut plus a floor under it:
 * past that every pocket already has its real bottom and more thickness only
 * re-prints bin — and it is additionally bounded by the material the body
 * actually offers below the fill surface. The editor lets `cutDepth` reach
 * the full `wallHeight`, and the builder clamps such a pocket to the solid
 * surface; a card sliced past that plane reaches into the Gridfinity socket,
 * whose feet are separate islands (CLAUDE.md gotcha #10) — an underside of
 * stubs that will not lie flat, with the stamp cut into mostly air.
 */
export function fitTestThicknessRangeMm(params: BinParams): { min: number; max: number } {
  const usable = usableCutDepthMm(params);
  const max = Math.max(
    FIT_TEST_MIN_THICKNESS_MM,
    Math.min(usable, Math.min(deepestCutoutDepthMm(params), usable) + params.wallThickness)
  );
  return { min: FIT_TEST_MIN_THICKNESS_MM, max };
}

/** Clamp an arbitrary thickness into the range this design allows. */
export function clampFitTestThicknessMm(params: BinParams, thicknessMm: number): number {
  const { min, max } = fitTestThicknessRangeMm(params);
  // The default is a 3-5mm band and can itself exceed the range on a design
  // whose deepest cut is under 3mm, so it goes through the same clamp rather
  // than being returned raw — the worker reaches this path whenever a caller
  // omits the thickness.
  const requested = Number.isFinite(thicknessMm) ? thicknessMm : defaultFitTestThicknessMm(params);
  return Math.min(max, Math.max(min, requested));
}

/**
 * Per-side growth of a cutout's opening, split by cause, matching
 * `buildCutoutCuts`' own arithmetic:
 * - `clearance` grows each DIMENSION by the whole value (half per side); a
 *   polygon scales anisotropically so it stays a regular N-gon, which grows
 *   its width by `width·clearance/depth` instead.
 * - the entry chamfer flares each SIDE by its own width at the rim, clamped so
 *   a straight wall survives below the bevel, and is skipped entirely under
 *   the builder's 0.05mm floor.
 *
 * Gated exactly as the builder gates them: a cutout switched from circle to
 * rectangle keeps its stale `clearance`, and the builder ignores it —
 * counting it here would reserve seam margin, and subtract volume, for
 * material that is never removed.
 */
function openingGrowthMm(cutout: Cutout): {
  clearanceW: number;
  clearanceD: number;
  chamfer: number;
} {
  const clearance = CLEARANCE_SHAPES.includes(cutout.shape)
    ? Math.max(0, cutout.clearance ?? 0)
    : 0;
  const clearanceW =
    cutout.shape === 'polygon' && cutout.depth > 0
      ? (cutout.width * clearance) / cutout.depth / 2
      : clearance / 2;
  const clearanceD = clearance / 2;
  const chamferRaw = CHAMFER_SHAPES.includes(cutout.shape) ? (cutout.chamferWidth ?? 0) : 0;
  const chamferClamped = Math.max(0, Math.min(chamferRaw, cutout.cutDepth - 0.2));
  return { clearanceW, clearanceD, chamfer: chamferClamped > 0.05 ? chamferClamped : 0 };
}

/**
 * Axis-aligned half-extents of a cutout's opening, rotation folded in.
 *
 * Clearance and the entry chamfer both widen the OPENING, which is the face the
 * card is measured at, so both count toward the footprint a seam has to miss.
 */
function openingHalfExtents(cutout: Cutout, usableDepthMm: number): { hx: number; hy: number } {
  const grow = openingGrowthMm(cutout);
  const hw = cutout.width / 2 + grow.clearanceW + grow.chamfer;
  let hd = cutout.depth / 2 + grow.clearanceD + grow.chamfer;
  // A leaned pocket sweeps past its drawn footprint along the local depth
  // axis: the mouth stretches by 1/cos(lean) and the floor travels a further
  // depth·sin(lean) to one side, at the depth the builder actually cuts
  // (`min(cutDepth, solidSurfaceZ)` — an over-deep cutDepth is clamped there,
  // so counting it raw would reserve seam margin for material never removed).
  // Reserved symmetrically (the travel side depends on the sign composed with
  // rotation), so the seam margin can only over-reserve sideways, never route
  // a cut plane through the swept pocket.
  const lean = resolveCutoutLeanDeg(cutout);
  if (lean !== 0) {
    const leanRad = (Math.abs(lean) * Math.PI) / 180;
    const cutDepth = Math.min(cutout.cutDepth, usableDepthMm);
    hd = hd / Math.cos(leanRad) + cutDepth * Math.sin(leanRad);
  }
  const rad = (cutout.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { hx: hw * cos + hd * sin, hy: hw * sin + hd * cos };
}

/** The material below the fill surface — what the builder clamps a pocket's
 *  depth against (its `solidSurfaceZ`). */
function usableCutDepthMm(params: BinParams): number {
  return Math.max(0, binDimensions(params).wallHeight - Math.max(0, params.cutoutConfig.topOffset));
}

/**
 * Each cutout's footprint per axis, in the bin-centred model frame the split
 * cut planes live in.
 *
 * Cutout x/y are relative to the expanded interior's bottom-left corner, and
 * that interior is itself offset inside the body under asymmetric overhang, so
 * both transforms have to be applied — the same pair `buildCutoutCuts` applies
 * when it places the real tools.
 */
export function fitTestCutoutSpans(params: BinParams): { x: AxisSpan[]; y: AxisSpan[] } {
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
  const usableDepth = usableCutDepthMm(params);
  const x: AxisSpan[] = [];
  const y: AxisSpan[] = [];
  for (const cutout of fitTestCutouts(params)) {
    const { hx, hy } = openingHalfExtents(cutout, usableDepth);
    const cx = cutout.x + cutout.width / 2 - innerW / 2 + offsetX;
    const cy = cutout.y + cutout.depth / 2 - innerD / 2 + offsetY;
    x.push({ min: cx - hx, max: cx + hx });
    y.push({ min: cy - hy, max: cy + hy });
  }
  return { x, y };
}

/** A cutout's opening as an axis-aligned box in the bin-centred model frame. */
export interface CutoutBox2D {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Every opening's footprint, for callers that need the 2D arrangement rather
 *  than the per-axis projections {@link fitTestCutoutSpans} gives. */
export function fitTestCutoutBoxes(params: BinParams): CutoutBox2D[] {
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(params);
  const usableDepth = usableCutDepthMm(params);
  return fitTestCutouts(params).map((cutout) => {
    const { hx, hy } = openingHalfExtents(cutout, usableDepth);
    const cx = cutout.x + cutout.width / 2 - innerW / 2 + offsetX;
    const cy = cutout.y + cutout.depth / 2 - innerD / 2 + offsetY;
    return { minX: cx - hx, maxX: cx + hx, minY: cy - hy, maxY: cy + hy };
  });
}

/** Where the underside stamp fits, in the bin-centred model frame. */
export interface StampArea {
  /**
   * X centre of the strip — the card body's own centre, which asymmetric
   * overhang shifts off the model origin. A stamp centred at 0 on such a card
   * hangs its glyphs past one wall.
   */
  readonly centerX: number;
  readonly centerY: number;
  readonly availW: number;
  readonly availD: number;
}

/** Clear material a stamp needs around it (mm). */
const STAMP_MARGIN_MM = 1.5;
/** Y resolution of the clear-strip search (mm). */
const STAMP_SCAN_STEP_MM = 1;

/**
 * A full-width strip of the underside with no opening through it, or null when
 * the board is too dense for one.
 *
 * Only the deep cutouts matter: a pocket shallower than the card keeps its
 * floor, so the underside below it is solid and a stamp there is unharmed. That
 * is why this takes the thickness rather than working off the footprints alone.
 *
 * "Shallower" has to leave room for the stamp itself, though — the glyphs are
 * cut `stampDepthMm` up from the underside, so a pocket that leaves a floor
 * thinner than that gets perforated by its own label.
 *
 * Searched from the front edge back, so the stamp lands where a maker looks
 * first and stays put as cutouts are added behind it.
 */
export function planFitTestStampArea(
  params: BinParams,
  thicknessMm: number,
  neededDepthMm: number,
  stampDepthMm = 0,
  split?: Pick<FitTestSplitPlan, 'planesX' | 'planesY'>
): StampArea | null {
  const { width, depth } = fitTestFootprintMm(params);
  if (neededDepthMm <= 0) return null;

  // Asymmetric overhang shifts the card body off the model origin — the same
  // offsets the cutout boxes below already carry — so the windows and the
  // strip's X centre follow the body, not the origin.
  const { offsetX, offsetY } = overhangExpansion(
    resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang)
  );

  // On a split card the stamp lands WHOLE on the widest X piece rather than
  // being bisected across a seam — the design name and fit line are the whole
  // point of the card, and half a glyph run on each piece reads as neither.
  const xEdges = [
    -width / 2 + offsetX,
    ...(split?.planesX ?? []).slice().sort((a, b) => a - b),
    width / 2 + offsetX,
  ];
  let window: { lo: number; hi: number } = { lo: xEdges[0], hi: xEdges[1] };
  for (let i = 1; i + 1 < xEdges.length; i++) {
    if (xEdges[i + 1] - xEdges[i] > window.hi - window.lo) {
      window = { lo: xEdges[i], hi: xEdges[i + 1] };
    }
  }
  const availW = window.hi - window.lo - 2 * (params.wallThickness + STAMP_MARGIN_MM);
  if (availW <= 0) return null;
  const centerX = (window.lo + window.hi) / 2;

  const cutouts = fitTestCutouts(params);
  const boxes = fitTestCutoutBoxes(params);
  const floorLimit = thicknessMm - stampDepthMm;
  const throughBoxes = boxes.filter((_, i) => cutouts[i].cutDepth >= floorLimit);
  // A horizontal seam blocks a strip the same way a through-hole does: glyphs
  // cut across the kerf are lost on both pieces.
  const seamBoxes = (split?.planesY ?? []).map((plane) => ({ minY: plane, maxY: plane }));

  const half = depth / 2 - params.wallThickness - STAMP_MARGIN_MM;
  for (let y = -half + offsetY; y + neededDepthMm <= half + offsetY; y += STAMP_SCAN_STEP_MM) {
    const lo = y - STAMP_MARGIN_MM;
    const hi = y + neededDepthMm + STAMP_MARGIN_MM;
    const clear =
      throughBoxes.every((b) => b.maxY <= lo || b.minY >= hi) &&
      seamBoxes.every((b) => b.maxY <= lo || b.minY >= hi);
    if (clear) {
      return { centerX, centerY: y + neededDepthMm / 2, availW, availD: neededDepthMm };
    }
  }
  return null;
}

/** Merge overlapping spans, each first padded by `margin`, into ordered blocks. */
function mergeSpans(spans: readonly AxisSpan[], margin: number): AxisSpan[] {
  const padded = spans
    .map((s) => ({ min: s.min - margin, max: s.max + margin }))
    .sort((a, b) => a.min - b.min);
  const merged: AxisSpan[] = [];
  for (const span of padded) {
    if (merged.length === 0) {
      merged.push(span);
      continue;
    }
    const last = merged[merged.length - 1];
    if (span.min <= last.max) {
      merged[merged.length - 1] = { min: last.min, max: Math.max(last.max, span.max) };
    } else {
      merged.push(span);
    }
  }
  return merged;
}

/** Outcome of moving one axis's cut planes clear of the cutouts on that axis. */
export interface SeamPlan {
  /** Planes in ascending order, nudged where a clear position was reachable. */
  readonly planes: readonly number[];
  /** Planes left crossing a cutout because no clear position was within reach. */
  readonly blocked: number;
}

/**
 * Shift each cut plane out of any cutout it crosses, mirroring
 * `shiftCutPlanesOffCellBoundaries` — which already moves a plane off a wall it
 * would land on. Same idiom, applied to cutout footprints.
 *
 * A plane may travel at most `limitMm`, which is the caller's remaining print-bed
 * slack: moving a seam grows the piece on one side, and a card that misses every
 * cutout but overshoots the bed is no more printable than one that does not.
 * A plane with no reachable clear position stays put and is counted in
 * {@link SeamPlan.blocked}, because a seam through the hole being measured has
 * to be reported rather than silently shipped.
 */
export function nudgeSeamsClearOfCutouts(
  planes: readonly number[],
  spans: readonly AxisSpan[],
  limitMm: number,
  bounds?: { readonly min: number; readonly max: number }
): SeamPlan {
  if (planes.length === 0 || spans.length === 0) return { planes: [...planes], blocked: 0 };

  const blocks = mergeSpans(spans, FIT_TEST_SEAM_MARGIN_MM);
  let blocked = 0;

  const moved = planes.map((plane) => {
    const hit = blocks.find((b) => plane > b.min && plane < b.max);
    if (!hit) return plane;

    // Only the two edges of the blocking run are candidates: any clear position
    // further out is strictly further away, so the nearer edge always wins.
    //
    // A candidate also has to stay inside the card. A cutout flush against the
    // interior edge puts `hit.max` past the outer face once the seam margin is
    // added, and a plane beyond the card's own bounds hands the splitter a
    // negative-width piece.
    const inBounds = (c: number): boolean =>
      !bounds || (c > bounds.min + 1e-6 && c < bounds.max - 1e-6);
    const candidates = [hit.min, hit.max].filter(
      (c) => Math.abs(c - plane) <= limitMm && inBounds(c)
    );
    if (candidates.length === 0) {
      blocked += 1;
      return plane;
    }
    return candidates.reduce((best, c) =>
      Math.abs(c - plane) < Math.abs(best - plane) ? c : best
    );
  });

  // Two planes nudged toward the same gap land on the same edge, and keeping
  // one of them merges their two pieces into a single oversize one. Dropping
  // the duplicate is the only option — a seam cannot sit inside a cutout — but
  // the result no longer fits the bed, so it counts as blocked rather than
  // passing silently.
  const ordered = [...moved].sort((a, b) => a - b);
  const distinct = ordered.filter((p, i) => i === 0 || p - ordered[i - 1] > 1e-6);
  return { planes: distinct, blocked: blocked + (ordered.length - distinct.length) };
}

/** Print bed, in mm. */
export interface BedSize {
  readonly width: number;
  readonly depth: number;
}

/** How the card will be cut, if at all. */
export interface FitTestSplitPlan {
  /** Cut planes along X, in the bin-centred model frame. */
  readonly planesX: readonly number[];
  /** Cut planes along Y. */
  readonly planesY: readonly number[];
  /** Pieces the card comes out in. 1 means it is whole. */
  readonly pieceCount: number;
  /** Seams that still cross an opening, making that hole unmeasurable. */
  readonly blockedSeams: number;
}

/**
 * The card's XY footprint. The slice bounds material in Z only, so whatever the
 * body spans, the card spans.
 *
 * Overhang grows the body past the nominal grid extent, and a plan built on the
 * nominal figure calls an oversize card whole: the worker then measures the real
 * bounds, decides it does not fit, and re-runs this same plan — which hands back
 * one piece anyway. The dialog stays silent too, because it reads this plan.
 * Gotcha #8: anything bounding material by the extent has to widen by the
 * overhang.
 */
export function fitTestFootprintMm(params: BinParams): { width: number; depth: number } {
  const { outerW, outerD } = binDimensions(params);
  const { addW, addD } = overhangExpansion(
    resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang)
  );
  return { width: outerW + addW, depth: outerD + addD };
}

/**
 * Where the card gets cut for a given bed, seams nudged clear of the openings.
 *
 * Shared by the worker that cuts it and the export dialog that warns about it,
 * so the dialog cannot promise a whole card and hand over four pieces — or stay
 * quiet about a seam through the hole being measured.
 *
 * `splitPlanes` is injected rather than imported so this stays free of the
 * generation feature; callers pass `getSplitPlanePositionsMm`.
 */
export function planFitTestSplit(
  params: BinParams,
  bed: BedSize | undefined,
  splitPlanes: (sizeUnits: number, maxUnits: number, pitchMm: number) => number[]
): FitTestSplitPlan {
  const whole: FitTestSplitPlan = { planesX: [], planesY: [], pieceCount: 1, blockedSeams: 0 };
  if (!bed) return whole;

  const footprint = fitTestFootprintMm(params);
  if (footprint.width <= bed.width && footprint.depth <= bed.depth) return whole;

  const pitchX = params.gridUnitMm;
  const pitchY = params.gridUnitMmY ?? params.gridUnitMm;
  // The overhang eats bed width before the first cell does, so it comes off the
  // bed rather than being ignored — otherwise the footprint check above calls
  // the card oversize and the plane count still says it fits in one piece.
  const usableW = bed.width - (footprint.width - binDimensions(params).outerW);
  const usableD = bed.depth - (footprint.depth - binDimensions(params).outerD);
  const rawX = splitPlanes(params.width, Math.max(1, Math.floor(usableW / pitchX)), pitchX);
  const rawY = splitPlanes(params.depth, Math.max(1, Math.floor(usableD / pitchY)), pitchY);
  if (rawX.length === 0 && rawY.length === 0) return whole;

  // A seam may travel only as far as the bed slack allows: moving a plane into
  // a clear gap still has to leave both neighbouring pieces printable. The
  // card's REAL bounds follow the overhang offset (the body spans
  // [-outerW/2 - left, outerW/2 + right]); symmetric bounds would let a nudged
  // seam step past one edge and build a cutter that intersects nothing.
  const spans = fitTestCutoutSpans(params);
  const { offsetX, offsetY } = overhangExpansion(
    resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang)
  );
  const halfW = footprint.width / 2;
  const halfD = footprint.depth / 2;
  const planX = nudgeSeamsClearOfCutouts(
    rawX,
    spans.x,
    Math.max(0, bed.width - (params.width * pitchX) / (rawX.length + 1)),
    { min: -halfW + offsetX, max: halfW + offsetX }
  );
  const planY = nudgeSeamsClearOfCutouts(
    rawY,
    spans.y,
    Math.max(0, bed.depth - (params.depth * pitchY) / (rawY.length + 1)),
    { min: -halfD + offsetY, max: halfD + offsetY }
  );

  return {
    planesX: planX.planes,
    planesY: planY.planes,
    pieceCount: (planX.planes.length + 1) * (planY.planes.length + 1),
    blockedSeams: planX.blocked + planY.blocked,
  };
}

/** Shoelace area of a closed polygon, sign-independent. */
function polygonArea(points: readonly { readonly x: number; readonly y: number }[]): number {
  if (points.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

/** Area (mm²) a cutout's opening removes from the card's top face. */
function openingAreaMm2(cutout: Cutout): number {
  // Clearance only: the chamfer's flare reaches its full width exactly at the
  // rim, so charging the flared area for the whole depth would overstate the
  // displaced volume by the flare times nearly the full cut.
  const grow = openingGrowthMm(cutout);
  const w = cutout.width + 2 * grow.clearanceW;
  const d = cutout.depth + 2 * grow.clearanceD;
  switch (cutout.shape) {
    case 'circle':
      return Math.PI * (w / 2) ** 2;
    case 'polygon':
      // Measured off the outline the generator actually cuts rather than from a
      // circumradius: `regularPolygonPoints` scales the unit polygon
      // ANISOTROPICALLY to fill the w×d box, and a flat-top polygon's own
      // aspect is not 1 (a hexagon is ~1.1547 wide per unit tall), so an
      // inscribed-circle formula is wrong even when width equals depth.
      return polygonArea(regularPolygonPoints(cutout.sides ?? DEFAULT_POLYGON_SIDES, w, d));
    case 'slot':
    case 'knifeSlot': {
      // Stadium: a rectangle with a semicircle on each short end.
      const r = Math.min(w, d) / 2;
      return (Math.max(w, d) - 2 * r) * 2 * r + Math.PI * r * r;
    }
    case 'rectangle': {
      const r = Math.min(cutout.cornerRadius, Math.min(w, d) / 2);
      return w * d - (4 - Math.PI) * r * r;
    }
    // A freeform path and a scanned mesh have no closed-form area. Their
    // bounding box overstates the material removed, so the card's estimate
    // comes out LOW rather than promising a print that costs more than shown.
    case 'path':
    case 'mesh':
      return w * d;
    // A text element removes no opening from the card.
    case 'text':
      return 0;
  }
}

/**
 * Material (mm³) the openings remove, counted no deeper than `maxDepthMm`.
 *
 * Shared with the bin's own volume estimate so a shadow board's cutouts are
 * priced by ONE model: the card and the bin it is compared against cannot
 * disagree about how much a pocket takes out.
 */
export function cutoutDisplacementMm3(params: BinParams, maxDepthMm = Infinity): number {
  const volumeOf = (cutout: Cutout): number =>
    openingAreaMm2(cutout) * Math.min(cutout.cutDepth, maxDepthMm);

  // Members of a pathfinder group are NOT additive: `subtract`, `intersect` and
  // `exclude` all put material back, so summing them removes more than the
  // group ever cuts and can drive a dense board's estimate to zero. The group's
  // largest member is the honest bound for those; only `union` accumulates.
  let total = 0;
  const groups = new Map<string, number>();
  for (const cutout of fitTestCutouts(params)) {
    const volume = volumeOf(cutout);
    if (cutout.groupId === null || (cutout.groupOp ?? 'union') === 'union') {
      total += volume;
      continue;
    }
    groups.set(cutout.groupId, Math.max(groups.get(cutout.groupId) ?? 0, volume));
  }
  for (const largest of groups.values()) total += largest;
  return total;
}

/**
 * Material (mm³) in the card, for the dialog's comparison against a whole bin.
 *
 * `estimatePrint` derives its volume from `BinParams` via `computeBinVolume`
 * and has no way to describe a slice, so the card needs its own term: the band
 * as a slab, less each opening's displacement within it. Not trusted on the
 * strength of the arithmetic — `fitTestSlice.scenario.test.ts` checks it
 * against `meshVolume` of real generated cards (gotcha #21).
 */
export function estimateFitTestVolumeMm3(params: BinParams, thicknessMm: number): number {
  const { width, depth } = fitTestFootprintMm(params);
  const r = GRIDFINITY_SPEC.BOX_CORNER_RADIUS;
  let slabArea = width * depth - (4 - Math.PI) * r * r;

  // A partial mask carves whole cells out of the footprint, exactly as
  // `solidFillVolume` accounts for on the bin it is compared against — without
  // this an L-shaped board's card reads close to twice its real cost.
  if (isPartialMask(params.cellMask)) {
    const cells = params.width * params.depth;
    if (cells > 0) slabArea *= countFilled(params.cellMask) / cells;
  }

  return Math.max(0, slabArea * thicknessMm - cutoutDisplacementMm3(params, thicknessMm));
}

/** What the underside stamp needs beyond the params: the design's name, which
 *  lives on the designer store, not in `BinParams`. */
export interface FitTestStampContext {
  readonly designName?: string;
}

/**
 * The lines debossed into the card's underside. The cut plane is a flat,
 * feature-free face that lands on the bed, so it is the one surface a stamp
 * costs nothing — and a bench with three iterations on it is unreadable
 * without one.
 */
export function fitTestStampLines(
  params: BinParams,
  thicknessMm: number,
  context: FitTestStampContext = {}
): string[] {
  // Only shapes that take a clearance carry one; a rectangle cuts to exact size
  // and would otherwise drag the range down to 0.00 on every mixed board.
  const clearances = fitTestCutouts(params)
    .filter((c) => c.shape !== 'rectangle')
    .map((c) => c.clearance ?? 0);
  const lo = clearances.length > 0 ? Math.min(...clearances) : 0;
  const hi = clearances.length > 0 ? Math.max(...clearances) : 0;
  const fit = lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)}-${hi.toFixed(2)}`;

  return [context.designName?.trim() || 'Fit test', `fit ${fit} · ${thicknessMm}mm`];
}
