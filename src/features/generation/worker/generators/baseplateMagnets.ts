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
import { SOCKET_HEIGHT, COPLANAR_MARGIN, MAGNET_OFFSETS, forEachCell } from './generatorTypes';
import type { ForEachCellOptions, CellInfo } from './generatorTypes';

/**
 * Minimum plastic wall (mm) kept between a magnet hole and a tile's outer edge
 * when fitting magnets into a partial over-tile tile. A standard full cell keeps
 * ~4.75mm; partial tiles use this floor so the hole stays printable and doesn't
 * breach the clipped edge.
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
 * Magnet positions for a single (possibly partial) tile. Full-size tiles get the
 * standard 4-corner pattern unchanged. Partial tiles get the corner magnets that
 * fit within the tile footprint (magnet radius + {@link MAGNET_EDGE_CLEARANCE}
 * inside each edge); if no corner fits, a single centered magnet is used when it
 * fits. Returns `[]` for a tile too small for even a centered magnet.
 */
export function magnetPositionsForCell(
  cell: CellInfo,
  magnetRadius: number,
  gridUnitMm: number
): Array<[number, number]> {
  const isFull = cell.widthUnits >= 1 && cell.depthUnits >= 1;
  if (isFull) {
    return MAGNET_OFFSETS.map(([dx, dy]) => [cell.centerX + dx, cell.centerY + dy]);
  }

  const halfW = (cell.widthUnits * gridUnitMm) / 2;
  const halfD = (cell.depthUnits * gridUnitMm) / 2;
  const reach = magnetRadius + MAGNET_EDGE_CLEARANCE;

  const fitting = MAGNET_OFFSETS.filter(
    ([dx, dy]) => Math.abs(dx) + reach <= halfW && Math.abs(dy) + reach <= halfD
  );
  if (fitting.length > 0) {
    return fitting.map(([dx, dy]) => [cell.centerX + dx, cell.centerY + dy]);
  }

  // Center-magnet fallback for tiles too narrow for any corner.
  if (reach <= halfW && reach <= halfD) {
    return [[cell.centerX, cell.centerY]];
  }
  return [];
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
    positions.push(...magnetPositionsForCell(cell, magnetRadius, gridUnitMm));
  }
  return buildMagnetCutters(positions, magnetRadius, magnetDepth);
}
