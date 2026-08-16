/**
 * Where a wall cutout sits along its wall, and how its two corners are rounded.
 *
 * Pure and kernel-free, because four layers have to agree on the answers and
 * only one of them can import brepjs: the geometry builder, the wall-pattern
 * clip that clears hex prisms out of the cut's border, the ghost outline the
 * preview draws during regeneration, and `lipGapPlan`, which has to know how
 * wide the opening is AT THE LIP before it can say what rail a lid keeps.
 */

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
 */
export function resolveCutoutCornerRadii(
  wall: CutoutCornerSource | undefined,
  side: CutoutCornerSource | undefined,
  cutWidth: number
): CutoutCornerRadii {
  const clamp = (v: number): number => Math.max(0, Math.min(MAX_CUTOUT_CORNER_RADIUS, v));
  const top = side?.cornerRadiusTop ?? wall?.cornerRadiusTop ?? null;
  const bottom = side?.cornerRadiusBottom ?? wall?.cornerRadiusBottom ?? null;
  return {
    top: top === null ? 0 : clamp(top),
    bottom: bottom === null ? autoCornerRadius(cutWidth) : clamp(bottom),
  };
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
 * `lipRoom` is the material standing above the wall body — the stacking lip's
 * height, or zero without one. The cut's side runs from there down to its
 * floor, and that is the room the two blends share.
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

/** Zero out a radius too small to be worth a curve. */
function snap(radius: number): number {
  return radius > MIN_CUTOUT_CORNER_RADIUS ? radius : 0;
}
