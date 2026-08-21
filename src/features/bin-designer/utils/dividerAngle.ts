/**
 * Presentation-layer reparametrization of divider tilt.
 *
 * The stored model (`DividerOverride`) is two perpendicular endpoint offsets in
 * mm. Users reason about a diagonal divider as an *angle*, so the panel speaks
 * {angle°, shift mm} and converts to/from the stored offsets here:
 *
 *   angle = atan2(offsetEnd − offsetStart, segmentLengthMm)   // tilt about center
 *   shift = (offsetStart + offsetEnd) / 2                      // parallel slide
 *
 * `lean` is stored directly as `rakeDeg` and needs no reparametrization, but it
 * shares the envelope: a leaning divider is one plane through the top line at
 * {angle, shift} and a foot line at those offsets plus `height · tan(lean)`.
 * Both lines have to sit inside [offsetMin, offsetMax], which is the whole of
 * the lean clamp.
 *
 * `segmentLengthMm` is the divider segment's physical length, derived the same
 * way the worker derives cavity geometry (interior dims ÷ grid). Without it the
 * angle would be unitless and physically meaningless.
 */

import { GRIDFINITY, DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { clamp } from '@/shared/utils/math';
import { getCompartmentBounds, type EligibleDivider } from './compartments';

/** The subset of bin parameters needed to derive interior dimensions in mm. */
export interface BinInteriorParams {
  readonly width: number;
  readonly depth: number;
  readonly gridUnitMm: number;
  /** Y-axis pitch for non-square grids; defaults to `gridUnitMm` (square). */
  readonly gridUnitMmY?: number;
  readonly wallThickness: number;
}

/** Interior dims plus the divider height a lean pivots about. Resolved by the
 *  caller through `labelTabInteriorDims` + `resolveCompartmentDividerHeight`,
 *  so this module never restates that chain. */
export interface DividerEnvelopeParams extends BinInteriorParams {
  readonly dividerHeightMm: number;
}

/** Slider track cap. Geometry usually clamps tighter; this keeps the track usable. */
export const ANGLE_UI_MAX_DEG = 60;
export const ANGLE_UI_STEP_DEG = 5;
/** One-click common angles offered in the inspector. */
export const ANGLE_PRESETS_DEG = [0, 15, 30, 45] as const;
export const SHIFT_UI_STEP_MM = 0.5;

/** Lean track cap. The bin's own envelope is usually tighter and always wins. */
export const LEAN_UI_MAX_DEG = 60;
export const LEAN_UI_STEP_DEG = 1;
export const LEAN_PRESETS_DEG = [0, 15, 30, 45] as const;

export interface AngleShift {
  readonly angleDeg: number;
  readonly shiftMm: number;
  /** Lean off vertical, degrees. Foot leans toward +offset. */
  readonly leanDeg: number;
}

export interface DividerOffsets {
  readonly offsetStart: number;
  readonly offsetEnd: number;
  readonly rakeDeg: number;
}

export interface DividerGeometry {
  /** Physical length of the divider segment, in mm. */
  readonly segmentLengthMm: number;
  /** Most-negative endpoint offset that keeps the divider inside its neighbours. */
  readonly offsetMin: number;
  /** Most-positive endpoint offset that keeps the divider inside its neighbours. */
  readonly offsetMax: number;
  /** Floor-to-top height of the divider wall, in mm. What a lean pivots about
   *  and what converts a lean angle into foot travel. */
  readonly dividerHeightMm: number;
  /** Centre-to-centre spacing of this divider and its neighbour across the
   *  boundary, in mm. Sets the clear opening a lean leaves. */
  readonly pitchMm: number;
}

/**
 * Interior cavity dimensions in mm. Mirrors boxBuilder: outer = units·gridUnitMm
 * − TOLERANCE, inner = outer − 2·wall. The depth axis uses `gridUnitMmY` when
 * set (non-square grid); otherwise it equals the X pitch, so square bins are
 * unchanged.
 */
export function getInteriorDims(params: BinInteriorParams): { innerW: number; innerD: number } {
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const innerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
  const innerD = params.depth * gridUnitMmY - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
  return { innerW, innerD };
}

const round = (n: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/**
 * Compute the segment length and the valid endpoint-offset envelope for a
 * divider. Returns null when the bin is too small (non-positive interior) or
 * the compartments don't actually share a boundary.
 */
export function getDividerGeometry(
  params: DividerEnvelopeParams,
  config: CompartmentConfig,
  divider: EligibleDivider
): DividerGeometry | null {
  const a = getCompartmentBounds(config, divider.compartmentA);
  const b = getCompartmentBounds(config, divider.compartmentB);
  if (!a || !b) return null;

  const { innerW, innerD } = getInteriorDims(params);
  if (innerW <= 0 || innerD <= 0) return null;
  const cellW = innerW / config.cols;
  const cellD = innerD / config.rows;
  const clearance = DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE;

  if (divider.axis === 'vertical') {
    // Boundary runs between columns; segment runs along Y (rows). Positive
    // offset shifts the wall toward +X, eating into the right-hand compartment.
    const spanStart = Math.max(a.minRow, b.minRow);
    const spanEnd = Math.min(a.maxRow, b.maxRow) + 1;
    if (spanEnd <= spanStart) return null;
    const segmentLengthMm = (spanEnd - spanStart) * cellD;

    const boundaryCol = Math.min(a.maxCol, b.maxCol) + 1;
    const left = a.maxCol + 1 === boundaryCol ? a : b;
    const right = left === a ? b : a;
    const leftWidth = (left.maxCol - left.minCol + 1) * cellW;
    const rightWidth = (right.maxCol - right.minCol + 1) * cellW;
    return {
      segmentLengthMm,
      offsetMin: -Math.max(0, leftWidth - clearance),
      offsetMax: Math.max(0, rightWidth - clearance),
      dividerHeightMm: params.dividerHeightMm,
      pitchMm: Math.min(leftWidth, rightWidth),
    };
  }

  // Horizontal: boundary between rows; segment runs along X (cols). Positive
  // offset shifts the wall toward +Y, eating into the upper compartment.
  const spanStart = Math.max(a.minCol, b.minCol);
  const spanEnd = Math.min(a.maxCol, b.maxCol) + 1;
  if (spanEnd <= spanStart) return null;
  const segmentLengthMm = (spanEnd - spanStart) * cellW;

  const boundaryRow = Math.min(a.maxRow, b.maxRow) + 1;
  const lower = a.maxRow + 1 === boundaryRow ? a : b;
  const upper = lower === a ? b : a;
  const lowerHeight = (lower.maxRow - lower.minRow + 1) * cellD;
  const upperHeight = (upper.maxRow - upper.minRow + 1) * cellD;
  return {
    segmentLengthMm,
    offsetMin: -Math.max(0, lowerHeight - clearance),
    offsetMax: Math.max(0, upperHeight - clearance),
    dividerHeightMm: params.dividerHeightMm,
    pitchMm: Math.min(lowerHeight, upperHeight),
  };
}

/** Foot travel (mm) a lean produces on a divider of this height. */
export function leanToFootTravel(leanDeg: number, dividerHeightMm: number): number {
  return dividerHeightMm * Math.tan((leanDeg * Math.PI) / 180);
}

/**
 * Steepest lean this divider can take: the one whose foot line still lands
 * inside the same envelope the top line lives in.
 *
 * The top line's own offsets eat into that envelope, so a divider already
 * shifted toward its neighbour leans less far. Reported per direction because
 * the envelope is not symmetric.
 */
export function getLeanLimits(
  geom: DividerGeometry,
  offsets: Pick<DividerOffsets, 'offsetStart' | 'offsetEnd'>
): { readonly minDeg: number; readonly maxDeg: number } {
  const h = geom.dividerHeightMm;
  if (h <= 0) return { minDeg: 0, maxDeg: 0 };
  const headroom = geom.offsetMax - Math.max(offsets.offsetStart, offsets.offsetEnd);
  const footroom = Math.min(offsets.offsetStart, offsets.offsetEnd) - geom.offsetMin;
  const toDeg = (travel: number): number =>
    Math.min(LEAN_UI_MAX_DEG, (Math.atan2(Math.max(0, travel), h) * 180) / Math.PI);
  return { minDeg: -toDeg(footroom), maxDeg: toDeg(headroom) };
}

export function offsetsToAngleShift(offsets: DividerOffsets, segmentLengthMm: number): AngleShift {
  const shiftMm = (offsets.offsetStart + offsets.offsetEnd) / 2;
  const angleDeg =
    segmentLengthMm > 0
      ? (Math.atan2(offsets.offsetEnd - offsets.offsetStart, segmentLengthMm) * 180) / Math.PI
      : 0;
  return { angleDeg: round(angleDeg, 1), shiftMm: round(shiftMm, 2), leanDeg: offsets.rakeDeg };
}

export function angleShiftToOffsets(value: AngleShift, segmentLengthMm: number): DividerOffsets {
  const delta = segmentLengthMm * Math.tan((value.angleDeg * Math.PI) / 180);
  return {
    offsetStart: value.shiftMm - delta / 2,
    offsetEnd: value.shiftMm + delta / 2,
    rakeDeg: value.leanDeg,
  };
}

function clampOffsets(offsets: DividerOffsets, geom: DividerGeometry): DividerOffsets {
  const clamped = {
    offsetStart: clamp(offsets.offsetStart, geom.offsetMin, geom.offsetMax),
    offsetEnd: clamp(offsets.offsetEnd, geom.offsetMin, geom.offsetMax),
  };
  const limits = getLeanLimits(geom, clamped);
  return { ...clamped, rakeDeg: clamp(offsets.rakeDeg, limits.minDeg, limits.maxDeg) };
}

/**
 * Convert a requested {angle, shift} to stored offsets, clamped to the bin's
 * geometric envelope, and report back the {angle, shift} the clamped offsets
 * actually represent — so the UI can reflect "clamped to the max it allows".
 */
export function applyAngleShift(
  requested: AngleShift,
  geom: DividerGeometry
): DividerOffsets & AngleShift {
  const cappedAngle = Math.max(-ANGLE_UI_MAX_DEG, Math.min(ANGLE_UI_MAX_DEG, requested.angleDeg));
  const cappedLean = Math.max(-LEAN_UI_MAX_DEG, Math.min(LEAN_UI_MAX_DEG, requested.leanDeg));
  const raw = angleShiftToOffsets(
    { angleDeg: cappedAngle, shiftMm: requested.shiftMm, leanDeg: cappedLean },
    geom.segmentLengthMm
  );
  const clamped = clampOffsets(raw, geom);
  const back = offsetsToAngleShift(clamped, geom.segmentLengthMm);
  return {
    offsetStart: round(clamped.offsetStart, 3),
    offsetEnd: round(clamped.offsetEnd, 3),
    rakeDeg: round(clamped.rakeDeg, 2),
    angleDeg: back.angleDeg,
    shiftMm: back.shiftMm,
    leanDeg: round(clamped.rakeDeg, 2),
  };
}
