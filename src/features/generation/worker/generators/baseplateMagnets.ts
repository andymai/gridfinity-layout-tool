/**
 * Magnet hole cutters for baseplate.
 *
 * Each hole is a blind cylindrical pocket cut downward from the pocket floor
 * into the solid floor below. Extends down by magnetDepth, leaving a thin
 * retaining floor (MAGNET_FLOOR = 0.5mm) at the bottom.
 *
 * Builds one template cylinder, clones+translates per position.
 *
 * Nominal full (1.0+ unit) cells get the standard 4-corner pattern (±13mm from
 * cell center). Fractional cells in the nominal grid are skipped — the
 * Gridfinity spec doesn't define magnet positions there. PARTIAL over-tile
 * margin tiles are handled by {@link buildPartialCellMagnetHoles}: each gets the
 * corner magnets that physically fit, falling back to a single centered magnet
 * for tiles too small for any corner, so the clipped padding tiles aren't left
 * solid.
 */

import { cylinder, unwrap, clone, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import {
  SOCKET_HEIGHT,
  COPLANAR_MARGIN,
  MAGNET_OFFSETS,
  HOLE_OFFSET,
  forEachCell,
} from './generatorTypes';
import type { ForEachCellOptions, CellInfo } from './generatorTypes';

/**
 * Minimum plastic wall (mm) kept between a magnet hole and a small cell's edge
 * when the standard ±13mm 4-corner pattern won't fit (a non-square/small bin
 * foot or a clipped over-tile margin tile). A standard 42mm cell keeps ~4.75mm;
 * this is the printable floor used for the fit-or-center fallback.
 */
export const MAGNET_EDGE_CLEARANCE = 1.5;

/** Build magnet-hole cutter solids at the given XY positions (Z handled here). */
function buildMagnetCutters(
  positions: ReadonlyArray<readonly [number, number]>,
  magnetRadius: number,
  magnetDepth: number
): Shape3D[] {
  // Cutter starts above the pocket floor (COPLANAR_MARGIN avoids coplanar with
  // pocket bottom at Z=-SOCKET_HEIGHT) and cuts downward by magnetDepth.
  // Leaves MAGNET_FLOOR of solid material at the bottom of each hole.
  const cutterZ = -SOCKET_HEIGHT + COPLANAR_MARGIN;
  const cutterDepth = magnetDepth + COPLANAR_MARGIN;
  const magnetTemplate = cylinder(magnetRadius, cutterDepth, {
    at: [0, 0, cutterZ],
    axis: [0, 0, -1],
  });

  const holes: Shape3D[] = [];
  try {
    for (const [x, y] of positions) {
      const cloned = unwrap(clone(magnetTemplate));
      try {
        holes.push(translate(cloned, [x, y, 0]));
      } finally {
        cloned.delete();
      }
    }
  } catch (e) {
    for (const h of holes) h.delete();
    throw e;
  } finally {
    magnetTemplate.delete();
  }
  return holes;
}

export function buildMagnetHoles(
  gridW: number,
  gridD: number,
  magnetRadius: number,
  magnetDepth: number,
  cellOpts?: ForEachCellOptions
): Shape3D[] {
  const positions: Array<[number, number]> = [];
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
      for (const [dx, dy] of MAGNET_OFFSETS) {
        positions.push([cell.centerX + dx, cell.centerY + dy]);
      }
    },
    cellOpts
  );
  return buildMagnetCutters(positions, magnetRadius, magnetDepth);
}

/**
 * Magnet positions for a single cell/tile, per-axis pitch (`pitchX` scales
 * width, `pitchY` scales depth — equal for a square grid).
 *
 * - Standard cells: when the ±{@link HOLE_OFFSET}mm 4-corner pattern fits the
 *   cell geometrically, it's used unchanged (so standard 42mm cells — bin feet
 *   and baseplate cells alike — are byte-identical).
 * - Narrow/non-square cells (a 25mm bin foot, a clipped over-tile margin tile):
 *   the corner pattern can't fit, so magnets are SPREAD in a line along the
 *   LONGER axis, centered on the shorter one — top/bottom for a narrow-tall foot,
 *   left/right for a wide-short one. Spacing tracks the Gridfinity 2·HOLE_OFFSET
 *   corner pitch, so the magnets sit near the ends and the middle stays open
 *   (with a shelled/lightweight base, material lands only under the magnets
 *   instead of filling the foot with one central blob).
 * - Cells long enough for only one magnet: a single centered magnet.
 * - Cells too small for even one: `[]`.
 *
 * `magnetRadius` should be the largest cutter radius at each position (max of the
 * magnet and screw radii when a cell carries both).
 */
export function magnetPositionsForCell(
  cell: CellInfo,
  magnetRadius: number,
  pitchX: number,
  pitchY: number
): Array<[number, number]> {
  const halfW = (cell.widthUnits * pitchX) / 2;
  const halfD = (cell.depthUnits * pitchY) / 2;

  // Standard 4-corner pattern where the ±HOLE_OFFSET corners fit the cell (no
  // extra wall required — matches the long-standing unconditional placement for
  // square cells with any magnet that doesn't overrun the edge).
  const standardFits =
    HOLE_OFFSET + magnetRadius <= halfW && HOLE_OFFSET + magnetRadius <= halfD;
  if (standardFits) {
    return MAGNET_OFFSETS.map(([dx, dy]) => [cell.centerX + dx, cell.centerY + dy]);
  }

  // A magnet must at least fit centered on both axes, else the cell is too small.
  const reach = magnetRadius + MAGNET_EDGE_CLEARANCE;
  if (reach > halfW || reach > halfD) return [];

  // Spread magnets along the longer axis, centered on the shorter one. Magnet
  // centers stay within ±usableHalf (a printable wall from each end); count
  // tracks the ±HOLE_OFFSET corner pitch (~26mm apart).
  const alongX = halfW >= halfD;
  const halfLong = alongX ? halfW : halfD;
  const usableHalf = halfLong - reach;
  const count = Math.max(1, Math.floor(usableHalf / HOLE_OFFSET) + 1);

  if (count === 1) {
    return [[cell.centerX, cell.centerY]];
  }

  const positions: Array<[number, number]> = [];
  const step = (2 * usableHalf) / (count - 1);
  for (let i = 0; i < count; i++) {
    const offset = -usableHalf + i * step;
    positions.push(
      alongX ? [cell.centerX + offset, cell.centerY] : [cell.centerX, cell.centerY + offset]
    );
  }
  return positions;
}

/**
 * Build magnet-hole cutters for partial over-tile margin tiles. Each tile gets
 * the magnets from {@link magnetPositionsForCell}. Called in addition to
 * {@link buildMagnetHoles} so the clipped padding tiles carry magnets instead of
 * solid plastic.
 */
export function buildPartialCellMagnetHoles(
  cells: readonly CellInfo[],
  magnetRadius: number,
  magnetDepth: number,
  gridUnitMm: number
): Shape3D[] {
  const positions: Array<[number, number]> = [];
  for (const cell of cells) {
    // Baseplate grid is square, so both axes use the same pitch.
    positions.push(...magnetPositionsForCell(cell, magnetRadius, gridUnitMm, gridUnitMm));
  }
  return buildMagnetCutters(positions, magnetRadius, magnetDepth);
}
