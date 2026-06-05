import type { HandleWallSide } from '@/features/bin-designer/types';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';

/** A handle segment: horizontal offset from wall center and width in mm. */
export interface HandleSegment {
  /** Horizontal center offset from wall center (mm). Negative = toward left. */
  readonly offset: number;
  /** Segment width (mm). */
  readonly width: number;
}

interface HandleSegmentInput {
  /** Full wall interior span in mm. */
  readonly wallSpan: number;
  /** Handle width as percentage of wallSpan (1-100). */
  readonly handleWidthPercent: number;
  /** Cutout horizontal center relative to wall center (mm). 0 = centered. */
  readonly cutoutCenter: number;
  /** Cutout width in mm. 0 means no cutout. */
  readonly cutoutWidth: number;
  /** Clearance gap between handle edge and cutout edge (mm). */
  readonly clearance: number;
  /** Minimum segment width to keep (mm). Segments below this are discarded. */
  readonly minSegmentWidth: number;
}

/** Per-wall positioning for handle hole placement. */
export interface HandleWallDef {
  readonly side: HandleWallSide;
  readonly wallSpan: number;
  readonly x: number;
  readonly y: number;
  readonly rotateZ: number;
}

/** Default vertical center of handle hole as fraction of interior height (from floor). */
export const DEFAULT_VERTICAL_POSITION = 0.7;
/** Clearance gap between handle edge and cutout edge (mm). */
export const CUTOUT_CLEARANCE = 1.0;
/** Minimum handle segment width to generate (mm). */
export const MIN_SEGMENT_WIDTH = 10.0;
/** Epsilon for floating-point comparison of segment widths (mm). */
const EPSILON = 1e-6;

/**
 * Compute handle hole vertical center and clamped height.
 *
 * Shared between handleBuilder (hole geometry) and wallPatternBuilder
 * (border clipping) to prevent drift.
 *
 * @param verticalPosition - Vertical center as fraction 0-1 from floor (default 0.7)
 */
export function computeHandleHoleGeometry(
  interiorHeight: number,
  requestedHeight: number,
  verticalPosition: number = DEFAULT_VERTICAL_POSITION
): { centerZ: number; effectiveHeight: number } {
  const centerZ = interiorHeight * verticalPosition;
  const margin = interiorHeight * 0.1;
  const maxHalfHeight = Math.max(0, Math.min(centerZ, interiorHeight - centerZ) - margin);
  const effectiveHeight = Math.min(requestedHeight, maxHalfHeight * 2);
  return { centerZ, effectiveHeight };
}

/** Build the four wall definitions from inner dimensions. */
export function buildHandleWallDefs(innerW: number, innerD: number): readonly HandleWallDef[] {
  return [
    { side: 'front', wallSpan: innerW, x: 0, y: -innerD / 2, rotateZ: 0 },
    { side: 'back', wallSpan: innerW, x: 0, y: innerD / 2, rotateZ: 0 },
    { side: 'left', wallSpan: innerD, x: -innerW / 2, y: 0, rotateZ: 90 },
    { side: 'right', wallSpan: innerD, x: innerW / 2, y: 0, rotateZ: 90 },
  ];
}

/** Minimal wall cutout info needed for segment computation. */
interface WallCutoutInfo {
  readonly enabled: boolean;
  readonly width: number;
  readonly widthMm: number | null;
  readonly alignment: 'left' | 'center' | 'right';
  readonly offset: number;
}

/**
 * Compute handle segments for a single wall, splitting around a cutout if present.
 *
 * Returns null if the wall has zero handle width (caller should skip).
 */
export function computeWallHandleSegments(
  wallSpan: number,
  handleWidthPercent: number,
  wallThickness: number,
  cutout: WallCutoutInfo | undefined
): HandleSegment[] | null {
  if (cutout?.enabled) {
    const cutWidth =
      cutout.widthMm !== null
        ? Math.min(cutout.widthMm, wallSpan)
        : wallSpan * (cutout.width / 100);
    const cutCenter = computeCutoutCenter(
      wallSpan,
      cutWidth,
      wallThickness,
      cutout.alignment,
      cutout.offset
    );
    return computeHandleSegments({
      wallSpan,
      handleWidthPercent,
      cutoutCenter: cutCenter,
      cutoutWidth: cutWidth,
      clearance: CUTOUT_CLEARANCE,
      minSegmentWidth: MIN_SEGMENT_WIDTH,
    });
  }

  const holeWidth = wallSpan * (handleWidthPercent / 100);
  if (holeWidth <= 0) return null;
  return [{ offset: 0, width: holeWidth }];
}

/**
 * Compute handle segments that avoid a wall cutout's horizontal span.
 *
 * Given a handle centered on the wall and a cutout with known center/width,
 * returns 0, 1, or 2 segments representing the remaining handle regions.
 *
 * Pure function — shared between generation builder and ghost preview.
 */
export function computeHandleSegments(input: HandleSegmentInput): HandleSegment[] {
  const { wallSpan, handleWidthPercent, cutoutCenter, cutoutWidth, clearance, minSegmentWidth } =
    input;

  const handleWidth = wallSpan * (handleWidthPercent / 100);
  if (handleWidth <= 0) return [];

  const handleLeft = -handleWidth / 2;
  const handleRight = handleWidth / 2;

  // No cutout or zero-width cutout -> return full handle
  if (cutoutWidth <= 0) {
    return [{ offset: 0, width: handleWidth }];
  }

  const cutLeft = cutoutCenter - cutoutWidth / 2 - clearance;
  const cutRight = cutoutCenter + cutoutWidth / 2 + clearance;

  // No overlap -> return full handle
  if (cutRight <= handleLeft || cutLeft >= handleRight) {
    return [{ offset: 0, width: handleWidth }];
  }

  const segments: HandleSegment[] = [];

  // Left segment: from handleLeft to cutLeft
  const leftWidth = cutLeft - handleLeft;
  if (leftWidth >= minSegmentWidth - EPSILON) {
    const leftCenter = handleLeft + leftWidth / 2;
    segments.push({ offset: leftCenter, width: leftWidth });
  }

  // Right segment: from cutRight to handleRight
  const rightWidth = handleRight - cutRight;
  if (rightWidth >= minSegmentWidth - EPSILON) {
    const rightCenter = cutRight + rightWidth / 2;
    segments.push({ offset: rightCenter, width: rightWidth });
  }

  return segments;
}
