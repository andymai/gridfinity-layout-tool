/**
 * Fractional-edge alignment between a design and its linked drawer.
 *
 * A drawer holds a single half-unit column/row on one edge per axis
 * (`Drawer.fractionalEdgeX/Y`). A fractional-dimension bin's half foot must sit
 * on that same edge, so a linked design whose `fractionalEdgeX/Y` disagrees with
 * the drawer is oriented wrong (issue #2518). These pure helpers detect that
 * mismatch and compute the corrective patch.
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

/** The drawer-side edge orientation to compare against. */
export interface FractionalEdgeDrawer {
  readonly fractionalEdgeX?: FractionalEdge;
  readonly fractionalEdgeY?: FractionalEdge;
}

/**
 * Normalize a persisted drawer edge to the documented default. Anything that
 * isn't exactly `'start'` (unset, or a legacy/corrupt value) resolves to
 * `'end'`, so comparisons never spuriously mismatch and a "Match drawer" patch
 * can't write an invalid edge back into a design.
 */
const drawerEdge = (edge: FractionalEdge | undefined): FractionalEdge =>
  edge === 'start' ? 'start' : 'end';

/**
 * True when a fractional axis of the design points at a different edge than the
 * drawer. A per-axis manual override, an integer dimension, or an unknown
 * (undefined) design edge never counts as a mismatch — we only warn on a
 * concrete conflict, and only for axes the user hasn't taken control of.
 */
export function hasFractionalEdgeMismatch(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer
): boolean {
  const xMismatch =
    !design.fractionalEdgeManualX &&
    isFractional(design.width) &&
    design.fractionalEdgeX !== undefined &&
    design.fractionalEdgeX !== drawerEdge(drawer.fractionalEdgeX);
  const yMismatch =
    !design.fractionalEdgeManualY &&
    isFractional(design.depth) &&
    design.fractionalEdgeY !== undefined &&
    design.fractionalEdgeY !== drawerEdge(drawer.fractionalEdgeY);
  return xMismatch || yMismatch;
}

/**
 * The patch that realigns a design's fractional edges to the drawer. Only the
 * fractional axes are touched, and each realigned axis has its manual flag reset
 * to `false` so the design tracks future drawer changes on that axis again.
 */
export function computeMatchedEdges(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer
): {
  fractionalEdgeX?: FractionalEdge;
  fractionalEdgeY?: FractionalEdge;
  fractionalEdgeManualX?: boolean;
  fractionalEdgeManualY?: boolean;
} {
  return {
    ...(isFractional(design.width)
      ? { fractionalEdgeX: drawerEdge(drawer.fractionalEdgeX), fractionalEdgeManualX: false }
      : {}),
    ...(isFractional(design.depth)
      ? { fractionalEdgeY: drawerEdge(drawer.fractionalEdgeY), fractionalEdgeManualY: false }
      : {}),
  };
}
