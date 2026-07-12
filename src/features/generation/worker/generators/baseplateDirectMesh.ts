/**
 * Direct mesh generation for Gridfinity baseplates.
 *
 * Generates baseplate geometry procedurally by computing vertices and triangles
 * mathematically, without BREP boolean operations. This avoids the 2-15+ second
 * latency of the brepjs pipeline (solid modeling, boolean fuse/cut, tessellation).
 *
 * The output is geometrically equivalent to the simplified BREP version
 * (buildSimplifiedPocketCutter) — a waffle-grid slab with tapered pockets,
 * optional magnet holes, and a rounded outer perimeter.
 *
 * Coordinate system (matches baseplateGenerator.ts):
 * - Z=0: bottom face of baseplate
 * - Z=totalHeight: top face / pocket opening
 * - Without magnets: pockets through-cut (no floor), unless the solidFloor
 *   option leaves a plain floor of its own thickness below the sockets
 * - With magnets: slab is taller by (MAGNET_FLOOR + magnetDepth); pockets
 *   stop at SOCKET_HEIGHT depth, leaving a solid continuous floor. Magnet
 *   holes are blind cylindrical pockets cut downward from the pocket floor
 *   into the solid floor, leaving a thin retaining floor (MAGNET_FLOOR)
 *   at the bottom. Magnets are dropped in from the pocket side
 * - Grid centered at XY origin; slab offset by padding
 *
 * The orchestrator wires together pure-geometry helpers from sibling modules:
 * shapes, builder, walls, faces, magnets, connectors.
 */

import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { CONSTRAINTS } from '@/core/constants';
import { resolveCornerRadii } from './generatorConstants';
import { creaseEdges } from './utils';
import type { MeshData } from '../../bridge/types';
import {
  SOCKET_HEIGHT,
  forEachCell,
  frameCells,
  marginPocketDepthMm,
  checkCancelled,
  baseplateFloorDepth,
  MIN_PRINTABLE_TILE_MM,
  NUB_DIAMETER,
  NUB_DEPTH,
  HOLE_DIAMETER,
  HOLE_DEPTH,
  computeConnectorPositions,
} from './generatorTypes';
import type { ProgressFn, CellInfo, ForEachCellOptions, SideMargins } from './generatorTypes';
import { MeshBuilder, CORNER_SEGMENTS } from './directMeshBuilder';
import { roundedRectPointsSelective } from './directMeshShapes';
import { addPocketWalls, addOuterWalls } from './directMeshWalls';
import { addPlateFace, addSolidBottomFace } from './directMeshFaces';
import { addMagnetHoleAt } from './directMeshMagnets';
import { magnetPositionsForCell } from './baseplateMagnets';
import { addConnectorNub, addConnectorHole } from './directMeshConnectors';

/**
 * Generate baseplate mesh data procedurally without BREP boolean operations.
 *
 * Produces a waffle-grid slab with tapered pockets, optional magnet holes in a
 * solid floor, and a rounded outer perimeter. Targets <50ms for any grid size.
 */
export function generateBaseplateDirect(
  params: ResolvedBaseplateParams,
  onProgress: ProgressFn,
  signal?: AbortSignal
): MeshData {
  // Guard against NaN/negative/infinite values that would produce degenerate geometry
  if (
    !Number.isFinite(params.width) ||
    params.width <= 0 ||
    !Number.isFinite(params.depth) ||
    params.depth <= 0
  ) {
    throw new Error(`Invalid baseplate dimensions: ${params.width}x${params.depth}`);
  }
  if (params.width > CONSTRAINTS.GRID_MAX || params.depth > CONSTRAINTS.GRID_MAX) {
    throw new Error(
      `Baseplate dimensions ${params.width}x${params.depth} exceed maximum ${CONSTRAINTS.GRID_MAX}`
    );
  }

  onProgress('base', 0);
  checkCancelled(signal);

  const {
    width,
    depth,
    gridUnitMm,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    magnetAnchor,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges,
    connectorNubs,
    overTile,
    overTileHalfGrid,
    overTileHalfGridSolidLeftover,
  } = params;

  const mb = new MeshBuilder();

  // Slab dimensions — taller when a floor is left under the pockets. Magnets
  // require one; the standalone solidFloor option adds one without magnet holes.
  const floorDepth = baseplateFloorDepth(params);
  const hasFloor = floorDepth > 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const resolved = resolveCornerRadii(params, maxRadius);
  const cornerR = Math.min(Math.max(resolved.tl, resolved.tr, resolved.bl, resolved.br), maxRadius);

  // Slab center offset for asymmetric padding (grid stays at origin)
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;

  const cellOpts: ForEachCellOptions = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };

  // Collect all cells. Over-tile adds clipped pockets in the padding margins
  // (same frameCells layout as the BREP build). The solid padding ring then
  // fills only the band beyond each side's pockets, so tiled pockets — including
  // 21mm half-grid cells — are never capped; a fully tiled side contributes no
  // ring, while a sub-threshold sliver keeps its solid fill (#2380).
  const cells: CellInfo[] = [];
  forEachCell(width, depth, (cell) => cells.push(cell), cellOpts);
  // Plain solid padding fills the whole margin ring (no pockets); over-tile
  // restricts the ring to the un-pocketed outer band via per-side pocket depths.
  let drawRing = !overTile;
  let pocketDepths: { left: number; right: number; front: number; back: number } | undefined;
  if (overTile) {
    const margins: SideMargins = {
      left: paddingLeft,
      right: paddingRight,
      front: paddingFront,
      back: paddingBack,
    };
    cells.push(
      ...frameCells(
        width,
        depth,
        margins,
        gridUnitMm,
        MIN_PRINTABLE_TILE_MM,
        overTileHalfGrid,
        overTileHalfGridSolidLeftover
      )
    );
    const depthOf = (p: number): number =>
      marginPocketDepthMm(
        p,
        gridUnitMm,
        MIN_PRINTABLE_TILE_MM,
        overTileHalfGrid === true,
        overTileHalfGridSolidLeftover === true
      );
    pocketDepths = {
      left: depthOf(paddingLeft),
      right: depthOf(paddingRight),
      front: depthOf(paddingFront),
      back: depthOf(paddingBack),
    };
    // Ring is needed only where a side leaves a solid (un-pocketed) band.
    drawRing =
      paddingLeft - pocketDepths.left > 1e-6 ||
      paddingRight - pocketDepths.right > 1e-6 ||
      paddingFront - pocketDepths.front > 1e-6 ||
      paddingBack - pocketDepths.back > 1e-6;
  }

  onProgress('base', 0.1);
  checkCancelled(signal);

  const outerPts = roundedRectPointsSelective(totalW, totalD, cornerR, CORNER_SEGMENTS, edges);

  addOuterWalls(mb, outerPts, slabOffsetX, slabOffsetY, totalHeight);

  onProgress('base', 0.2);
  checkCancelled(signal);

  for (const cell of cells) {
    const cellW_mm = cell.widthUnits * gridUnitMm;
    const cellD_mm = cell.depthUnits * gridUnitMm;
    addPocketWalls(mb, cell.centerX, cell.centerY, cellW_mm, cellD_mm, totalHeight, floorDepth);
  }

  onProgress('base', 0.5);
  checkCancelled(signal);

  addPlateFace(
    mb,
    outerPts,
    slabOffsetX,
    slabOffsetY,
    gridUnitMm,
    width,
    depth,
    cells,
    totalHeight,
    true,
    drawRing,
    pocketDepths
  );

  onProgress('base', 0.6);
  checkCancelled(signal);

  // Bottom: floored variants (magnets OR the standalone solidFloor option) get a
  // fully-closed slab bottom (the floor under the pockets is solid, so a single
  // fan from the slab center is correct). Through-cut variants mirror the top
  // lattice instead — the slab is solid only between pockets, and a flat bottom
  // face there closes the slab band visible from below.
  if (hasFloor) {
    addSolidBottomFace(mb, outerPts, slabOffsetX, slabOffsetY);
  } else {
    addPlateFace(
      mb,
      outerPts,
      slabOffsetX,
      slabOffsetY,
      gridUnitMm,
      width,
      depth,
      cells,
      0,
      false,
      drawRing,
      pocketDepths
    );
  }

  onProgress('base', 0.7);
  checkCancelled(signal);

  if (magnetHoles) {
    const magnetRadius = magnetDiameter / 2;
    // Nominal grid: full cells get the standard 4 corners (fractional nominal
    // cells are skipped, matching the BREP build). `cells` also holds the frame
    // tiles, but they're <1u so the guard skips them here — they're magnetized
    // by the over-tile pass below.
    for (const cell of cells) {
      if (cell.widthUnits < 1 || cell.depthUnits < 1) continue;
      // Shared placement (wall-distance clamp) — identical to the BREP plate,
      // bin base, and lid so the draft preview and all mating surfaces agree.
      for (const [x, y] of magnetPositionsForCell(
        cell,
        magnetRadius,
        gridUnitMm,
        gridUnitMm,
        magnetAnchor
      )) {
        addMagnetHoleAt(mb, x, y, magnetRadius, floorDepth, magnetDepth);
      }
    }
    // Over-tile margin tiles: the corner magnets that fit, else a single
    // centered magnet — mirrors buildPartialCellMagnetHoles in the BREP build so
    // the draft preview matches the exported plate.
    if (overTile) {
      const margins: SideMargins = {
        left: paddingLeft,
        right: paddingRight,
        front: paddingFront,
        back: paddingBack,
      };
      for (const cell of frameCells(
        width,
        depth,
        margins,
        gridUnitMm,
        MIN_PRINTABLE_TILE_MM,
        overTileHalfGrid,
        overTileHalfGridSolidLeftover
      )) {
        for (const [x, y] of magnetPositionsForCell(
          cell,
          magnetRadius,
          gridUnitMm,
          gridUnitMm,
          magnetAnchor
        )) {
          addMagnetHoleAt(mb, x, y, magnetRadius, floorDepth, magnetDepth);
        }
      }
    }
  }

  if (connectorNubs && edges) {
    const nubRadius = NUB_DIAMETER / 2;
    const holeRadius = HOLE_DIAMETER / 2;
    const connPositions = computeConnectorPositions(
      width,
      depth,
      gridUnitMm,
      totalHeight,
      totalW,
      totalD,
      slabOffsetX,
      slabOffsetY,
      edges,
      params.invertDovetails,
      fractionalEdgeX,
      fractionalEdgeY
    );
    for (const pos of connPositions) {
      if (pos.isMale) {
        addConnectorNub(mb, pos.cx, pos.cy, pos.cz, pos.nx, pos.ny, 0, nubRadius, NUB_DEPTH);
      } else {
        addConnectorHole(mb, pos.cx, pos.cy, pos.cz, pos.nx, pos.ny, 0, holeRadius, HOLE_DEPTH);
      }
    }
  }

  onProgress('base', 0.9);
  checkCancelled(signal);

  const built = mb.build();
  // Dihedral creases give the instant draft the same edge overlay as the BREP
  // render; the builder omits edges. Flat-shaded verts are welded by position.
  const result: MeshData = {
    ...built,
    edgeVertices: creaseEdges({ vertices: built.vertices, triangles: built.indices }),
  };
  onProgress('base', 1);

  return result;
}
