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

/** Slider track cap. Geometry usually clamps tighter; this keeps the track usable. */
export const ANGLE_UI_MAX_DEG = 60;
export const ANGLE_UI_STEP_DEG = 5;
/** One-click common angles offered in the inspector. */
export const ANGLE_PRESETS_DEG = [0, 15, 30, 45] as const;
export const SHIFT_UI_STEP_MM = 0.5;

export interface AngleShift {
  readonly angleDeg: number;
  readonly shiftMm: number;
}

export interface DividerOffsets {
  readonly offsetStart: number;
  readonly offsetEnd: number;
}

export interface DividerGeometry {
  /** Physical length of the divider segment, in mm. */
  readonly segmentLengthMm: number;
  /** Most-negative endpoint offset that keeps the divider inside its neighbours. */
  readonly offsetMin: number;
  /** Most-positive endpoint offset that keeps the divider inside its neighbours. */
  readonly offsetMax: number;
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
  params: BinInteriorParams,
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
  };
}

export function offsetsToAngleShift(offsets: DividerOffsets, segmentLengthMm: number): AngleShift {
  const shiftMm = (offsets.offsetStart + offsets.offsetEnd) / 2;
  const angleDeg =
    segmentLengthMm > 0
      ? (Math.atan2(offsets.offsetEnd - offsets.offsetStart, segmentLengthMm) * 180) / Math.PI
      : 0;
  return { angleDeg: round(angleDeg, 1), shiftMm: round(shiftMm, 2) };
}

export function angleShiftToOffsets(value: AngleShift, segmentLengthMm: number): DividerOffsets {
  const delta = segmentLengthMm * Math.tan((value.angleDeg * Math.PI) / 180);
  return {
    offsetStart: value.shiftMm - delta / 2,
    offsetEnd: value.shiftMm + delta / 2,
  };
}

function clampOffsets(offsets: DividerOffsets, geom: DividerGeometry): DividerOffsets {
  return {
    offsetStart: clamp(offsets.offsetStart, geom.offsetMin, geom.offsetMax),
    offsetEnd: clamp(offsets.offsetEnd, geom.offsetMin, geom.offsetMax),
  };
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
  const raw = angleShiftToOffsets(
    { angleDeg: cappedAngle, shiftMm: requested.shiftMm },
    geom.segmentLengthMm
  );
  const clamped = clampOffsets(raw, geom);
  const back = offsetsToAngleShift(clamped, geom.segmentLengthMm);
  return {
    offsetStart: round(clamped.offsetStart, 3),
    offsetEnd: round(clamped.offsetEnd, 3),
    angleDeg: back.angleDeg,
    shiftMm: back.shiftMm,
  };
}
