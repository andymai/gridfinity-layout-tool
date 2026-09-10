/** Label-tab material for print estimates: plate, ramp, gussets and lip support per row. */

import type { BinParams, LabelTabSupport } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  getCompartmentBounds,
} from '@/features/bin-designer/utils/compartments';

/** Builder constant: max unsupported shelf span between bracket gussets. */
const BRACKET_GUSSET_SPACING_MM = 10;

interface LabelTabGeom {
  readonly tabDepth: number;
  readonly gussetLeg: number;
  readonly wallThickness: number;
  readonly dividerThickness: number;
  readonly widthPercent: number;
  readonly inset: number;
  readonly support: LabelTabSupport;
}

/**
 * Volume of label tabs, mirroring `labelTabBuilder.buildTabsAtRow`'s
 * grouping and skip conditions (tilted anchor wall, depth+inset overrun,
 * `edges='both'` collisions) so the estimate tracks what the builder
 * actually generates.
 */
export function computeLabelTabVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const { cols, rows, thickness } = params.compartments;
  const { depth: tabDepth, width: widthPercent, support } = params.label;
  const inset = params.label.inset ?? 0;
  const edges = params.label.edges ?? 'back';

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Mirrors the bridge guard in `buildLabelTabsInScope`.
  if (tabDepth >= innerD) return 0;

  // `gussetLeg` clamps at 0 so a tabDepth ≤ wallThickness yields shelf-only
  // volume (no support), matching the builder's guard on degenerate geometry.
  const geom: LabelTabGeom = {
    tabDepth,
    gussetLeg: Math.max(0, tabDepth - wallThickness),
    wallThickness,
    dividerThickness: thickness,
    widthPercent,
    inset,
    support,
  };

  const includeBack = edges === 'back' || edges === 'both';
  const includeFront = edges === 'front' || edges === 'both';
  const collidingFrontIds =
    edges === 'both' ? findCollidingFrontIds(params, cellD, tabDepth, inset) : null;

  let volume = 0;
  for (let row = 0; row < rows; row++) {
    if (includeBack) {
      volume += sumTabVolumesAtRow(params, row, 'back', cellW, cellD, geom, null);
    }
    if (includeFront) {
      volume += sumTabVolumesAtRow(params, row, 'front', cellW, cellD, geom, collidingFrontIds);
    }
  }
  return volume;
}

/**
 * Per-tab volume as a function of shelf width. Support depends on style:
 *   - `solid` / `fillet`: triangular prism extruded the full shelf width.
 *     Fillet has a concave profile but the over-estimate is small.
 *   - `bracket`: ~`ceil(tabWidth / BRACKET_GUSSET_SPACING_MM)` gussets,
 *     each extruded by the divider thickness (within ±1 of the builder).
 */
function tabContribution(geom: LabelTabGeom, tabWidth: number): number {
  if (tabWidth <= 0) return 0;
  const shelf = geom.tabDepth * tabWidth * geom.wallThickness;
  if (geom.gussetLeg <= 0) return shelf;
  const triangleArea = 0.5 * geom.tabDepth * geom.gussetLeg;
  const support =
    geom.support === 'bracket'
      ? Math.max(1, Math.ceil(tabWidth / BRACKET_GUSSET_SPACING_MM)) *
        triangleArea *
        geom.dividerThickness
      : triangleArea * tabWidth;
  return shelf + support;
}

/**
 * Sum tab volumes for one row + anchor edge. Mirrors the grouping and
 * skip logic of `labelTabBuilder.buildTabsAtRow`, including the
 * `thickness/2` boundary deduction at real divider walls.
 */
function sumTabVolumesAtRow(
  params: BinParams,
  row: number,
  anchor: 'back' | 'front',
  cellW: number,
  cellD: number,
  geom: LabelTabGeom,
  collidingFrontIds: Set<number> | null
): number {
  const { cols, rows, cells, thickness } = params.compartments;
  const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
  const neighborRowOffset = anchor === 'back' ? 1 : -1;
  const hasTiltedAnchorWall =
    anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;

  const cellAt = (c: number): number => cells[row * cols + c];
  const anchorsTab = (c: number): boolean =>
    isOuterEdgeRow || cellAt(c) !== cells[(row + neighborRowOffset) * cols + c];

  let volume = 0;
  let col = 0;

  while (col < cols) {
    const cellId = cellAt(col);
    if (!anchorsTab(col)) {
      col++;
      continue;
    }
    if (hasTiltedAnchorWall(params.compartments, cellId)) {
      col++;
      continue;
    }
    if (anchor === 'front' && collidingFrontIds?.has(cellId)) {
      col++;
      continue;
    }

    const bounds = getCompartmentBounds(params.compartments, cellId);
    if (bounds) {
      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
      if (geom.tabDepth + geom.inset > compartmentDepth) {
        col++;
        continue;
      }
    }

    let groupEnd = col + 1;
    while (groupEnd < cols && cellAt(groupEnd) === cellId && anchorsTab(groupEnd)) {
      groupEnd++;
    }

    const groupCols = groupEnd - col;
    const groupMinCol = col;
    const groupMaxCol = groupEnd - 1;

    // Deduct half the divider thickness on either side that borders an
    // actual divider wall (a different compartment). Outer bin walls don't
    // deduct — the cellW already starts inside the bin wall.
    const leftDeduction = groupMinCol > 0 && cellAt(groupMinCol - 1) !== cellId ? thickness / 2 : 0;
    const rightDeduction =
      groupMaxCol < cols - 1 && cellAt(groupMaxCol + 1) !== cellId ? thickness / 2 : 0;
    const availableWidth = groupCols * cellW - leftDeduction - rightDeduction;
    const tabWidth = (availableWidth * geom.widthPercent) / 100;

    volume += tabContribution(geom, tabWidth);
    col = groupEnd;
  }

  return volume;
}

/**
 * For `edges='both'`, identify compartments whose back+front tab pair would
 * collide so the front tab is dropped from the estimate. Mirror of
 * `labelTabBuilder.findCollidingFrontCompartments`.
 */
function findCollidingFrontIds(
  params: BinParams,
  cellD: number,
  tabDepth: number,
  inset: number
): Set<number> {
  const { cols, rows, cells } = params.compartments;
  const colliding = new Set<number>();
  const visited = new Set<number>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellId = cells[row * cols + col];
      if (visited.has(cellId)) continue;
      visited.add(cellId);

      const bounds = getCompartmentBounds(params.compartments, cellId);
      if (!bounds) continue;

      const hasFrontAnchor =
        bounds.minRow === 0 || cells[(bounds.minRow - 1) * cols + bounds.minCol] !== cellId;
      const hasBackAnchor =
        bounds.maxRow === rows - 1 || cells[(bounds.maxRow + 1) * cols + bounds.minCol] !== cellId;
      if (!hasBackAnchor || !hasFrontAnchor) continue;

      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
      if (2 * tabDepth + 2 * inset > compartmentDepth) {
        colliding.add(cellId);
      }
    }
  }

  return colliding;
}

/**
 * Material under one ramp's profile between the wall and `a` mm out along the
 * run: the part a divider's near half swallows when the ramp starts on its
 * centreline. Curved: the quarter-ellipse arc y = run(1 − cos θ),
 * z = height(1 − sin θ), so ∫z dy = run·height·[(1 − cos θa) − (θa/2 − sin 2θa/4)].
 */
export function rampAreaWithin(
  profile: { run: number; height: number; style: string },
  a: number
): number {
  const reach = Math.min(Math.max(0, a), profile.run);
  if (profile.style !== 'curved') return profile.height * reach * (1 - reach / (2 * profile.run));
  const theta = Math.acos(1 - reach / profile.run);
  return (
    profile.run * profile.height * (1 - Math.cos(theta) - (theta / 2 - Math.sin(2 * theta) / 4))
  );
}

/**
 * Cross-section (mm²) of the stacking lip's angled support below the wall top:
 * the integrated lip's inner loft steps in from the wall face 2.65mm under the
 * top to the full overhang inset 1.2mm under it, then runs vertical. A lipped
 * outer ramp's strip climbs that same band flush with the lip base, so the
 * support's area is material the shell already prices. Mirrors
 * `integratedLipBuilder` (LIP_EXTENSION, FOOT: cross-feature import not allowed).
 */
export function lipSupportArea(wallThickness: number): number {
  const LIP_EXTENSION = 1.2;
  const FOOT = 0.05;
  const top = Math.max(0, GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER - wallThickness);
  const foot = Math.max(0, LIP_EXTENSION - wallThickness);
  const rampHeight = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER - LIP_EXTENSION - FOOT;
  return ((foot + top) / 2) * rampHeight + top * LIP_EXTENSION;
}
