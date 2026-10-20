/**
 * Where attachment holes (magnets, and screws that snap to them) sit in a
 * cell. One source for the baseplate, the bin base, the lid and the screw
 * planner, and kernel-free so the main thread plans with the same positions
 * the worker cuts.
 */

import type { MagnetAnchor } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { MAGNET_CHAMFER_MM } from './magnetHoleStyle';
import { SIZE, HOLE_OFFSET, CLEARANCE, SOCKET_TAPER_WIDTH } from './generatorConstants';
import type { CellInfo } from './cellDecomposition';

/**
 * Center-to-wall inset (mm) of a standard magnet in a 42mm cell (`SIZE/2 −
 * HOLE_OFFSET` = 8mm). Spread magnets on small/non-square cells use this same
 * inset from the ends so their gap from the wall matches the regular sections
 * (rather than being jammed against the edge).
 */
const STANDARD_WALL_INSET = SIZE / 2 - HOLE_OFFSET;

/**
 * Minimum plastic wall (mm) kept between a magnet hole and a small cell's edge
 * when the standard ±13mm 4-corner pattern won't fit (a non-square/small bin
 * foot or a clipped over-tile margin tile). A standard 42mm cell keeps ~4.75mm;
 * this is the printable floor used for the fit-or-center fallback.
 */
export const MAGNET_EDGE_CLEARANCE = 1.5;

/**
 * Whether a cell may carry attachment (magnet / screw) holes at all.
 *
 * {@link magnetPositionsForCell} measures its wall from the cell's NOMINAL edge,
 * which the tapered face the hole opens on falls short of by `SOCKET_TAPER_WIDTH`
 * a side — the foot's inset, which is the tighter of the mating pair.
 * A full cell absorbs that; a half cell only does from around spec pitch upward.
 *
 * Full cells bypass the span check rather than passing it: they carry holes at
 * every pitch today, and re-gating them would move holes on parts already
 * printed.
 */
export function cellHostsAttachmentHoles(
  cell: CellInfo,
  holeRadius: number,
  pitchX: number,
  pitchY: number
): boolean {
  if (cell.widthUnits >= 1 && cell.depthUnits >= 1) return true;
  const minSpanMm = 2 * (holeRadius + MAGNET_EDGE_CLEARANCE + SOCKET_TAPER_WIDTH) + CLEARANCE;
  return cell.widthUnits * pitchX >= minSpanMm && cell.depthUnits * pitchY >= minSpanMm;
}

/**
 * True when every hole in `cell` can open its chamfer without breaching the
 * foot or pocket edge: the widened mouth must still be hostable, and must not
 * move the placement, or the chamfer would sit off-centre from the bore the
 * plain radius placed. `positions` are the placements already resolved for
 * the plain radius.
 */
export function chamferFitsCell(
  cell: CellInfo,
  holeRadius: number,
  pitchX: number,
  pitchY: number,
  anchor: MagnetAnchor | undefined,
  positions: ReadonlyArray<readonly [number, number]>
): boolean {
  const mouthRadius = holeRadius + MAGNET_CHAMFER_MM;
  if (!cellHostsAttachmentHoles(cell, mouthRadius, pitchX, pitchY)) return false;
  const widened = magnetPositionsForCell(cell, mouthRadius, pitchX, pitchY, anchor);
  if (widened.length !== positions.length) return false;
  return widened.every(
    ([x, y], i) => Math.abs(x - positions[i][0]) < 1e-6 && Math.abs(y - positions[i][1]) < 1e-6
  );
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
  pitchY: number,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR
): Array<[number, number]> {
  const halfW = (cell.widthUnits * pitchX) / 2;
  const halfD = (cell.depthUnits * pitchY) / 2;

  // Per-unit offset from cell center to a corner magnet.
  //
  // 'edge' (default): a constant STANDARD_WALL_INSET (8mm) from the cell edge,
  // so magnets stay corner-aligned as gridUnitMm grows past 42mm instead of
  // pinned at ±HOLE_OFFSET from center (which drifts them inward on a larger
  // cell). At pitch ≤42mm the offset floors at HOLE_OFFSET, so every cell there
  // — including wide over-tile margin tiles — is byte-identical to before; above
  // 42mm the offset (and margin tiles with it) grows.
  //
  // 'center' (legacy,): the pre-fix behavior — a fixed ±HOLE_OFFSET (13mm)
  // from cell center regardless of pitch. Identical to 'edge' at ≤42mm; on
  // larger grids the magnets drift inward. Kept so parts printed against the old
  // placement still mate. Layout-scoped, so a layout's bins/lids/baseplate all
  // use the same anchor.
  //
  // The trailing Math.min preserves the wall gap on short/non-square cells.
  // Depends only on cell size + pitch + anchor (not magnetRadius), so a bin base
  // and the lid stacked on it mate.
  const unitOffX =
    anchor === 'center' ? HOLE_OFFSET : Math.max(HOLE_OFFSET, pitchX / 2 - STANDARD_WALL_INSET);
  const unitOffY =
    anchor === 'center' ? HOLE_OFFSET : Math.max(HOLE_OFFSET, pitchY / 2 - STANDARD_WALL_INSET);
  const offX = Math.min(unitOffX, halfW - STANDARD_WALL_INSET);
  const offY = Math.min(unitOffY, halfD - STANDARD_WALL_INSET);

  // A magnet must at least fit centered on both axes, else the cell is too small.
  const reach = magnetRadius + MAGNET_EDGE_CLEARANCE;

  // Standard 4-corner pattern when each axis can seat two magnets at its clamped
  // offset with a printable gap between the pair and from the wall (offX/offY ≥
  // reach). Preserves the standard wall distance on every cell that can hold it.
  if (offX >= reach && offY >= reach) {
    return [
      [cell.centerX - offX, cell.centerY - offY],
      [cell.centerX + offX, cell.centerY - offY],
      [cell.centerX + offX, cell.centerY + offY],
      [cell.centerX - offX, cell.centerY + offY],
    ];
  }

  if (reach > halfW || reach > halfD) return [];

  // Spread magnets along the longer axis, centered on the shorter one. The
  // outermost magnets sit the SAME distance from the end wall as a standard
  // magnet does in a full cell (STANDARD_WALL_INSET) — so they aren't jammed
  // against the edge — but at least a printable wall for oversized magnets.
  // Interior magnets track the ±HOLE_OFFSET corner pitch (~26mm apart).
  const alongX = halfW >= halfD;
  const halfLong = alongX ? halfW : halfD;
  const outerInset = Math.max(STANDARD_WALL_INSET, reach);
  const usableHalf = halfLong - outerInset;

  // Long axis too short to seat a magnet at the standard inset → one centered.
  if (usableHalf <= 1e-6) {
    return [[cell.centerX, cell.centerY]];
  }

  const count = Math.floor(usableHalf / HOLE_OFFSET) + 1;
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
 * Whether this cell's floor relief is the plain rectangle cut into a cell too
 * small for a magnet, whose square corners reach toward the cell corners. A
 * cell that hosts magnets keeps a pad in each corner instead. Mirrors the gates
 * on the two relief passes in `buildBaseplateSolid`.
 */
export function floorReliefReachesCorners(
  params: Pick<ResolvedBaseplateParams, 'lightweight' | 'solidFloor' | 'magnetHoles'>,
  cell: CellInfo,
  holeRadius: number,
  pitchX: number,
  pitchY: number,
  cellHoldsScrew: (cell: CellInfo) => boolean
): boolean {
  if (params.lightweight === false || params.solidFloor === true) return false;
  if (!params.magnetHoles && !cellHoldsScrew(cell)) return false;
  return !cellHostsAttachmentHoles(cell, holeRadius, pitchX, pitchY);
}
