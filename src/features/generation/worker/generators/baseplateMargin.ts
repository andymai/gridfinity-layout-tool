/**
 * Detached margin rail geometry (issue #2392).
 *
 * A rail is the drawer-fit padding band of one side printed as its own piece.
 * It reuses the body's slab/pocket/corner helpers but cannot go through
 * {@link buildBaseplateSolid}: that path keys every dimension off whole grid
 * units and `sanitizeParams` rejects a zero-grid piece. A rail is instead a
 * plain `lengthMm × bandThicknessMm` slab, built centered at the origin (like a
 * split body piece — the preview/export layer positions it via
 * `MarginPiece.worldOffsetMm`).
 *
 * Over-tile / half-grid pockets are reused from the body's `frameCells` output,
 * filtered to the cells that fall inside this rail's footprint, so the rail's
 * grid-aligned tiles line up exactly with the body. Owned corners (see
 * `MarginPiece.ownedCorners`) are rounded with the body-scale radius so the
 * assembled plate's outer corner matches the integral plate; the seam edges
 * stay square. Rails carry no magnet holes or lightweight floor.
 */

import { mesh, meshEdges, translate, getKernelCapabilities, exportSTEP, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { ResolvedBaseplateParams, MarginPiece } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import {
  SOCKET_HEIGHT,
  frameCells,
  toIndexedMeshData,
  MAGNET_FLOOR,
  MIN_PRINTABLE_TILE_MM,
  resolveCornerRadii,
} from './generatorTypes';
import type { SideMargins } from './generatorTypes';
import { buildSlabProfile } from './baseplateSlab';
import { buildMarginSeamGroove } from './baseplateConnectors';
import { cutInBatches } from './baseplateBatchOps';
import { getPocketTemplate } from './baseplatePockets';
import { buildBaseplateSTL } from './baseplateSTL';
import { creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';

interface RailDims {
  readonly railW: number;
  readonly railD: number;
  readonly totalHeight: number;
}

/** Rail footprint in its own (origin-centered) frame and slab height. */
function railDims(params: ResolvedBaseplateParams, margin: MarginPiece): RailDims {
  const horizontal = margin.side === 'front' || margin.side === 'back';
  const floorDepth = params.magnetHoles ? MAGNET_FLOOR + params.magnetDepth : 0;
  return {
    railW: horizontal ? margin.lengthMm : margin.bandThicknessMm,
    railD: horizontal ? margin.bandThicknessMm : margin.lengthMm,
    totalHeight: SOCKET_HEIGHT + floorDepth,
  };
}

/** Owned-corner radii, capped so the rail corner matches the integral plate. */
function railCornerRadii(
  params: ResolvedBaseplateParams,
  margin: MarginPiece,
  railW: number,
  railD: number
): { tl: number; tr: number; bl: number; br: number } {
  const {
    paddingLeft: pl,
    paddingRight: pr,
    paddingFront: pf,
    paddingBack: pb,
    gridUnitMm,
  } = params;
  const totalW = params.width * gridUnitMm + pl + pr;
  const totalD = params.depth * gridUnitMm + pf + pb;
  // Match the body's cap (baseplateGenerator) so the shared corner has one
  // radius, then clamp to the rail's own short side to avoid degenerate arcs.
  const minPadding = Math.min(Math.min(pl, pr), Math.min(pf, pb));
  const bodyMax = Math.min(gridUnitMm / 2 + minPadding, Math.min(totalW, totalD) / 2 - 0.1);
  const railMax = Math.min(railW, railD) / 2 - 0.1;
  const maxRadius = Math.max(0, Math.min(bodyMax, railMax));
  const resolved = resolveCornerRadii(params, maxRadius);
  const owned = new Set(margin.ownedCorners);
  return {
    tl: owned.has('tl') ? resolved.tl : 0,
    tr: owned.has('tr') ? resolved.tr : 0,
    bl: owned.has('bl') ? resolved.bl : 0,
    br: owned.has('br') ? resolved.br : 0,
  };
}

/** Build a detached margin rail BREP solid, centered at the origin. */
function buildMarginSolid(
  params: ResolvedBaseplateParams,
  margin: MarginPiece,
  forExport: boolean = true
): Shape3D {
  const { railW, railD, totalHeight } = railDims(params, margin);
  const cornerRadii = railCornerRadii(params, margin, railW, railD);

  // Centered slab profile (rail-local frame). buildSlabProfile with no `edges`
  // rounds only the non-zero (owned) corners and falls back to a plain
  // rectangle when nothing rounds; seam corners stay square either way.
  const profile = buildSlabProfile(railW, railD, cornerRadii);
  let rail: Shape3D = (
    profile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
  ).extrude(-totalHeight);

  if (params.overTile) {
    const margins: SideMargins = {
      left: params.paddingLeft,
      right: params.paddingRight,
      front: params.paddingFront,
      back: params.paddingBack,
    };
    const throughCut = !params.magnetHoles;
    const halfW = railW / 2;
    const halfD = railD / 2;
    const { x: ox, y: oy } = margin.worldOffsetMm;
    const pockets: Shape3D[] = [];
    for (const cell of frameCells(
      params.width,
      params.depth,
      margins,
      params.gridUnitMm,
      MIN_PRINTABLE_TILE_MM,
      params.overTileHalfGrid,
      params.overTileHalfGridSolidLeftover
    )) {
      // Keep only the frame cells whose center lands inside this rail's
      // footprint. Corner cells fall inside the long rail that spans them.
      const lx = cell.centerX - ox;
      const ly = cell.centerY - oy;
      if (Math.abs(lx) > halfW + 1e-6 || Math.abs(ly) > halfD + 1e-6) continue;
      const cellW = cell.widthUnits * params.gridUnitMm;
      const cellD = cell.depthUnits * params.gridUnitMm;
      const pocket = getPocketTemplate(cellW, cellD, forExport, throughCut);
      pockets.push(translate(pocket, [lx, ly, 0]));
      pocket.delete();
    }
    if (pockets.length > 0) rail = cutInBatches(rail, pockets);
  }

  // Opt-in connector (#2414): carve the seam groove into a LONG rail's inner
  // face to receive the body's tongue. Long rails are exactly the seam sides
  // (splitPlanner marks the matching body edge `marginSeam`); short rails stay
  // friction-fit. Only dovetail/puzzle styles carry a seam.
  const seamStyleOk = params.connectorStyle === 'dovetail' || params.connectorStyle === 'puzzle';
  if (params.detachMarginConnector === true && seamStyleOk && margin.role === 'long') {
    const groove = buildMarginSeamGroove(
      margin.side,
      railW,
      railD,
      totalHeight,
      params.connectorStyle,
      params.connectorFitOffset ?? 0,
      params.nozzleSizeMm
    );
    rail = cutInBatches(rail, [groove]);
  }

  // Shift up so Z=0 is the bottom face, matching the body's final transform.
  const lifted = translate(rail, [0, 0, totalHeight]);
  rail.delete();
  return lifted;
}

/** Mesh a margin rail for the live preview / split export. */
export function generateMargin(
  params: ResolvedBaseplateParams,
  margin: MarginPiece,
  forExport: boolean
): MeshData {
  const rail = buildMarginSolid(params, margin, forExport);
  try {
    const { railW, railD } = railDims(params, margin);
    const maxDimension = Math.max(railW, railD);
    const tolerance = forExport ? 0.01 : Math.min(0.4, Math.max(0.15, maxDimension / 600));
    const angularTolerance = forExport ? 5 : 12;
    const meshResult = mesh(rail, { tolerance, angularTolerance });
    const edgeVerts: ArrayLike<number> =
      getKernelCapabilities().tessellationModel === 'build-time'
        ? creaseEdges(meshResult)
        : meshEdges(rail, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines;
    return toIndexedMeshData(meshResult, edgeVerts);
  } finally {
    rail.delete();
  }
}

/** Export a margin rail as STL or STEP. */
export async function exportMargin(
  params: ResolvedBaseplateParams,
  margin: MarginPiece,
  format: ExportFormat,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const rail = buildMarginSolid(params, margin, false);
  try {
    const name = `baseplate_${margin.id}_${Math.round(margin.lengthMm)}x${Math.round(margin.bandThicknessMm)}mm`;
    if (format === 'step') {
      const blob = unwrap(exportSTEP(rail));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const meshResult = mesh(rail, {
      tolerance: tolerance ?? 0.02,
      angularTolerance: angularTolerance ?? 6,
    });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    rail.delete();
  }
}
