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
  /** When true the user chose the edge on purpose — suppress the warning. */
  readonly fractionalEdgeManual?: boolean;
}

/** The drawer-side edge orientation to compare against. */
export interface FractionalEdgeDrawer {
  readonly fractionalEdgeX?: FractionalEdge;
  readonly fractionalEdgeY?: FractionalEdge;
}

/** Drawer defaults to the 'end' edge on both axes when unset. */
const drawerEdge = (edge: FractionalEdge | undefined): FractionalEdge => edge ?? 'end';

/**
 * True when a fractional axis of the design points at a different edge than the
 * drawer. A manual override, an integer dimension, or an unknown (undefined)
 * design edge never counts as a mismatch — we only warn on a concrete conflict.
 */
export function hasFractionalEdgeMismatch(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer
): boolean {
  if (design.fractionalEdgeManual) return false;
  const xMismatch =
    isFractional(design.width) &&
    design.fractionalEdgeX !== undefined &&
    design.fractionalEdgeX !== drawerEdge(drawer.fractionalEdgeX);
  const yMismatch =
    isFractional(design.depth) &&
    design.fractionalEdgeY !== undefined &&
    design.fractionalEdgeY !== drawerEdge(drawer.fractionalEdgeY);
  return xMismatch || yMismatch;
}

/**
 * The patch that realigns a design's fractional edges to the drawer. Only the
 * fractional axes are touched; `fractionalEdgeManual` is reset to `false` so the
 * design tracks future drawer changes again.
 */
export function computeMatchedEdges(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer
): {
  fractionalEdgeX?: FractionalEdge;
  fractionalEdgeY?: FractionalEdge;
  fractionalEdgeManual: boolean;
} {
  return {
    ...(isFractional(design.width) ? { fractionalEdgeX: drawerEdge(drawer.fractionalEdgeX) } : {}),
    ...(isFractional(design.depth) ? { fractionalEdgeY: drawerEdge(drawer.fractionalEdgeY) } : {}),
    fractionalEdgeManual: false,
  };
}
