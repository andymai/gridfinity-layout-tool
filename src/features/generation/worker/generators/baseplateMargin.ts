/**
 * Detached margin rail geometry.
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
 * stay square. Rails carry no magnet holes or lightweight floor. An eco plate
 * cuts each rail with the reliefs the integral plate cuts in its footprint.
 */

import {
  mesh,
  meshEdges,
  translate,
  fuseAll,
  getKernelCapabilities,
  exportSTEP,
  unwrap,
} from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { ResolvedBaseplateParams, MarginCorner, MarginPiece } from '@/shared/types/bin';
import { isMarginSeamStyle, marginSeamInverted } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import {
  plateProfileHeightMm,
  baseplateFloorDepth,
  frameCells,
  toIndexedMeshData,
  MIN_PRINTABLE_TILE_MM,
  resolveCornerRadii,
} from './generatorTypes';
import type { CellInfo, SideMargins } from './generatorTypes';
import { buildEcoReliefCutters, buildSlabProfile, cutAboveZ } from './baseplateSlab';
import { buildMarginSeamGroove, buildMarginSeamTongue } from './baseplateConnectors';
import { railSeamFrame } from './connectorShapes';
import { computeCellBoundariesMm, computeCellCentersMm } from './cellDecomposition';
import {
  ecoJointCutouts,
  ecoSeamKeepOuts,
  type EcoJointCutout,
} from '@/shared/generation/ecoPlate';
import { cutInBatches } from './baseplateBatchOps';
import { getPocketTemplate } from './baseplatePockets';
import { buildBaseplateSTL } from './baseplateSTL';
import { creaseEdges } from './utils';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import { EXPORT_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';

interface RailDims {
  readonly railW: number;
  readonly railD: number;
  readonly totalHeight: number;
}

/** Rail footprint in its own (origin-centered) frame and slab height. */
function railDims(params: ResolvedBaseplateParams, margin: MarginPiece): RailDims {
  const horizontal = margin.side === 'front' || margin.side === 'back';
  // Via the shared derivation, never restated here: a rail and the body it butts
  // against must be the same thickness or the assembled plate is stepped. The
  // local form had already drifted past `solidFloor`, and the mount-down screw
  // pad would have compounded it.
  const floorDepth = baseplateFloorDepth(params);
  return {
    railW: horizontal ? margin.lengthMm : margin.bandThicknessMm,
    railD: horizontal ? margin.bandThicknessMm : margin.lengthMm,
    totalHeight: plateProfileHeightMm(params.lowProfileBase) + floorDepth,
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
  // radius, then fit it to the rail's own edges.
  const minPadding = Math.min(Math.min(pl, pr), Math.min(pf, pb));
  const bodyMax = Math.min(gridUnitMm / 2 + minPadding, Math.min(totalW, totalD) / 2 - 0.1);
  const resolved = resolveCornerRadii(params, Math.max(0, bodyMax));
  const owned = new Set(margin.ownedCorners);
  // An arc may take an edge's whole length when the corner at the other end of
  // that edge is square, which a rail end always is at its seam. Two rounded
  // corners on one edge share it. The 0.1 mm keeps a real edge between arcs.
  const along = (length: number, other: MarginCorner): number =>
    (owned.has(other) ? length / 2 : length) - 0.1;
  const fit = (corner: MarginCorner, wOther: MarginCorner, dOther: MarginCorner): number =>
    owned.has(corner)
      ? Math.max(0, Math.min(resolved[corner], along(railW, wOther), along(railD, dOther)))
      : 0;
  return {
    tl: fit('tl', 'tr', 'bl'),
    tr: fit('tr', 'tl', 'br'),
    bl: fit('bl', 'br', 'tl'),
    br: fit('br', 'bl', 'tr'),
  };
}

/**
 * Rail-local positions of the seam connectors along the running axis, or none
 * when the seam has no connector. Recomputed from the same `cellUnits`/
 * `fractionalEdge` the body used, then shifted by `centerOffsetMm` onto the
 * corner-extended rail.
 */
function marginSeamPositions(params: ResolvedBaseplateParams, margin: MarginPiece): number[] {
  if (params.detachMarginConnector !== true || !isMarginSeamStyle(params.connectorStyle)) {
    return [];
  }
  const seam = margin.seamConnector;
  // Keyed seams sit on cell BOUNDARIES (a two-cell junction, which is the foot
  // layout the seated key is relieved for); tongued seams sit on cell CENTERS.
  // Mirrors the body side in `buildConnectors`, including the empty case: a
  // 1-cell body piece has no boundary, so a keyed rail stays flat rather than
  // growing a lone groove at its center with nothing to mate.
  const keyed = params.connectorStyle === 'dovetailKey';
  // `cellUnits` counts cells along the RAIL's running axis, so it must be
  // converted with that axis's pitch: X for a front/back rail, Y for a
  // left/right one. Using the X pitch for both put a left/right rail's grooves
  // at the wrong spots on a non-square grid, where they no longer met the body's
  // (which uses the real Y pitch).
  const runningPitch =
    margin.side === 'front' || margin.side === 'back'
      ? params.gridUnitMm
      : (params.gridUnitMmY ?? params.gridUnitMm);
  const anchors = !seam
    ? []
    : keyed
      ? computeCellBoundariesMm(seam.cellUnits, runningPitch, seam.fractionalEdge)
      : computeCellCentersMm(seam.cellUnits, runningPitch, seam.fractionalEdge);
  const centerOffset = seam?.centerOffsetMm ?? 0;
  const fallback = keyed ? [] : [0];
  return (anchors.length > 0 ? anchors : fallback).map((b) => b + centerOffset);
}

/**
 * The eco reliefs the integral plate cuts inside this rail's footprint, in the
 * rail's frame. Planned over the whole plate, so a relief on an edge the rail
 * shares with the body, a neighbouring rail or another segment has the size the
 * integral plate gives it, and each piece cuts its own part of it. A rail
 * carries no holes, so only its seam connectors keep reliefs out.
 */
function railEcoSlots(
  params: ResolvedBaseplateParams,
  margin: MarginPiece,
  frame: readonly CellInfo[],
  seamPositions: readonly number[],
  railW: number,
  railD: number
): EcoJointCutout[] {
  const { x: ox, y: oy } = margin.worldOffsetMm;
  const { seamPos } = railSeamFrame(margin.side, railW, railD);
  const horizontal = margin.side === 'front' || margin.side === 'back';
  const sites = seamPositions.map((pos) =>
    horizontal ? { x: ox + pos, y: oy + seamPos } : { x: ox + seamPos, y: oy + pos }
  );
  // A relief that only meets a rail face would leave a coplanar sliver cut.
  const overlaps = (center: number, size: number, half: number): boolean =>
    Math.min(center + size / 2, half) - Math.max(center - size / 2, -half) > 1e-3;
  return ecoJointCutouts(params, frame, ecoSeamKeepOuts(sites))
    .map((slot) => ({ ...slot, x: slot.x - ox, y: slot.y - oy }))
    .filter(
      (slot) => overlaps(slot.x, slot.width, railW / 2) && overlaps(slot.y, slot.depth, railD / 2)
    );
}

/** Build a detached margin rail BREP solid, centered at the origin. */
function buildMarginSolid(params: ResolvedBaseplateParams, margin: MarginPiece): Shape3D {
  const { railW, railD, totalHeight } = railDims(params, margin);
  const floorDepth = baseplateFloorDepth(params);
  const cornerRadii = railCornerRadii(params, margin, railW, railD);

  // Centered slab profile (rail-local frame). buildSlabProfile with no `edges`
  // rounds only the non-zero (owned) corners and falls back to a plain
  // rectangle when nothing rounds; seam corners stay square either way.
  const profile = buildSlabProfile(railW, railD, cornerRadii);
  let rail: Shape3D = (
    profile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
  ).extrude(-totalHeight);

  const { x: ox, y: oy } = margin.worldOffsetMm;
  const margins: SideMargins = {
    left: params.paddingLeft,
    right: params.paddingRight,
    front: params.paddingFront,
    back: params.paddingBack,
  };
  // Every margin cell of the plate, not only this rail's: the eco plan sizes a
  // relief on an edge two cells share from both of them.
  // Both pitches, as the body frames them: the eco plan sizes cell depths with
  // the Y pitch, so a frame built on X alone misplaces a non-square grid.
  const pitch = { x: params.gridUnitMm, y: params.gridUnitMmY ?? params.gridUnitMm };
  const frame: CellInfo[] = params.overTile
    ? frameCells(
        params.width,
        params.depth,
        margins,
        pitch,
        MIN_PRINTABLE_TILE_MM,
        params.overTileHalfGrid,
        params.overTileHalfGridSolidLeftover,
        params
      )
    : [];

  if (frame.length > 0) {
    const throughCut = floorDepth === 0;
    const halfW = railW / 2;
    const halfD = railD / 2;
    const pockets: Shape3D[] = [];
    for (const cell of frame) {
      // Keep only the frame cells whose center lands inside this rail's
      // footprint. Corner cells fall inside the long rail that spans them.
      const lx = cell.centerX - ox;
      const ly = cell.centerY - oy;
      if (Math.abs(lx) > halfW + 1e-6 || Math.abs(ly) > halfD + 1e-6) continue;
      const cellW = cell.widthUnits * pitch.x;
      const cellD = cell.depthUnits * pitch.y;
      const pocket = getPocketTemplate(
        cellW,
        cellD,
        throughCut,
        floorDepth,
        plateProfileHeightMm(params.lowProfileBase)
      );
      pockets.push(translate(pocket, [lx, ly, 0]));
      pocket.delete();
    }
    if (pockets.length > 0) rail = cutInBatches(rail, pockets);
  }

  const seamPositions = marginSeamPositions(params, margin);

  if (params.ecoPlate === true) {
    const slots = railEcoSlots(params, margin, frame, seamPositions, railW, railD);
    rail = cutInBatches(rail, buildEcoReliefCutters(slots, totalHeight));
  }

  // Opt-in connector: carve seam grooves into the rail's inner face to receive
  // the body's tongues — or, under `dovetailKey`, one lobe of the seated key that
  // also engages the body's own groove (splitPlanner marks the matching body edge
  // `marginSeam`). An inverted seam grows the tongues here instead, into grooves
  // the body cuts.
  if (seamPositions.length > 0 && marginSeamInverted(params)) {
    const tongues = seamPositions.map((pos) =>
      buildMarginSeamTongue(params, margin, railW, railD, totalHeight, pos)
    );
    const fused = unwrap(fuseAll([rail, ...tongues] as ValidSolid[]));
    rail.delete();
    for (const t of tongues) t.delete();
    rail = fused;
  } else if (seamPositions.length > 0) {
    const grooves = seamPositions.map((pos) =>
      buildMarginSeamGroove(
        margin.side,
        railW,
        railD,
        totalHeight,
        params.connectorStyle,
        params.connectorFitOffset ?? 0,
        params.nozzleSizeMm,
        pos
      )
    );
    rail = cutInBatches(rail, grooves);
  }

  // A rail never stacks, but it butts against plates that did, so it takes
  // the same trim to stay flush with them.
  const seamTrim = params.stackSeamTrimMm ?? 0;
  if (seamTrim > 0) {
    const untrimmed = rail;
    rail = cutAboveZ(untrimmed, -seamTrim);
    untrimmed.delete();
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
  const rail = buildMarginSolid(params, margin);
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
  const rail = buildMarginSolid(params, margin);
  try {
    const name = `baseplate_${margin.id}_${Math.round(margin.lengthMm)}x${Math.round(margin.bandThicknessMm)}mm`;
    if (format === 'step') {
      const blob = unwrap(exportSTEP(rail));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const meshResult = mesh(rail, {
      tolerance: tolerance ?? 0.02,
      angularTolerance: angularTolerance ?? EXPORT_ANGULAR_TOLERANCE_RAD,
    });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    rail.delete();
  }
}
