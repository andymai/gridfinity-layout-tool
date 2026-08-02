/**
 * Seated-connector accounting + placement for baseplates.
 *
 * The dovetail-key and snap-clip styles both make every join edge female and
 * ship a separate part seated at each seam junction (a hammered-in key, or a
 * top-inserted snap clip). Under `dovetailKey` a detached margin's body↔rail seam
 * is female on both sides too, so it seats the same key (#2866) — which is why this
 * is not split-only: a rail exists whether or not the plate was split, so an
 * UNSPLIT plate can need keys. This module is the single source of truth for WHERE
 * those parts go (and therefore HOW MANY), so the export count, the print guide,
 * and the 3D preview never disagree.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { hasMarginSeamKeys } from '@/shared/types/bin';
import type { BaseplateTiling } from '../types/tiling';

/**
 * One seated dovetail key location, in the same centered world frame the preview
 * uses for pieces (origin at the baseplate center, +X right, +Y back, mm).
 */
export interface SeamJunction {
  readonly xMm: number;
  readonly yMm: number;
  /**
   * Orientation of the key's long axis:
   * - 'x': vertical seam (between left/right pieces) — key spans in X (no rotation).
   * - 'y': horizontal seam (between front/back pieces) — key rotated 90° about Z.
   */
  readonly axis: 'x' | 'y';
}

/**
 * Interior cell-boundary offsets along one edge of `units` grid units, measured
 * from the edge's center (mm). Mirrors `decomposeCells` + `computeCellBoundariesMm`
 * in the worker's `cellDecomposition.ts`: N full 1u cells plus an optional
 * trailing 0.5u cell, with one boundary between each adjacent pair. The trailing
 * half-cell flips to the start when `fractionalEdge === 'start'`. Replicated here
 * (rather than imported) to avoid a cross-feature dependency on the generation
 * worker; parity is guarded by unit tests.
 */
export function interiorBoundaryOffsetsMm(
  units: number,
  gridUnitMm: number,
  fractionalEdge: 'start' | 'end' | 'none'
): number[] {
  const fullCells = Math.floor(units);
  const hasHalf = units - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array<number>(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  if (fractionalEdge === 'start') cells.reverse();

  const totalMm = units * gridUnitMm;
  const offsets: number[] = [];
  let pos = 0;
  for (let i = 0; i < cells.length - 1; i++) {
    pos += cells[i] * gridUnitMm;
    offsets.push(pos - totalMm / 2);
  }
  return offsets;
}

/** Styles that ship a separate part seated at every seam junction. */
function hasSeatedConnector(params: ResolvedBaseplateParams): boolean {
  return (
    params.connectorNubs === true &&
    (params.connectorStyle === 'dovetailKey' || params.connectorStyle === 'snapClip')
  );
}

/**
 * Seated connector locations for a split baseplate — every place a key or clip
 * has to be hammered in.
 *
 * Split seams: walk the pieces emitting a junction for every interior boundary on
 * each RIGHT (vertical seam) and BACK (horizontal seam) join edge, so every
 * internal seam junction is produced exactly once. Valid because the tiling is a
 * strict grid: a seam's two adjacent pieces share the same cross-axis size, so
 * their grooves align.
 *
 * Margin seams: the body↔rail seams of detached margins add their own junctions
 * under `dovetailKey` ({@link marginSeamJunctions}, #2866).
 *
 * Coordinates match `SplitBaseplateMeshes` piece centering exactly:
 *   center = gridOffset * gridUnitMm + pieceSize / 2 - total / 2
 *
 * Returns [] when neither a seated-connector style nor a keyed margin seam is
 * active.
 */
export function computeSeamJunctions(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams
): SeamJunction[] {
  // Per-axis pitch: equal on a square grid, so this reduces to the old single-`g`
  // arithmetic there. Each measurement has to use the pitch of the axis it runs
  // along, or a non-square plate's keys land where the grooves aren't.
  const gx = params.gridUnitMm;
  const gy = params.gridUnitMmY ?? gx;
  const totalWmm = tiling.totalWidthUnits * gx;
  const totalDmm = tiling.totalDepthUnits * gy;
  const junctions: SeamJunction[] = [];

  if (hasSeatedConnector(params)) {
    for (const piece of tiling.pieces) {
      const pieceWmm = piece.widthUnits * gx;
      const pieceDmm = piece.depthUnits * gy;
      const centerX = piece.gridOffsetX * gx + pieceWmm / 2 - totalWmm / 2;
      const centerY = piece.gridOffsetY * gy + pieceDmm / 2 - totalDmm / 2;

      // A shaped plate can gate a seam's connectors to a sub-span (#3163) —
      // a key only exists where the pieces actually cut grooves.
      const allowed = (side: 'right' | 'back', off: number): boolean => {
        const filter = piece.connectorFilter?.[side];
        return filter === undefined || filter.some((a) => Math.abs(a - off) < 0.05);
      };
      if (piece.edges.right === 'join') {
        const seamX = piece.gridOffsetX * gx + pieceWmm - totalWmm / 2;
        for (const off of interiorBoundaryOffsetsMm(piece.depthUnits, gy, piece.fractionalEdgeY)) {
          if (!allowed('right', off)) continue;
          junctions.push({ xMm: seamX, yMm: centerY + off, axis: 'x' });
        }
      }
      if (piece.edges.back === 'join') {
        const seamY = piece.gridOffsetY * gy + pieceDmm - totalDmm / 2;
        for (const off of interiorBoundaryOffsetsMm(piece.widthUnits, gx, piece.fractionalEdgeX)) {
          if (!allowed('back', off)) continue;
          junctions.push({ xMm: centerX + off, yMm: seamY, axis: 'y' });
        }
      }
    }
  }

  junctions.push(...marginSeamJunctions(tiling, params));
  return junctions;
}

/**
 * Seated key locations on the body↔rail seams of detached margins (#2866).
 *
 * A long rail is emitted per outer body piece and records the mating wall's grid
 * span in `seamConnector`, so the key positions are that span's interior cell
 * boundaries — the same anchors both sides cut their grooves on — re-centered from
 * the piece's grid center onto the rail's own center (`centerOffsetMm`).
 *
 * The cross-seam coordinate is the body's GRID edge (`±total/2`): detached sides
 * print padding-free, so the body wall sits exactly there and the rail begins
 * where it ends. Same frame as the join-edge walk above, and the same frame
 * `emitMargins` uses for `worldOffsetMm`.
 */
function marginSeamJunctions(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams
): SeamJunction[] {
  if (!hasMarginSeamKeys(params)) return [];

  const gx = params.gridUnitMm;
  const gy = params.gridUnitMmY ?? gx;
  const halfWmm = (tiling.totalWidthUnits * gx) / 2;
  const halfDmm = (tiling.totalDepthUnits * gy) / 2;
  const junctions: SeamJunction[] = [];

  for (const margin of tiling.margins ?? []) {
    const seam = margin.seamConnector;
    if (margin.role !== 'long' || !seam) continue;
    // A front/back rail runs along X, so its `cellUnits` are width cells (X
    // pitch) and its key spans Y; a left/right rail is the mirror image. Both
    // must use their own axis's pitch, matching `buildMarginSolid`.
    const horizontal = margin.side === 'front' || margin.side === 'back';
    const offsets = interiorBoundaryOffsetsMm(
      seam.cellUnits,
      horizontal ? gx : gy,
      seam.fractionalEdge
    );
    for (const off of offsets) {
      const along = off + seam.centerOffsetMm;
      if (horizontal) {
        const y = margin.side === 'front' ? -halfDmm : halfDmm;
        junctions.push({ xMm: margin.worldOffsetMm.x + along, yMm: y, axis: 'y' });
      } else {
        const x = margin.side === 'left' ? -halfWmm : halfWmm;
        junctions.push({ xMm: x, yMm: margin.worldOffsetMm.y + along, axis: 'x' });
      }
    }
  }
  return junctions;
}

/**
 * Number of seated connector parts a split baseplate needs — one per seam
 * junction, split seams and keyed margin seams alike. Derived from
 * {@link computeSeamJunctions} so the count and the placements can never diverge.
 */
export function countConnectorKeys(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams
): number {
  return computeSeamJunctions(tiling, params).length;
}
