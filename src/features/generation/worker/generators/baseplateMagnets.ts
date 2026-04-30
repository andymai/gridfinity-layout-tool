/**
 * Magnet hole cutters for baseplate.
 *
 * Each hole is a blind cylindrical pocket cut downward from the pocket floor
 * into the solid floor below. Extends down by magnetDepth, leaving a thin
 * retaining floor (MAGNET_FLOOR = 0.5mm) at the bottom.
 *
 * Builds one template cylinder, clones+translates per position. Only full-size
 * (1.0+ unit) cells get magnet holes — Gridfinity spec doesn't define magnet
 * positions for fractional cells.
 */

import { cylinder, unwrap, clone, translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { SOCKET_HEIGHT, COPLANAR_MARGIN, MAGNET_OFFSETS, forEachCell } from './generatorTypes';
import type { ForEachCellOptions } from './generatorTypes';

export function buildMagnetHoles(
  gridW: number,
  gridD: number,
  magnetRadius: number,
  magnetDepth: number,
  cellOpts?: ForEachCellOptions
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
    forEachCell(
      gridW,
      gridD,
      (cell) => {
        if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

        for (const [dx, dy] of MAGNET_OFFSETS) {
          const cloned = unwrap(clone(magnetTemplate));
          try {
            const positioned = translate(cloned, [cell.centerX + dx, cell.centerY + dy, 0]);
            holes.push(positioned);
          } finally {
            cloned.delete();
          }
        }
      },
      cellOpts
    );
  } catch (e) {
    for (const h of holes) h.delete();
    throw e;
  } finally {
    magnetTemplate.delete();
  }
  return holes;
}
