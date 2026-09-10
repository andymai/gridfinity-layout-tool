/** Margin strips around a split baseplate's tiled body. */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
// The fit checker subtracts the tongue protrusion from the bed budget on male
// join edges — otherwise pieces that compute to exactly the bed width on paper
// exceed it as STLs.
import type { MarginCorner, MarginPiece } from '../types/tiling';
import { isFractional } from './splitReorder';
import { colToLetter, detachedSides } from './splitTiling';

interface MarginLayout {
  readonly colSizes: readonly number[];
  readonly rowSizes: readonly number[];
  readonly colOffsets: readonly number[];
  readonly rowOffsets: readonly number[];
}

/**
 * Decompose the drawer-fit padding into detached printable rail segments — one
 * per outer body piece per detached side.
 *
 * Splitting per body piece means each segment is no longer than its piece (so it
 * fits the bed, since the planner already reserved padding budget when sizing
 * pieces), and lets the preview explode each segment in lockstep with its piece
 * instead of leaving a single long rail overlapping the spread-apart plate.
 *
 * Butt-joint frame: one axis pair runs `long` (its end segments own the plate
 * corners, extending over any perpendicular padding so they reach the true outer
 * corner); the perpendicular pair runs `short`, fitting between — and a short
 * end segment claims a corner only when its perpendicular long side is absent.
 * A side detaches only when its padding ≥ {@link MARGIN_MIN_DETACH_MM}.
 *
 * World positions are in the plate-centered, padding-free body frame (mm) so they
 * line up with how the preview/export place the body pieces.
 */
export function emitMargins(params: ResolvedBaseplateParams, layout: MarginLayout): MarginPiece[] {
  if (!params.detachMargins) return [];
  const det = detachedSides(params);
  if (!det.left && !det.right && !det.front && !det.back) return [];

  const {
    paddingLeft: pl,
    paddingRight: pr,
    paddingFront: pf,
    paddingBack: pb,
    gridUnitMm,
    fractionalEdgeX,
    fractionalEdgeY,
  } = params;
  const gridUnitMmY = params.gridUnitMmY ?? gridUnitMm;
  const { colSizes, rowSizes, colOffsets, rowOffsets } = layout;
  const halfW = (params.width * gridUnitMm) / 2;
  const halfD = (params.depth * gridUnitMmY) / 2;
  const colLast = colSizes.length - 1;
  const rowLast = rowSizes.length - 1;
  const fill = {
    overTile: !!params.overTile,
    overTileHalfGrid: !!params.overTileHalfGrid,
    overTileHalfGridSolidLeftover: !!params.overTileHalfGridSolidLeftover,
  };
  // Piece-center in the padding-free body frame (matches SplitBaseplateMeshes).
  const colCenter = (c: number): number =>
    colOffsets[c] * gridUnitMm + (colSizes[c] * gridUnitMm) / 2 - halfW;
  const rowCenter = (r: number): number =>
    rowOffsets[r] * gridUnitMmY + (rowSizes[r] * gridUnitMmY) / 2 - halfD;

  const margins: MarginPiece[] = [];
  const push = (
    id: string,
    side: MarginPiece['side'],
    role: MarginPiece['role'],
    col: number,
    row: number,
    lengthMm: number,
    bandThicknessMm: number,
    ownedCorners: MarginCorner[],
    worldOffsetMm: { x: number; y: number },
    seamConnector?: MarginPiece['seamConnector']
  ): void => {
    margins.push({
      id,
      side,
      role,
      col,
      row,
      lengthMm,
      bandThicknessMm,
      ownedCorners,
      worldOffsetMm,
      seamConnector,
      ...fill,
    });
  };
  // Seam-connector layout for a long rail: the mating body wall's grid width and
  // its center offset from the rail center (nonzero on corner-owning end segments
  // that extend over the perpendicular padding). See MarginPiece.seamConnector.
  const seamFor = (
    cellUnits: number,
    centerOffsetMm: number,
    frac: 'start' | 'end'
  ): MarginPiece['seamConnector'] => ({
    cellUnits,
    centerOffsetMm,
    fractionalEdge: isFractional(cellUnits) ? frac : 'end',
  });

  // Prefer front/back as the long (corner-owning) axis; fall back to left/right
  // when neither front nor back detaches.
  const longAxisX = det.front || det.back;

  if (longAxisX) {
    // Front/back run long, segmented per column. End columns extend over the
    // left/right padding to reach the true outer corners (the long rail sits
    // outside the grid in Y while the body's left/right padding sits inside it,
    // so they abut without overlap).
    for (let c = 0; c <= colLast; c++) {
      const extL = c === 0 ? pl : 0;
      const extR = c === colLast ? pr : 0;
      const len = colSizes[c] * gridUnitMm + extL + extR;
      const cx = colCenter(c) - extL / 2 + extR / 2;
      // The connectors track the body wall's grid cells, centered on the piece's
      // grid center — which the corner-extended rail center no longer coincides
      // with, so record that shift for the rail to re-anchor its grooves.
      const seam = seamFor(colSizes[c], colCenter(c) - cx, fractionalEdgeX);
      if (det.front) {
        const owned: MarginCorner[] = [];
        if (c === 0) owned.push('bl');
        if (c === colLast) owned.push('br');
        push(
          `margin-front-${colToLetter(c)}`,
          'front',
          'long',
          c,
          0,
          len,
          pf,
          owned,
          { x: cx, y: -halfD - pf / 2 },
          seam
        );
      }
      if (det.back) {
        const owned: MarginCorner[] = [];
        if (c === 0) owned.push('tl');
        if (c === colLast) owned.push('tr');
        push(
          `margin-back-${colToLetter(c)}`,
          'back',
          'long',
          c,
          rowLast,
          len,
          pb,
          owned,
          { x: cx, y: halfD + pb / 2 },
          seam
        );
      }
    }
    // Short left/right rails, segmented per row, fit between the long rails but
    // extend over a perpendicular side's padding when that side is NOT a long
    // rail (integral or zero), claiming the corner there.
    for (let r = 0; r <= rowLast; r++) {
      const extF = !det.front && r === 0 ? pf : 0;
      const extB = !det.back && r === rowLast ? pb : 0;
      const len = rowSizes[r] * gridUnitMmY + extF + extB;
      const cy = rowCenter(r) - extF / 2 + extB / 2;
      if (det.left) {
        const owned: MarginCorner[] = [];
        if (!det.front && r === 0) owned.push('bl');
        if (!det.back && r === rowLast) owned.push('tl');
        push(`margin-left-${r + 1}`, 'left', 'short', 0, r, len, pl, owned, {
          x: -halfW - pl / 2,
          y: cy,
        });
      }
      if (det.right) {
        const owned: MarginCorner[] = [];
        if (!det.front && r === 0) owned.push('br');
        if (!det.back && r === rowLast) owned.push('tr');
        push(`margin-right-${r + 1}`, 'right', 'short', colLast, r, len, pr, owned, {
          x: halfW + pr / 2,
          y: cy,
        });
      }
    }
  } else {
    // Only left/right detach: they run long, segmented per row, over the full
    // outer depth (front/back padding is integral or zero here), owning all
    // corners on their side.
    for (let r = 0; r <= rowLast; r++) {
      const extF = r === 0 ? pf : 0;
      const extB = r === rowLast ? pb : 0;
      const len = rowSizes[r] * gridUnitMmY + extF + extB;
      const cy = rowCenter(r) - extF / 2 + extB / 2;
      const seam = seamFor(rowSizes[r], rowCenter(r) - cy, fractionalEdgeY);
      if (det.left) {
        const owned: MarginCorner[] = [];
        if (r === 0) owned.push('bl');
        if (r === rowLast) owned.push('tl');
        push(
          `margin-left-${r + 1}`,
          'left',
          'long',
          0,
          r,
          len,
          pl,
          owned,
          { x: -halfW - pl / 2, y: cy },
          seam
        );
      }
      if (det.right) {
        const owned: MarginCorner[] = [];
        if (r === 0) owned.push('br');
        if (r === rowLast) owned.push('tr');
        push(
          `margin-right-${r + 1}`,
          'right',
          'long',
          colLast,
          r,
          len,
          pr,
          owned,
          { x: halfW + pr / 2, y: cy },
          seam
        );
      }
    }
  }

  return margins;
}
