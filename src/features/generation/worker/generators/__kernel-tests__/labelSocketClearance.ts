/**
 * Mesh assertions that a label plate can reach its socket: the pocket's
 * corners and a slide channel's way out stay open.
 */

import type { MeshData } from '@/features/generation/bridge/types';
import type { BinParams } from '@/shared/types/bin';
import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_SOCKET_CLICK_POCKET_DEPTH_MM,
  LABEL_SOCKET_LIP_THICKNESS_MM,
  LABEL_SOCKET_POCKET_DEPTH_MM,
  LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM,
  LABEL_SOCKET_WALL_MM,
  effectiveLabelSocketClearance,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { planLabelTabLayout } from '@/shared/utils/labelTabPlan';
import { COPLANAR_OVERLAP } from '../generatorConstants';
import { planLabelSocketKeepouts } from '../labelSocketKeepouts';
import { columnCrossings } from './meshAssertions';

/**
 * A centred slide channel's cavity floor spans the full pocket width
 * (plate + clearance), measured on the up-facing floor plane inside the
 * pocket's Y band.
 */
export function assertSlideCavity(
  result: MeshData,
  params: BinParams,
  exp: { readonly plateWidthU: LabelPlateWidthU; readonly label: string }
): void {
  const { vertices, normals } = result;
  const clearanceMm = effectiveLabelSocketClearance(
    params.nozzleSizeMm,
    params.label.plateFitOffset
  );
  const pocketW = labelPlateWidthMm(exp.plateWidthU) + clearanceMm;
  const pocketD = LABEL_PLATE_HEIGHT_MM + clearanceMm;
  const innerD = params.depth * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const pocketYFar = innerD / 2 - LABEL_SOCKET_WALL_MM;
  const pocketYNear = pocketYFar - pocketD;

  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > maxZ) maxZ = vertices[i];
  }
  const floorZ =
    maxZ -
    COPLANAR_OVERLAP -
    LABEL_SOCKET_LIP_THICKNESS_MM -
    LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM -
    LABEL_SOCKET_POCKET_DEPTH_MM;

  let count = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const y = vertices[i + 1];
    if (y < pocketYNear - 0.05 || y > pocketYFar + 0.05) continue;
    if (normals[i + 2] < 0.9 || Math.abs(vertices[i + 2] - floorZ) > 0.05) continue;
    count++;
    if (vertices[i] < minX) minX = vertices[i];
    if (vertices[i] > maxX) maxX = vertices[i];
  }
  if (count < 4) {
    throw new Error(`${exp.label}: no slide cavity floor at Z=${floorZ.toFixed(2)}`);
  }
  if (Math.abs(minX + pocketW / 2) > 0.1 || Math.abs(maxX - pocketW / 2) > 0.1) {
    throw new Error(
      `${exp.label}: cavity X ${minX.toFixed(2)}..${maxX.toFixed(2)}, ` +
        `expected ±${(pocketW / 2).toFixed(2)}`
    );
  }
}

/**
 * A plate seats only if both of the pocket's back corners are open down to
 * the floor. Each probe is a column just inside one rounded corner: it must
 * cross the pocket floor as an open surface, which fails once anything (an
 * interior fillet rounding the cavity corner) fills the corner above it.
 */
export function assertPocketCornersOpen(result: MeshData, params: BinParams, label: string): void {
  const clearanceMm = effectiveLabelSocketClearance(
    params.nozzleSizeMm,
    params.label.plateFitOffset
  );
  const pocketW = labelPlateWidthMm(2) + clearanceMm;
  const innerD = params.depth * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const probeY = innerD / 2 - LABEL_SOCKET_WALL_MM - 0.6;

  let maxZ = -Infinity;
  for (let i = 2; i < result.vertices.length; i += 3) {
    if (result.vertices[i] > maxZ) maxZ = result.vertices[i];
  }
  const shelfTopZ = maxZ - COPLANAR_OVERLAP;
  const floorZ =
    params.label.socketStyle === 'slideChannel'
      ? shelfTopZ -
        LABEL_SOCKET_LIP_THICKNESS_MM -
        LABEL_SOCKET_SLIDE_Z_CLEARANCE_MM -
        LABEL_SOCKET_POCKET_DEPTH_MM
      : shelfTopZ - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;

  for (const x of [-pocketW / 2 + 0.3, pocketW / 2 - 0.3]) {
    const hits = columnCrossings(result, x, probeY);
    if (!hits.some((z) => Math.abs(z - floorZ) < 0.05)) {
      throw new Error(
        `${label}: pocket corner at x=${x.toFixed(2)} is filled above the floor ` +
          `(crossings ${hits.map((z) => z.toFixed(2)).join(', ')})`
      );
    }
  }
}

/**
 * A slide-in plate leaves through the mouth, so the path past the shelf edge
 * has to be as open as the pocket: columns where the plate's ends travel, one
 * half plate depth beyond the edge, may carry nothing above the cavity floor
 * (read from the open column at the pocket's centre).
 */
export function assertSlidePathOpen(result: MeshData, params: BinParams, label: string): void {
  const clearanceMm = effectiveLabelSocketClearance(
    params.nozzleSizeMm,
    params.label.plateFitOffset
  );
  const pocketD = LABEL_PLATE_HEIGHT_MM + clearanceMm;
  const innerD = params.depth * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const pocketCentreY = innerD / 2 - LABEL_SOCKET_WALL_MM - pocketD / 2;
  const floorZ = Math.max(...columnCrossings(result, 0, pocketCentreY));
  const pathY = innerD / 2 - params.label.depth - pocketD / 2;
  const plateEnd = labelPlateWidthMm(2) / 2 - 0.1;
  for (const x of [-plateEnd, plateEnd]) {
    const top = Math.max(...columnCrossings(result, x, pathY));
    if (top > floorZ + 0.05) {
      throw new Error(
        `${label}: material at ${top.toFixed(2)} blocks the plate's path above the ` +
          `${floorZ.toFixed(2)} floor at x=${x.toFixed(2)}`
      );
    }
  }
}

/** An empty column would read as `undefined`, and every comparison with it would pass. */
function highestCrossing(result: MeshData, x: number, y: number, label: string): number {
  const hits = columnCrossings(result, x, y);
  if (hits.length === 0) {
    throw new Error(`${label}: nothing at (${x.toFixed(1)}, ${y.toFixed(1)})`);
  }
  return hits[hits.length - 1];
}

/** The rounded corner under a tab tops out at the tab's own shelf, read beside it. */
export function assertCornerLevelWithTab(result: MeshData, params: BinParams, label: string): void {
  const innerW = params.width * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const innerD = params.depth * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const shelf = highestCrossing(result, -innerW / 2 + 12, innerD / 2 - 7, label);
  const corner = highestCrossing(result, -innerW / 2 + 1.5, innerD / 2 - 1.5, label);
  if (Math.abs(corner - shelf) > 0.05) {
    throw new Error(
      `${label}: the corner tops out at ${corner.toFixed(2)}, the shelf at ${shelf.toFixed(2)}`
    );
  }
}

/**
 * A tab sunk below the interior ceiling stays level to its own edges: nothing
 * stands on it between its top and that ceiling. Above the ceiling is the lip,
 * which overhangs a thin wall's tab and is not on the tab at all.
 */
export function assertShelfLevelAcrossTab(
  result: MeshData,
  params: BinParams,
  exp: { readonly sunkMm: number; readonly label: string }
): void {
  const innerW = params.width * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const innerD = params.depth * params.gridUnitMm - 0.5 - 2 * params.wallThickness;
  const layout = planLabelTabLayout(
    params,
    innerW,
    innerD,
    params.height * 7,
    params.wallThickness
  );
  if (!layout) throw new Error(`${exp.label}: no tab planned`);
  const slot = layout.plannedRows[0].slots[0];
  const { tabDepth } = layout.dims;
  const edgeY = slot.positionY - tabDepth + 0.25;
  const shelfTop = highestCrossing(result, slot.tabXStart + slot.tabWidth / 2, edgeY, exp.label);

  const proud: string[] = [];
  for (let x = slot.tabXStart + 0.1; x < slot.tabXStart + slot.tabWidth; x += 0.4) {
    for (let y = slot.positionY - 0.1; y > slot.positionY - tabDepth; y -= 0.4) {
      const top = highestCrossing(result, x, y, exp.label);
      if (top > shelfTop + 0.05 && top < shelfTop + exp.sunkMm + 0.05) {
        proud.push(`(${x.toFixed(1)}, ${y.toFixed(1)}) at ${top.toFixed(2)}`);
      }
    }
  }
  if (proud.length > 0) {
    throw new Error(
      `${exp.label}: ${proud.length} columns stand on the shelf at ${shelfTop.toFixed(2)}, ` +
        `first ${proud.slice(0, 3).join(', ')}`
    );
  }

  // A click-in plate drops in from above, so nothing may cover its pocket: not
  // the fillet, and not the lip overhanging the wall the tab hangs from.
  const floorZ = shelfTop - LABEL_SOCKET_CLICK_POCKET_DEPTH_MM;
  for (const box of planLabelSocketKeepouts(
    params,
    innerW,
    innerD,
    params.height * 7,
    params.wallThickness
  )) {
    for (const x of [box.x0 + 0.3, box.x1 - 0.3]) {
      for (const y of [box.y0 + 0.3, box.y1 - 0.3]) {
        const top = highestCrossing(result, x, y, exp.label);
        if (Math.abs(top - floorZ) > 0.05) {
          throw new Error(
            `${exp.label}: pocket corner (${x.toFixed(1)}, ${y.toFixed(1)}) reads ` +
              `${top.toFixed(2)} from above, not its floor at ${floorZ.toFixed(2)}`
          );
        }
      }
    }
  }
}
