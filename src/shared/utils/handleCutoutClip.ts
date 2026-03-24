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

/** Clearance gap between handle edge and cutout edge (mm). */
export const CUTOUT_CLEARANCE = 1.0;
/** Minimum handle segment width to generate (mm). */
export const MIN_SEGMENT_WIDTH = 10.0;
/** Epsilon for floating-point comparison of segment widths (mm). */
const EPSILON = 1e-6;

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
