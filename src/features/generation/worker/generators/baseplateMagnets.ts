/**
 * Magnet hole cutters for baseplate.
 *
 * Each hole is a blind cylindrical pocket cut downward from the pocket floor
 * into the solid floor below. Extends down by magnetDepth, leaving a thin
 * retaining floor (MAGNET_FLOOR = 0.5mm) at the bottom.
 *
 * Builds one template cylinder and translates it to each position.
 *
 * Nominal full (1.0+ unit) cells get the standard 4-corner pattern (±13mm from
 * cell center). A half cell keeps whatever of that pattern still fits — two
 * magnets on its long axis, or a single centered one — provided its tapered
 * face holds a printable wall around the hole (`cellHostsAttachmentHoles`, with
 * the placement itself, in `@/shared/generation/magnetPositions`).
 * PARTIAL over-tile margin tiles are handled by
 * {@link buildPartialCellMagnetHoles}: each gets the corner magnets that
 * physically fit, falling back to a single centered magnet for tiles too small
 * for any corner, so the clipped padding tiles aren't left solid.
 */

import { translate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { MagnetAnchor } from '@/core/types';
import { DEFAULT_MAGNET_ANCHOR } from '@/core/types';
import type { MagnetHoleStyle } from '@/shared/generation/magnetHoleStyle';
import { PLAIN_MAGNET_HOLE } from '@/shared/generation/magnetHoleStyle';
import {
  cellHostsAttachmentHoles,
  chamferFitsCell,
  magnetPositionsForCell,
} from '@/shared/generation/magnetPositions';
import { buildMagnetHoleCutter } from './magnetHoleCutter';
import {
  PLATE_PROFILE_HEIGHT,
  COPLANAR_MARGIN,
  forEachCell,
  type ForEachCellOptions,
  type CellInfo,
} from './generatorTypes';
import { resolvePitch, type GridUnitInput } from './gridPitch';

export {
  MAGNET_EDGE_CLEARANCE,
  cellHostsAttachmentHoles,
  chamferFitsCell,
  magnetPositionsForCell,
} from '@/shared/generation/magnetPositions';

/** Magnet placements for one cell, split by whether their chamfer fits there. */
function splitByChamferFit(
  cell: CellInfo,
  magnetRadius: number,
  pitchX: number,
  pitchY: number,
  anchor: MagnetAnchor,
  style: MagnetHoleStyle,
  out: { readonly chamfered: Array<[number, number]>; readonly plain: Array<[number, number]> }
): void {
  const positions = magnetPositionsForCell(cell, magnetRadius, pitchX, pitchY, anchor);
  const chamfer =
    style.chamfer && chamferFitsCell(cell, magnetRadius, pitchX, pitchY, anchor, positions);
  (chamfer ? out.chamfered : out.plain).push(...positions);
}

/** Cutters for both placement groups; the plain group keeps the bore's ribs. */
function buildSplitMagnetCutters(
  groups: { readonly chamfered: Array<[number, number]>; readonly plain: Array<[number, number]> },
  magnetRadius: number,
  magnetDepth: number,
  style: MagnetHoleStyle,
  profileHeight: number
): Shape3D[] {
  return [
    ...buildMagnetCutters(groups.chamfered, magnetRadius, magnetDepth, style, profileHeight),
    ...buildMagnetCutters(
      groups.plain,
      magnetRadius,
      magnetDepth,
      { ...style, chamfer: false },
      profileHeight
    ),
  ];
}

/** Build magnet-hole cutter solids at the given XY positions (Z handled here). */
function buildMagnetCutters(
  positions: ReadonlyArray<readonly [number, number]>,
  magnetRadius: number,
  magnetDepth: number,
  style: MagnetHoleStyle,
  profileHeight: number
): Shape3D[] {
  if (positions.length === 0) return [];
  // Cutter starts above the pocket floor (COPLANAR_MARGIN avoids coplanar with
  // pocket bottom at Z=-profileHeight) and cuts downward by magnetDepth.
  // Leaves MAGNET_FLOOR of solid material at the bottom of each hole.
  const cutterZ = -profileHeight + COPLANAR_MARGIN;
  const cutterDepth = magnetDepth + COPLANAR_MARGIN;
  const atOrigin = buildMagnetHoleCutter({
    radius: magnetRadius,
    height: cutterDepth,
    style,
    mouth: { end: 'top', inset: COPLANAR_MARGIN },
  });
  const magnetTemplate = translate(atOrigin, [0, 0, cutterZ - cutterDepth]);
  atOrigin.delete();

  const holes: Shape3D[] = [];
  try {
    for (const [x, y] of positions) {
      holes.push(translate(magnetTemplate, [x, y, 0]));
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
  cellOpts?: ForEachCellOptions,
  cellFilter?: (cell: CellInfo) => boolean,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR,
  style: MagnetHoleStyle = PLAIN_MAGNET_HOLE,
  profileHeight: number = PLATE_PROFILE_HEIGHT
): Shape3D[] {
  const { x: pitchX, y: pitchY } = resolvePitch(cellOpts?.gridUnitMm);
  const groups = { chamfered: [] as Array<[number, number]>, plain: [] as Array<[number, number]> };
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      if (!cellHostsAttachmentHoles(cell, magnetRadius, pitchX, pitchY)) return;
      if (cellFilter !== undefined && !cellFilter(cell)) return;
      // Same shared placement (with the standard wall-distance clamp) as the bin
      // base and lid, so every magnet-bearing surface agrees.
      splitByChamferFit(cell, magnetRadius, pitchX, pitchY, anchor, style, groups);
    },
    cellOpts
  );
  return buildSplitMagnetCutters(groups, magnetRadius, magnetDepth, style, profileHeight);
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
  gridUnitMm: GridUnitInput,
  anchor: MagnetAnchor = DEFAULT_MAGNET_ANCHOR,
  style: MagnetHoleStyle = PLAIN_MAGNET_HOLE,
  profileHeight: number = PLATE_PROFILE_HEIGHT
): Shape3D[] {
  // `x` scales width, `y` scales depth (equal for a square grid).
  const { x: pitchX, y: pitchY } = resolvePitch(gridUnitMm);
  const groups = { chamfered: [] as Array<[number, number]>, plain: [] as Array<[number, number]> };
  for (const cell of cells) {
    splitByChamferFit(cell, magnetRadius, pitchX, pitchY, anchor, style, groups);
  }
  return buildSplitMagnetCutters(groups, magnetRadius, magnetDepth, style, profileHeight);
}
