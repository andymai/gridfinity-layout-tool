/**
 * Where a wall cutout sits along its wall, and how its two corners are rounded.
 *
 * Pure and kernel-free, because four layers have to agree on the answers and
 * only one of them can import brepjs: the geometry builder, the wall-pattern
 * clip that clears hex prisms out of the cut's border, the ghost outline the
 * preview draws during regeneration, and `lipGapPlan`, which has to know how
 * wide the opening is AT THE LIP before it can say what rail a lid keeps.
 */

import type { BinParams, WallCutoutShape } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';

/** A cutout's stored span: an absolute mm override, or null to use the %. */
export interface CutoutSpanSource {
  readonly width: number;
  readonly widthMm: number | null;
}

/** A cutout's stored drop: an absolute mm override, or absent to use the %. */
export interface CutoutDropSource {
  readonly depth: number;
  readonly depthMm?: number | null;
}

/**
 * Resolve an override/percentage pair against the run it is measured along.
 *
 * Any finite number counts, zero and negatives included: those resolve to a cut
 * too small to build and the callers' `< 0.1` guards drop it, which is what a
 * design carrying `widthMm: 0` already means. Only a value that is no number at
 * all defers to the percentage — a hand-authored design can carry anything, and
 * `Math.min(NaN, run)` is NaN, which passes those same guards and reaches the
 * kernel.
 */
function resolveOverride(mm: number | null | undefined, percent: number, run: number): number {
  if (typeof mm === 'number' && Number.isFinite(mm)) return Math.min(mm, run);
  return run * (percent / 100);
}

/**
 * How far a cutout spans along its wall, in mm.
 *
 * `wallSpan` is the wall's interior length, and doubles as the ceiling an
 * absolute override is clamped to.
 */
export function resolveCutoutSpan(cfg: CutoutSpanSource, wallSpan: number): number {
  return resolveOverride(cfg.widthMm, cfg.width, wallSpan);
}

/**
 * How far a cutout reaches down from the top of its wall, in mm.
 *
 * `wallRun` is the material the cut is measured against, and it differs per
 * caller — the outer walls use the interior height, an interior divider its
 * own standing height. An absolute drop is what holds one cut line across bins
 * of different heights; a percentage cannot, which is the point of the
 * override.
 */
export function resolveCutoutDrop(cfg: CutoutDropSource, wallRun: number): number {
  return resolveOverride(cfg.depthMm, cfg.depth, wallRun);
}

/**
 * Compute the horizontal center of a wall cutout accounting for alignment and offset.
 *
 * @returns horizontal center coordinate relative to wall center (0 = centered on span)
 */
export function computeCutoutCenter(
  wallSpan: number,
  cutWidth: number,
  wallThickness: number,
  alignment: 'left' | 'center' | 'right',
  offset: number
): number {
  const halfSpan = wallSpan / 2;
  const halfCut = cutWidth / 2;
  const margin = wallThickness; // auto-margin from corner for structural integrity

  let anchor: number;
  switch (alignment) {
    case 'left':
      anchor = -halfSpan + margin + halfCut;
      break;
    case 'right':
      anchor = halfSpan - margin - halfCut;
      break;
    default:
      anchor = 0;
  }

  // Apply offset, clamped so cutout respects corner margin on both sides
  const raw = anchor + offset;
  const minCenter = -halfSpan + margin + halfCut;
  const maxCenter = halfSpan - margin - halfCut;
  // If cutout is too wide for margin, allow it centered (degenerate case)
  if (minCenter > maxCenter) return 0;
  return Math.max(minCenter, Math.min(maxCenter, raw));
}

/** Largest corner radius the panel accepts, in mm. */
export const MAX_CUTOUT_CORNER_RADIUS = 25;

/**
 * Below this a corner is drawn square.
 *
 * Snapped in the clamp rather than at each drawing site so every layer agrees
 * on which corners exist: a radius the profile declines to draw must also be a
 * radius `lipGapPlan` declines to widen the lip gap by, and one the ghost
 * outline declines to tessellate.
 */
export const MIN_CUTOUT_CORNER_RADIUS = 0.1;

/**
 * Auto-compute the bottom fillet: 15% of the cutout's span, clamped to
 * [0.5, 5] mm.
 *
 * Deliberately independent of the cut height — at 100% height the cut tracks
 * the wall, so a height term makes the bin's HEIGHT change the corner look of
 * an otherwise untouched cutout. Degenerately short or narrow cutouts
 * are still bounded by the profile's width/2 and height/2 guards.
 */
export function autoCornerRadius(cutWidth: number): number {
  return Math.max(0.5, Math.min(5, cutWidth * 0.15));
}

/** The two corner-radius fields a wall cutout resolves to, in mm. */
export interface CutoutCornerRadii {
  /**
   * Round-over where the cut meets the top of the material — the sharp
   * shoulder left standing beside the opening. 0 = square, the shape every
   * design had before the control existed.
   */
  readonly top: number;
  /** Fillet at the bottom of the cut. */
  readonly bottom: number;
}

/** The corner fields as they are stored: null defers to the next level up. */
export interface CutoutCornerSource {
  readonly cornerRadiusTop?: number | null;
  readonly cornerRadiusBottom?: number | null;
}

/**
 * Resolve one cutout's corner radii from its side and the wall-level defaults.
 *
 * Two levels of `null`, meaning the same thing at both: defer. A side that
 * says nothing takes the wall's value; a wall that says nothing takes the
 * built-in rule — square at the top, {@link autoCornerRadius} at the bottom.
 * That is what keeps a design saved before this control existed generating
 * byte-identical geometry.
 *
 * Only clamps to the control's own range here. The profile builder clamps
 * again against the cut it is actually drawing, which it can and this cannot:
 * the material standing beside the opening is a property of the wall, not of
 * the setting.
 *
 * A scoop resolves no bottom radius whatever is stored: the panel does not
 * offer one, and a radius the arc never draws would still cap its top
 * round-over in {@link safeCutoutCornerRadii}.
 */
export function resolveCutoutCornerRadii(
  wall: (CutoutCornerSource & { readonly shape?: WallCutoutShape }) | undefined,
  side: CutoutCornerSource | undefined,
  cutWidth: number
): CutoutCornerRadii {
  const clamp = (v: number): number => Math.max(0, Math.min(MAX_CUTOUT_CORNER_RADIUS, v));
  const top = side?.cornerRadiusTop ?? wall?.cornerRadiusTop ?? null;
  const resolvedTop = top === null ? 0 : clamp(top);
  if (!cutoutHasBottomCorner(wall?.shape)) return { top: resolvedTop, bottom: 0 };
  const bottom = side?.cornerRadiusBottom ?? wall?.cornerRadiusBottom ?? null;
  return {
    top: resolvedTop,
    bottom: bottom === null ? autoCornerRadius(cutWidth) : clamp(bottom),
  };
}

/** A scoop's floor is its own arc, so it has no bottom corner to round. */
export function cutoutHasBottomCorner(shape: WallCutoutShape | undefined): boolean {
  return shape !== 'scoop';
}

/** Wall material left standing on each side of a cutout, in mm along the span. */
export interface CornerSlack {
  readonly left: number;
  readonly right: number;
}

/** No neighbouring wall constraint: used by callers that don't sit in a span. */
export const UNBOUNDED_SLACK: CornerSlack = { left: Infinity, right: Infinity };

/**
 * Wall left standing on each side of a cutout that spans `cutWidth` and is
 * centred `centerOffset` from the wall's midpoint.
 */
export function cornerSlackFor(
  wallSpan: number,
  cutWidth: number,
  centerOffset: number
): CornerSlack {
  const halfSpan = wallSpan / 2;
  return {
    left: Math.max(0, centerOffset - cutWidth / 2 + halfSpan),
    right: Math.max(0, halfSpan - (centerOffset + cutWidth / 2)),
  };
}

/** One cutout's corner radii after every clamp, per end of the span. */
export interface SafeCornerRadii {
  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomLeft: number;
  readonly bottomRight: number;
}

/**
 * Clamp the resolved radii against the cut actually being made.
 *
 * Pure and kernel-free because the profile builder is not the only consumer:
 * a top round-over widens the opening AT THE LIP by its own radius on each
 * side, so `lipGapPlan` has to reach the same numbers before it can say what
 * rail a click-lock lid keeps. A rail placed against the nominal span would
 * hang over the flare and grip nothing — while colliding with nothing, which
 * is why no interference probe reports it.
 *
 * Three bounds, each per-corner because alignment and offset can leave one end
 * of a cut flush against the wall's end and the other deep in material:
 *
 * - The wall left standing beside the cut (`cornerSlack`). A blend only reads
 *   as a blend when there is material for it to run into; a full-width cut has
 *   none, so a bottom fillet would stand up as a free tapering fin and a top
 *   round-over would carve the neighbouring wall instead of its own shoulder.
 * - The cut's own depth. "The shoulder round is never deeper than the opening"
 *   is a rule a user can predict, and it keeps the round-over off the floor.
 * - Each other. The two blends meet on the same side of the cut, so the run
 *   between them has to survive or the profile folds through itself.
 *
 * `lipRoom` is the material standing above the nominal wall top: the
 * `extraWallHeightMm` collar plus the stacking lip's height, or zero without
 * either. The cut's side runs from there down to its floor, and that is the
 * room the two blends share.
 */
export function safeCutoutCornerRadii(
  radii: CutoutCornerRadii,
  cutWidth: number,
  userCutHeight: number,
  lipRoom: number,
  cornerSlack: CornerSlack = UNBOUNDED_SLACK
): SafeCornerRadii {
  const sideRun = userCutHeight + lipRoom;
  const bottom = Math.min(radii.bottom, cutWidth / 2 - 0.01, userCutHeight / 2 - 0.01);
  const top = Math.min(radii.top, userCutHeight - 0.05);
  const bottomLeft = Math.max(0, Math.min(bottom, cornerSlack.left));
  const bottomRight = Math.max(0, Math.min(bottom, cornerSlack.right));
  const fits = (r: number, sameSideBottom: number): number =>
    snap(Math.min(r, sideRun - sameSideBottom - 0.05));
  return {
    bottomLeft: snap(bottomLeft),
    bottomRight: snap(bottomRight),
    topLeft: fits(Math.min(top, cornerSlack.left), bottomLeft),
    topRight: fits(Math.min(top, cornerSlack.right), bottomRight),
  };
}

/** A funnel's floor spans this fraction of its opening. */
export const FUNNEL_TAPER_RATIO = 0.6;

/** The straight run of a u-shape's or funnel's side, half-widths from the cut's centre. */
export interface CutoutSide {
  readonly bottomHalfWidth: number;
  /** Outboard travel per mm of rise: 0 for a u-shape. */
  readonly lean: number;
  /** Where the side, extended, meets the rim. */
  readonly halfWidthAtRim: number;
}

/**
 * The side runs from the profile's top corner, `rimClearance` above the rim at
 * half the span, down to the floor `drop` below the rim. A top round-over
 * rounds the shoulder off this line rather than moving it, so the taper below
 * a rounded shoulder is the taper below a square one.
 */
export function cutoutSide(
  shape: 'u-shape' | 'funnel',
  cutWidth: number,
  drop: number,
  rimClearance: number
): CutoutSide {
  const topHalfWidth = cutWidth / 2;
  const bottomHalfWidth = shape === 'funnel' ? topHalfWidth * FUNNEL_TAPER_RATIO : topHalfWidth;
  const lean = (topHalfWidth - bottomHalfWidth) / (drop + rimClearance);
  return { bottomHalfWidth, lean, halfWidthAtRim: topHalfWidth - lean * rimClearance };
}

type Point = readonly [number, number];

/**
 * A top round-over tangent to both the rim plane and the cut's own side, in
 * the cut's frame for the right-hand end of the span (mirror x for the left).
 *
 * `lean` is how far the side moves outboard per mm it rises: 0 for a u-shape,
 * positive for a funnel. On a leaning side the blend lands on the slope rather
 * than dropping vertically onto it, and it reaches less than its radius both
 * along the rim and down the side, because the corner it rounds is obtuse.
 */
export interface ShoulderBlend {
  readonly radius: number;
  readonly centre: Point;
  /** Where the arc leaves the rim, directly above the centre. */
  readonly rim: Point;
  /** Where it lands on the side. */
  readonly side: Point;
  /** Halfway round the arc, the third point a three-point arc needs. */
  readonly mid: Point;
  /** Angle the arc turns through from `rim` to `side`, in radians. */
  readonly sweep: number;
}

/** `sideAtRim` is where the side, extended, meets the rim plane at `rimY`. */
export function shoulderBlend(
  sideAtRim: number,
  rimY: number,
  lean: number,
  radius: number
): ShoulderBlend {
  const slope = Math.hypot(1, lean);
  const reach = radius / (slope + lean);
  const centre: Point = [sideAtRim + reach, rimY - radius];
  const sweep = Math.PI / 2 - Math.atan(lean);
  return {
    radius,
    centre,
    rim: [centre[0], rimY],
    side: [sideAtRim - (reach * lean) / slope, rimY - reach / slope],
    mid: [centre[0] - radius * Math.sin(sweep / 2), centre[1] + radius * Math.cos(sweep / 2)],
    sweep,
  };
}

/**
 * Whether the outer wall cutouts carry straight through the fixed dividers.
 *
 * Needs the interior toggle and at least one outer side. Interior-only designs
 * keep a window centred on each divider run: with no outer opening there is
 * no path to follow.
 */
export function wallCutoutPathsActive(
  params: Pick<BinParams, 'walls' | 'style' | 'cellMask'>
): boolean {
  const { walls } = params;
  return (
    walls.enabled &&
    walls.interior.enabled &&
    params.style === 'standard' &&
    !isPartialMask(params.cellMask) &&
    (walls.front.enabled || walls.back.enabled || walls.left.enabled || walls.right.enabled)
  );
}

/** What {@link cutoutFloorRise} needs to trace the bottom edge of one cut. */
export interface CutoutFloorProfile {
  readonly shape: WallCutoutShape;
  readonly cutWidth: number;
  /** How far the cut reaches below the nominal wall top. */
  readonly drop: number;
  /** Collar plus stacking lip standing above the nominal wall top. */
  readonly lipRoom: number;
  readonly collarHeight: number;
  /** The run between the profile's top edge and the rim it rounds over. */
  readonly rimClearance: number;
  readonly safe: SafeCornerRadii;
}

/**
 * Height of the cut's bottom edge above its lowest point, at `x` across the
 * span from the cut's centre, or Infinity where the cut does not reach down at
 * all. Traces the same lines `buildCutoutProfile` draws: the bottom fillets and
 * a funnel's leaning sides, or a scoop's arc, then the top round-over out to
 * the rim. A short lip, or none, leaves that round-over below a divider's top.
 */
export function cutoutFloorRise(p: CutoutFloorProfile, x: number): number {
  const ax = Math.abs(x);
  const rim = p.drop + p.lipRoom;
  const shoulderR = x >= 0 ? p.safe.topRight : p.safe.topLeft;
  if (p.shape === 'scoop') {
    const hw = p.cutWidth / 2;
    if (ax > hw) return shoulderRise(roundOver(hw, rim, 0, shoulderR), ax);
    const topR = Math.max(p.safe.topLeft, p.safe.topRight);
    const chord = Math.min(p.drop, p.drop + (p.lipRoom - p.collarHeight) - topR);
    const sagitta = Math.min(hw, chord);
    if (sagitta <= 0) return Math.max(0, chord);
    const radius = (hw * hw + sagitta * sagitta) / (2 * sagitta);
    const centreY = chord - sagitta + radius;
    return Math.max(0, centreY - Math.sqrt(Math.max(0, radius * radius - ax * ax)));
  }
  const side = cutoutSide(p.shape, p.cutWidth, rim, p.rimClearance);
  const r = x >= 0 ? p.safe.bottomRight : p.safe.bottomLeft;
  const { bottomHalfWidth: bhw, lean } = side;
  const shoulder = roundOver(side.halfWidthAtRim, rim, lean, shoulderR);
  if (shoulder && ax > shoulder.side[0]) return shoulderRise(shoulder, ax);
  if (r > MIN_CUTOUT_CORNER_RADIUS) {
    // The fillet is tangent to the floor and to the side, so its centre
    // stands one radius off each.
    const k = Math.hypot(1, lean);
    const centreX = bhw + lean * r - r * k;
    if (ax <= centreX) return 0;
    if (ax <= centreX + r / k) {
      const dx = ax - centreX;
      return r - Math.sqrt(Math.max(0, r * r - dx * dx));
    }
  } else if (ax <= bhw) {
    return 0;
  }
  if (lean <= 0) return Infinity;
  return (ax - bhw) / lean;
}

/** The top round-over `buildCutoutProfile` draws, or null for a square shoulder. */
function roundOver(
  sideAtRim: number,
  rim: number,
  lean: number,
  radius: number
): ShoulderBlend | null {
  return radius > MIN_CUTOUT_CORNER_RADIUS ? shoulderBlend(sideAtRim, rim, lean, radius) : null;
}

/** Height of a round-over above the cut's floor, out to where it meets the rim. */
function shoulderRise(blend: ShoulderBlend | null, ax: number): number {
  if (!blend || ax > blend.rim[0]) return Infinity;
  const dx = ax - blend.centre[0];
  return blend.centre[1] + Math.sqrt(Math.max(0, blend.radius * blend.radius - dx * dx));
}

/** Zero out a radius too small to be worth a curve. */
function snap(radius: number): number {
  return radius > MIN_CUTOUT_CORNER_RADIUS ? radius : 0;
}
