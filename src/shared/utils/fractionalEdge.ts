/**
 * Fractional-edge alignment between a design and its linked drawer.
 *
 * A fractional-dimension bin's half foot has to sit on the side where its half
 * cell actually lands in the drawer, so a linked design whose `fractionalEdgeX/Y`
 * disagrees is oriented wrong (issue #2518). These pure helpers detect that
 * mismatch and compute the corrective patch.
 *
 * The correct edge is a function of WHERE THE BIN SITS, not of the drawer's own
 * fractional slot. Comparing against `Drawer.fractionalEdgeX/Y` alone warned on
 * every fractional bin in an integer-sized drawer — no fractional column exists
 * there, an unset drawer edge normalizes to `'end'`, and "Match drawer" then
 * flipped a perfectly correct foot to the wrong side (issue #3070).
 */

import type { FractionalEdge } from '@/core/types';
import { isFractional } from '@/core/constants';

/** The design-side fields needed to evaluate an edge mismatch. */
export interface FractionalEdgeDesign {
  readonly width: number;
  readonly depth: number;
  readonly fractionalEdgeX?: FractionalEdge;
  readonly fractionalEdgeY?: FractionalEdge;
  /** When true the user chose that axis's edge on purpose — suppress its warning. */
  readonly fractionalEdgeManualX?: boolean;
  readonly fractionalEdgeManualY?: boolean;
}

/** The drawer the bin sits in. Sizes are needed, not just the edge settings. */
export interface FractionalEdgeDrawer {
  readonly width: number;
  readonly depth: number;
  readonly fractionalEdgeX?: FractionalEdge;
  readonly fractionalEdgeY?: FractionalEdge;
}

/** A bin's grid position within the drawer. */
export interface FractionalEdgePlacement {
  readonly x: number;
  readonly y: number;
}

/**
 * Normalize a persisted drawer edge to the documented default. Anything that
 * isn't exactly `'start'` (unset, or a legacy/corrupt value) resolves to `'end'`.
 */
const drawerEdge = (edge: FractionalEdge | undefined): FractionalEdge =>
  edge === 'start' ? 'start' : 'end';

/**
 * Offset of the drawer's cell boundaries from the origin on one axis.
 *
 * A drawer 5.5 units wide with its fractional slot at the start has cells
 * `[0,0.5] [0.5,1.5] [1.5,2.5] …` — boundaries land on `n + 0.5`. Every other
 * configuration (fractional slot at the end, or an integer-sized drawer) has
 * boundaries on the integers.
 */
function cellBoundaryOffset(drawerSize: number, edge: FractionalEdge | undefined): number {
  if (!isFractional(drawerSize) || drawerEdge(edge) !== 'start') return 0;
  return drawerSize - Math.floor(drawerSize);
}

/**
 * The edge a fractional bin's half cell lands on for one axis.
 *
 * A bin whose leading edge sits on a cell boundary opens with full cells and
 * ends on the half one; a bin offset half a unit from the boundary opens with
 * the half cell. This is what the layout grid draws, so it is the answer to
 * "which edge does the Layout screen show".
 */
export function edgeForPosition(
  position: number,
  drawerSize: number,
  edge: FractionalEdge | undefined
): FractionalEdge {
  return isFractional(position - cellBoundaryOffset(drawerSize, edge)) ? 'start' : 'end';
}

/**
 * True when a fractional axis of the design points at a different edge than the
 * bin's placement implies. A per-axis manual override, an integer dimension, or
 * an unknown (undefined) design edge never counts as a mismatch — we only warn
 * on a concrete conflict, and only for axes the user hasn't taken control of.
 */
export function hasFractionalEdgeMismatch(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer,
  placement: FractionalEdgePlacement
): boolean {
  const xMismatch =
    !design.fractionalEdgeManualX &&
    isFractional(design.width) &&
    design.fractionalEdgeX !== undefined &&
    design.fractionalEdgeX !== edgeForPosition(placement.x, drawer.width, drawer.fractionalEdgeX);
  const yMismatch =
    !design.fractionalEdgeManualY &&
    isFractional(design.depth) &&
    design.fractionalEdgeY !== undefined &&
    design.fractionalEdgeY !== edgeForPosition(placement.y, drawer.depth, drawer.fractionalEdgeY);
  return xMismatch || yMismatch;
}

/**
 * The patch that realigns a design's fractional edges to its placement. Only
 * the fractional axes are touched, and each realigned axis has its manual flag
 * reset to `false` so the design tracks future drawer changes on that axis again.
 */
export function computeMatchedEdges(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer,
  placement: FractionalEdgePlacement
): {
  fractionalEdgeX?: FractionalEdge;
  fractionalEdgeY?: FractionalEdge;
  fractionalEdgeManualX?: boolean;
  fractionalEdgeManualY?: boolean;
} {
  return {
    ...(isFractional(design.width)
      ? {
          fractionalEdgeX: edgeForPosition(placement.x, drawer.width, drawer.fractionalEdgeX),
          fractionalEdgeManualX: false,
        }
      : {}),
    ...(isFractional(design.depth)
      ? {
          fractionalEdgeY: edgeForPosition(placement.y, drawer.depth, drawer.fractionalEdgeY),
          fractionalEdgeManualY: false,
        }
      : {}),
  };
}
