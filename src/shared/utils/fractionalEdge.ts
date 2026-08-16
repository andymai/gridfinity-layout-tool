/**
 * Fractional-edge alignment between a design and the bins it is placed in.
 *
 * A fractional-dimension bin's half foot has to sit on the side where its half
 * cell actually lands in the drawer, so a linked design whose `fractionalEdgeX/Y`
 * disagrees is oriented wrong. These pure helpers detect that
 * mismatch and compute the corrective patch.
 *
 * The correct edge is a function of WHERE THE BIN SITS, not of the drawer's own
 * fractional slot. Comparing against `Drawer.fractionalEdgeX/Y` alone warned on
 * every fractional bin in an integer-sized drawer — no fractional column exists
 * there, an unset drawer edge normalizes to `'end'`, and "Match layout" then
 * flipped a perfectly correct foot to the wrong side.
 *
 * Everything is evaluated PER AXIS and ACROSS every placement of the design,
 * because one design can sit in several bins at once. An axis only warns when
 * all of its placements want the same edge: when they disagree, no single value
 * can satisfy them and the conflict is inherent to sharing one design, so
 * offering a one-click fix would just shuffle which bin is wrong.
 */

import type { FractionalEdge } from '@/core/types';
import type { FootLattice } from '@/shared/types/bin';
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
  /**
   * Half-socket base, if known. Such a bin is built from uniform 0.5-unit
   * sockets on every axis, so it has no single odd half foot and the edge has
   * no geometric effect at all (`forEachCell`'s `cellsW.reverse()` is a no-op
   * on a uniform array). Warning about it would be noise.
   */
  readonly halfSockets?: boolean;
  /** Foot lattice per axis. Missing = `'grid'`, the documented default. */
  readonly footLatticeX?: FootLattice;
  readonly footLatticeY?: FootLattice;
  /**
   * True when the design carries a partial cell mask. Such a bin is pinned to
   * the standard grid by the generator, so its lattice can never mismatch.
   */
  readonly hasCellMask?: boolean;
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

/** Per-axis patch produced by {@link computeMatchedFootLattice}. */
export interface FootLatticePatch {
  footLatticeX?: FootLattice;
  footLatticeY?: FootLattice;
}

/** Per-axis patch produced by {@link computeMatchedEdges}. */
export interface FractionalEdgePatch {
  fractionalEdgeX?: FractionalEdge;
  fractionalEdgeY?: FractionalEdge;
  fractionalEdgeManualX?: boolean;
  fractionalEdgeManualY?: boolean;
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
 * The edge every placement agrees on for one axis, or null when there is no
 * agreement to act on — no placements, or two that want opposite sides.
 */
function consensusEdge(
  positions: readonly number[],
  drawerSize: number,
  edge: FractionalEdge | undefined
): FractionalEdge | null {
  if (positions.length === 0) return null;
  const first = edgeForPosition(positions[0], drawerSize, edge);
  return positions.every((p) => edgeForPosition(p, drawerSize, edge) === first) ? first : null;
}

/**
 * True when a fractional axis of the design points at a different edge than
 * every one of its placements implies.
 *
 * A per-axis manual override, an integer dimension, an unknown (undefined)
 * design edge, a half-socket base, or placements that disagree on that axis all
 * mean there is nothing to warn about — we only flag a concrete conflict the
 * one-click fix can actually resolve. An unknown edge is deliberately not a
 * mismatch (a legacy registry entry says nothing about how it was built) even
 * though the patch below would happily fill it in.
 */
export function hasFractionalEdgeMismatch(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer,
  placements: readonly FractionalEdgePlacement[]
): boolean {
  const patch = computeMatchedEdges(design, drawer, placements);
  const wrong = (
    manual: boolean | undefined,
    known: FractionalEdge | undefined,
    wanted: FractionalEdge | undefined
  ): boolean => !manual && known !== undefined && wanted !== undefined && known !== wanted;
  return (
    wrong(design.fractionalEdgeManualX, design.fractionalEdgeX, patch.fractionalEdgeX) ||
    wrong(design.fractionalEdgeManualY, design.fractionalEdgeY, patch.fractionalEdgeY)
  );
}

/**
 * The patch that realigns a design's fractional edges to its placements. Only
 * fractional axes with an agreed edge are touched, and each realigned axis has
 * its manual flag reset to `false` so the design tracks future moves again.
 *
 * A manual override does NOT block the patch, unlike the warning above: asking
 * to match is itself the choice to hand that axis back.
 */
export function computeMatchedEdges(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer,
  placements: readonly FractionalEdgePlacement[]
): FractionalEdgePatch {
  if (design.halfSockets) return {};

  const axis = (
    size: number,
    positions: readonly number[],
    drawerSize: number,
    drawerAxisEdge: FractionalEdge | undefined
  ): FractionalEdge | null =>
    isFractional(size) ? consensusEdge(positions, drawerSize, drawerAxisEdge) : null;

  const x = axis(
    design.width,
    placements.map((p) => p.x),
    drawer.width,
    drawer.fractionalEdgeX
  );
  const y = axis(
    design.depth,
    placements.map((p) => p.y),
    drawer.depth,
    drawer.fractionalEdgeY
  );

  return {
    ...(x !== null ? { fractionalEdgeX: x, fractionalEdgeManualX: false } : {}),
    ...(y !== null ? { fractionalEdgeY: y, fractionalEdgeManualY: false } : {}),
  };
}

/**
 * Which foot lattice one axis needs, given where the bin's leading edge sits.
 *
 * The same offset-from-boundary question {@link edgeForPosition} asks, read for
 * a different purpose: a bin opening on a cell boundary wants full feet, and
 * one offset half a unit wants the half-unit rim. A foot has to land
 * inside a single pocket, so getting this wrong leaves the bin perched on the
 * ridges between them rather than seated.
 *
 * Unlike the fractional edge this applies to every axis, not just fractional
 * ones — a 3x3 bin sitting half a unit off the grid needs it as much as a 2.5u
 * one does.
 */
export function latticeForPosition(
  position: number,
  drawerSize: number,
  edge: FractionalEdge | undefined
): FootLattice {
  return isFractional(position - cellBoundaryOffset(drawerSize, edge)) ? 'half' : 'grid';
}

/**
 * The lattice every placement agrees on for one axis, or null when there is
 * nothing to act on — no placements, or two that want opposite lattices.
 */
function consensusLattice(
  positions: readonly number[],
  drawerSize: number,
  edge: FractionalEdge | undefined
): FootLattice | null {
  if (positions.length === 0) return null;
  const first = latticeForPosition(positions[0], drawerSize, edge);
  return positions.every((p) => latticeForPosition(p, drawerSize, edge) === first) ? first : null;
}

/**
 * The patch that realigns a design's foot lattice to its placements.
 *
 * Exactly complementary to {@link computeMatchedEdges}, which handles only
 * FRACTIONAL axes: a fractional axis already carries a half cell, and putting it
 * on the leading edge is itself the seating-correct layout for a half-offset
 * placement (a 2.5u axis becomes `[0.5, 1, 1]`). An integer axis has no half
 * cell to reposition, which is the gap this fills — so each axis is answered by
 * one mechanism or the other, never both.
 *
 * Empty for a half-socket base (uniform 0.5u feet already seat at either
 * offset) and for a custom-shape one (the mask is authored against the standard
 * grid, so the generator forces `grid` whatever this says).
 */
export function computeMatchedFootLattice(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer,
  placements: readonly FractionalEdgePlacement[]
): FootLatticePatch {
  if (design.halfSockets || design.hasCellMask) return {};

  const axis = (
    size: number,
    positions: readonly number[],
    drawerSize: number,
    drawerAxisEdge: FractionalEdge | undefined
  ): FootLattice | null =>
    isFractional(size) ? null : consensusLattice(positions, drawerSize, drawerAxisEdge);

  const x = axis(
    design.width,
    placements.map((p) => p.x),
    drawer.width,
    drawer.fractionalEdgeX
  );
  const y = axis(
    design.depth,
    placements.map((p) => p.y),
    drawer.depth,
    drawer.fractionalEdgeY
  );

  return {
    ...(x !== null ? { footLatticeX: x } : {}),
    ...(y !== null ? { footLatticeY: y } : {}),
  };
}

/**
 * True when the design's foot lattice disagrees with where every placement puts
 * it — the case where the bin will not drop into its pockets.
 *
 * An unset lattice counts as `grid`, its documented default, so a design that
 * predates the setting still warns when it is placed half a unit off. There is
 * no manual override: unlike the fractional edge, a mismatch here is not a
 * matter of preference, it is a part that does not fit.
 */
export function hasFootLatticeMismatch(
  design: FractionalEdgeDesign,
  drawer: FractionalEdgeDrawer,
  placements: readonly FractionalEdgePlacement[]
): boolean {
  const patch = computeMatchedFootLattice(design, drawer, placements);
  const wrong = (known: FootLattice | undefined, wanted: FootLattice | undefined): boolean =>
    wanted !== undefined && (known ?? 'grid') !== wanted;
  return (
    wrong(design.footLatticeX, patch.footLatticeX) || wrong(design.footLatticeY, patch.footLatticeY)
  );
}
