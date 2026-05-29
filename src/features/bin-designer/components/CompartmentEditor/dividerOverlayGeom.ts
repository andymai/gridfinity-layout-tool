/**
 * Pure geometry for the 2D divider overlay: locating a divider segment in the
 * compartment grid and projecting it (with its endpoint offsets) into top-down
 * percentage coordinates for the canvas. Kept separate from the React component
 * so it can be unit-tested and so the component file stays fast-refresh clean.
 */

import {
  getCompartmentBounds,
  type EligibleDivider,
} from '@/features/bin-designer/utils/compartments';
import type { CompartmentConfig } from '@/features/bin-designer/types';

export interface SegmentSpan {
  readonly axis: 'vertical' | 'horizontal';
  /** Column or row boundary in [1, gridDim-1] (the perpendicular coord of the line). */
  readonly axisCoord: number;
  /** Start of the segment along the parallel axis, in [0, gridDim]. */
  readonly spanStart: number;
  /** End (exclusive) of the segment, in [0, gridDim]. */
  readonly spanEnd: number;
  /** Length of the grid dimension parallel to the segment. */
  readonly parallelDim: number;
  /** Length of the grid dimension perpendicular to the segment. */
  readonly perpDim: number;
}

export interface LineGeom {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly cx: number;
  readonly cy: number;
}

/**
 * Find the contiguous run of cell boundaries where the (compartmentA, compartmentB)
 * pair appears. With the rectangular-compartment invariant the run is unique
 * and contiguous, so a single scan along the perpendicular axis is enough.
 */
export function computeSegmentSpan(
  config: CompartmentConfig,
  divider: EligibleDivider
): SegmentSpan | null {
  const aBounds = getCompartmentBounds(config, divider.compartmentA);
  const bBounds = getCompartmentBounds(config, divider.compartmentB);
  if (!aBounds || !bBounds) return null;

  if (divider.axis === 'vertical') {
    const axisCoord = Math.min(aBounds.maxCol, bBounds.maxCol) + 1;
    const spanStart = Math.max(aBounds.minRow, bBounds.minRow);
    const spanEnd = Math.min(aBounds.maxRow, bBounds.maxRow) + 1;
    if (spanEnd <= spanStart) return null;
    return {
      axis: 'vertical',
      axisCoord,
      spanStart,
      spanEnd,
      parallelDim: config.rows,
      perpDim: config.cols,
    };
  }

  const axisCoord = Math.min(aBounds.maxRow, bBounds.maxRow) + 1;
  const spanStart = Math.max(aBounds.minCol, bBounds.minCol);
  const spanEnd = Math.min(aBounds.maxCol, bBounds.maxCol) + 1;
  if (spanEnd <= spanStart) return null;
  return {
    axis: 'horizontal',
    axisCoord,
    spanStart,
    spanEnd,
    parallelDim: config.cols,
    perpDim: config.rows,
  };
}

/**
 * Endpoint + midpoint of a divider segment in top-down percentage coordinates,
 * displaced by the perpendicular endpoint offsets (mm → fraction of interior).
 */
export function overlayLineGeom(
  span: SegmentSpan,
  offsetStart: number,
  offsetEnd: number,
  interiorW: number,
  interiorD: number
): LineGeom {
  if (span.axis === 'vertical') {
    const xBase = (span.axisCoord / span.perpDim) * 100;
    const dxStart = interiorW > 0 ? (offsetStart / interiorW) * 100 : 0;
    const dxEnd = interiorW > 0 ? (offsetEnd / interiorW) * 100 : 0;
    const yBottom = (1 - span.spanStart / span.parallelDim) * 100;
    const yTop = (1 - span.spanEnd / span.parallelDim) * 100;
    const x1 = xBase + dxStart;
    const x2 = xBase + dxEnd;
    return { x1, y1: yBottom, x2, y2: yTop, cx: (x1 + x2) / 2, cy: (yBottom + yTop) / 2 };
  }
  const yBase = (1 - span.axisCoord / span.perpDim) * 100;
  // +Y offset moves the wall toward the back (visually up = smaller top-down y).
  const dyStart = interiorD > 0 ? -(offsetStart / interiorD) * 100 : 0;
  const dyEnd = interiorD > 0 ? -(offsetEnd / interiorD) * 100 : 0;
  const xStart = (span.spanStart / span.parallelDim) * 100;
  const xEnd = (span.spanEnd / span.parallelDim) * 100;
  const y1 = yBase + dyStart;
  const y2 = yBase + dyEnd;
  return { x1: xStart, y1, x2: xEnd, y2, cx: (xStart + xEnd) / 2, cy: (y1 + y2) / 2 };
}
