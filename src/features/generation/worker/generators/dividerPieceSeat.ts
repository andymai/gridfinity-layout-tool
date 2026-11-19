/**
 * The piece fit: thins a removable divider where it seats in the bin, so a
 * tight fit is fixed by reprinting the piece and never the bin.
 *
 * In the flat print frame (X along the length, Y up the installed height with
 * the floor edge at -Y, Z through the thickness with the bed face at Z = 0) the
 * whole thinning comes off the TOP face. The piece prints flat, so its
 * thickness is whole layers: one face loses `2 * pieceFit` in one layer step
 * where two faces would each lose half a layer and round to nothing, and the
 * bed face stays flat for the first layer.
 */

import { box, cut, fuseAll, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { dividerGrooveDepth, resolvePieceFit } from '@/shared/utils/slotMath';
import { lipInnerReachMm } from '@/shared/utils/lipNotchPlan';
import type { PieceCorners } from '@/shared/utils/slottedFillet';
import { COPLANAR_OVERLAP } from './generatorConstants';

/**
 * How far past the lip channel the thinned end runs. Wider than the neck
 * relief's own margin, so the two cuts never end on one plane.
 */
const END_MARGIN = 1;

/** How far the thinned floor edge stands above the floor top, clear of the groove's mouth. */
const BAND_SLACK = 0.3;

export interface PieceSeatFit {
  /** Material removed from the top face where the piece seats (mm). */
  readonly thinning: number;
  /** How far past its slot engagement each end stays thinned (mm). */
  readonly endReach: number;
  /** Height of the floor edge thinned for the groove (mm); 0 without one. */
  readonly bandHeight: number;
}

/**
 * Where a piece of this design seats beyond its tab: down the lip channel as it
 * drops in, and along the floor groove under its whole length.
 */
export function resolvePieceSeatFit(params: BinParams, hasLip: boolean): PieceSeatFit {
  const pieceFit = resolvePieceFit(params.dividerPieces);
  const lipReach = hasLip ? Math.max(0, lipInnerReachMm(params) - params.wallThickness) : 0;
  const grooveDepth = dividerGrooveDepth(params);
  return {
    thinning: 2 * pieceFit,
    endReach: lipReach + END_MARGIN,
    bandHeight: grooveDepth > 0 ? grooveDepth + BAND_SLACK : 0,
  };
}

export function seatTopZ(thickness: number, seat: PieceSeatFit): number {
  return thickness - seat.thinning;
}

/**
 * Thin both ends over their full height, and the floor edge over the full
 * length. A rounded end seats in a channel that curves along the fillet, so
 * its corner is thinned too, past the straight end band. Consumes `piece`;
 * passes it through when the fit is 0.
 */
export function cutPieceSeatFit(
  piece: Shape3D,
  length: number,
  height: number,
  thickness: number,
  tabDepth: number,
  seat: PieceSeatFit,
  corners: PieceCorners | null = null
): Shape3D {
  if (seat.thinning <= 0) return piece;

  const zLow = thickness - seat.thinning;
  const zHigh = thickness + COPLANAR_OVERLAP;
  const zCenter = (zLow + zHigh) / 2;
  const zSize = zHigh - zLow;
  const cutters: Shape3D[] = [];

  const endLength = tabDepth + seat.endReach;
  const ySize = height + 2 * COPLANAR_OVERLAP;
  if (2 * endLength >= length || seat.bandHeight >= height) {
    cutters.push(box(length + 2 * COPLANAR_OVERLAP, ySize, zSize, { at: [0, 0, zCenter] }));
  } else {
    for (const sign of [-1, 1] as const) {
      const outer = sign * (length / 2 + COPLANAR_OVERLAP);
      const inner = sign * (length / 2 - endLength);
      cutters.push(
        box(Math.abs(outer - inner), ySize, zSize, { at: [(outer + inner) / 2, 0, zCenter] })
      );
    }
    if (corners) {
      const reach = tabDepth + corners.radius + END_MARGIN;
      const rise = corners.radius + END_MARGIN;
      for (const [sign, rounded] of [
        [-1, corners.low],
        [1, corners.high],
      ] as const) {
        if (!rounded) continue;
        const outer = sign * (length / 2 + COPLANAR_OVERLAP);
        const inner = sign * (length / 2 - reach);
        const yLow = -height / 2 - COPLANAR_OVERLAP;
        const yHigh = -height / 2 + rise;
        cutters.push(
          box(Math.abs(outer - inner), yHigh - yLow, zSize, {
            at: [(outer + inner) / 2, (yLow + yHigh) / 2, zCenter],
          })
        );
      }
    }
    if (seat.bandHeight > 0) {
      const yLow = -height / 2 - COPLANAR_OVERLAP;
      const yHigh = -height / 2 + seat.bandHeight;
      cutters.push(
        box(length + 2 * COPLANAR_OVERLAP, yHigh - yLow, zSize, {
          at: [0, (yLow + yHigh) / 2, zCenter],
        })
      );
    }
  }

  const tool = cutters.length === 1 ? cutters[0] : unwrap(fuseAll(cutters as ValidSolid[]));
  try {
    return unwrap(cut(piece, tool));
  } finally {
    piece.delete();
    if (tool !== cutters[0]) tool.delete();
    for (const c of cutters) c.delete();
  }
}
