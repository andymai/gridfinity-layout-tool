/**
 * Baseplate geometry generation for Gridfinity baseplates.
 *
 * Builds a baseplate as a solid slab with pockets cut from the top surface.
 * Each pocket receives a bin's tapered socket profile. The pocket shape is
 * the bin socket profile at full grid size (no clearance reduction), so that
 * bin sockets (which are reduced by CLEARANCE) fit with the intended gap.
 *
 * Without magnets: slab height = SOCKET_HEIGHT (5mm). Pockets are through-cut.
 *
 * With magnets (matching Gridfinity spec): slab height = SOCKET_HEIGHT +
 * MAGNET_FLOOR + magnetDepth. Pockets cut to SOCKET_HEIGHT depth only,
 * leaving a solid continuous floor under each pocket. Magnet holes are blind
 * cylindrical pockets cut downward from the pocket floor into this solid
 * floor, leaving a thin retaining floor (MAGNET_FLOOR = 0.5mm) at the
 * bottom. Magnets are dropped in from the pocket side and held by gravity.
 *
 * Coordinate system (after final Z-shift):
 * - Z=0: bottom face of baseplate (solid)
 * - Z=totalHeight: top face (bin interface), pockets open here
 * - Magnet holes open at Z=floorDepth (pocket floor) down to Z=MAGNET_FLOOR
 */

import {
  drawRoundedRectangle,
  drawRectangle,
  cylinder,
  draw,
  unwrap,
  cutAll,
  intersect,
  clone,
  translate,
  fuseAll,
  mesh,
  exportSTEP,
  booleanPipeline,
  isOk,
} from 'brepjs';
import type { Shape3D, ValidSolid, Sketch, Drawing, BooleanPipelineStep } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import {
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_TAPER_WIDTH,
  CLEARANCE,
  forEachCell,
  toIndexedMeshData,
  checkCancelled,
  sketch,
  PLATE_CORNER_RADIUS,
  MAGNET_FLOOR,
  MAGNET_OFFSETS,
  INSET_BOT,
  pocketCornerRadius,
  resolveCornerRadii,
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
  COPLANAR_MARGIN,
  COPLANAR_OVERLAP,
} from './generatorTypes';
import type { ProgressFn, ForEachCellOptions } from './generatorTypes';
import type { CacheStats } from './lruCache';
import { LRUCache } from './lruCache';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { buildLightweightFloorCutters } from './lightweightFloorCutter';
import { repairMeshWinding } from '@/shared/generation/repairMeshWinding';
import { CONSTRAINTS } from '@/core/constants';

// LRU cache for pocket templates keyed by cell size + forExport + floorDepth.
// Build one loft per unique cell size, then clone+translate for each grid position.

const disposeShape = (_key: string, shape: Shape3D): void => {
  shape.delete();
};

const pocketTemplateCache = new LRUCache<Shape3D>('baseplate-pocket-template', 48, disposeShape);

// Caches the fully tessellated mesh data (vertices, normals, indices, edges)
// keyed by generation params. Skips BREP booleans + tessellation entirely on
// cache hit — the most expensive operations in the pipeline.

const meshResultCache = new LRUCache<MeshData>('baseplate-mesh-result', 32);

// Caches the slab-with-pockets BREP solid BEFORE magnet holes and connectors
// are applied. This is the most expensive boolean step. When only magnet or
// connector params change, we skip pocket cuts and resume from this cached solid.

const slabWithPocketsCache = new LRUCache<Shape3D>('baseplate-slab-with-pockets', 16, disposeShape);

function pocketCacheKey(
  cellW: number,
  cellD: number,
  forExport: boolean,
  throughCut: boolean
): string {
  return buildCacheKey('v1', quantize(cellW), quantize(cellD), forExport, throughCut);
}
/** Insets at each Z breakpoint — same taper profile as bin socket but at full cell size */
const INSET_TOP = 0;
const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm

function pocketSection(
  cellW_mm: number,
  cellD_mm: number,
  cornerR: number,
  z: number,
  inset: number
): Sketch {
  const w = cellW_mm - 2 * inset;
  const d = cellD_mm - 2 * inset;
  const r = Math.max(cornerR - inset, 0.1);
  return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
}

/**
 * Build a single pocket cutter at the origin using multi-section loft.
 *
 * The pocket matches the bin's socket taper profile but at full grid size
 * (no clearance reduction). The bin socket (which IS reduced by CLEARANCE)
 * fits into this pocket with CLEARANCE/2 gap on each side.
 *
 * Profile sections (same Z breakpoints as bin socket):
 *   Z=+1:    extension above block (ensures clean boolean cut)
 *   Z=0:     full cell size (top opening)
 *   Z=-0.25: same as top (vertical clearance step)
 *   Z=-2.4:  inset by taper amount (end of big taper)
 *   Z=-4.2:  same inset (vertical wall section)
 *   Z=-5.0:  max inset (bottom, smallest cross-section)
 *
 * When throughCut is true (no magnets), the cutter extends below SOCKET_HEIGHT
 * to cut completely through the slab. When false (magnets enabled), the pocket
 * stops at SOCKET_HEIGHT depth, leaving a solid floor for magnet holes.
 *
 * The cutter extends above Z=0 to avoid coplanar faces with the slab top,
 * which would cause BREP boolean failures.
 */
function buildPocketCutter(cellW_mm: number, cellD_mm: number, throughCut: boolean): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const s = (z: number, inset: number): Sketch =>
    pocketSection(cellW_mm, cellD_mm, cornerR, z, inset);

  const s0 = s(COPLANAR_MARGIN, INSET_TOP);
  const sections = [
    s(0, INSET_TOP),
    s(-(CLEARANCE / 2), INSET_TOP), // -0.25
    s(-SOCKET_BIG_TAPER, INSET_MID), // -2.4
    s(-(SOCKET_BIG_TAPER + (SOCKET_HEIGHT - SOCKET_TAPER_WIDTH)), INSET_MID), // -4.2
    s(-SOCKET_HEIGHT, INSET_BOT), // -5.0
  ];

  if (throughCut) {
    sections.push(s(-SOCKET_HEIGHT - COPLANAR_MARGIN, INSET_BOT));
  }

  return s0.loftWith(sections, { ruled: true });
}

/**
 * Simplified 2-section pocket cutter for preview rendering.
 * Fewer triangles, visually similar to the full 5-section version.
 * Extends above Z=0 to avoid coplanar boolean issues.
 */
function buildSimplifiedPocketCutter(
  cellW_mm: number,
  cellD_mm: number,
  throughCut: boolean
): Shape3D {
  const cornerR = pocketCornerRadius(cellW_mm, cellD_mm);
  const s = (z: number, inset: number): Sketch =>
    pocketSection(cellW_mm, cellD_mm, cornerR, z, inset);

  const s0 = s(COPLANAR_MARGIN, INSET_TOP);
  const sections = [s(-SOCKET_HEIGHT, INSET_BOT)];
  if (throughCut) {
    sections.push(s(-SOCKET_HEIGHT - COPLANAR_MARGIN, INSET_BOT));
  }

  return s0.loftWith(sections, { ruled: true });
}

/**
 * Get or build a pocket template for the given cell dimensions.
 * Uses an LRU cache keyed on cell size + quality mode + throughCut.
 * Returns a clone of the cached template (safe for translate).
 */
function getPocketTemplate(
  cellW_mm: number,
  cellD_mm: number,
  forExport: boolean,
  throughCut: boolean
): Shape3D {
  const key = pocketCacheKey(cellW_mm, cellD_mm, forExport, throughCut);
  const cached = pocketTemplateCache.get(key);
  if (cached !== undefined) {
    return unwrap(clone(cached));
  }
  const template = forExport
    ? buildPocketCutter(cellW_mm, cellD_mm, throughCut)
    : buildSimplifiedPocketCutter(cellW_mm, cellD_mm, throughCut);
  pocketTemplateCache.set(key, template);
  return unwrap(clone(template));
}
/**
 * Build magnet hole cutters that open from the pocket floor (top side).
 *
 * Each magnet hole is a blind cylindrical pocket cut downward from the pocket
 * floor into the solid floor below. The hole extends down by magnetDepth,
 * leaving a thin retaining floor (MAGNET_FLOOR = 0.5mm) at the bottom.
 * Magnets are dropped in from the pocket side and held by gravity.
 *
 * Builds one template cylinder and clones it for each hole position.
 * Only full-size (1.0+ unit) cells get magnet holes — the Gridfinity spec
 * doesn't define magnet positions for fractional cells.
 */
function buildMagnetHoles(
  gridW: number,
  gridD: number,
  magnetRadius: number,
  magnetDepth: number,
  cellOpts?: ForEachCellOptions
): Shape3D[] {
  // Cutter starts above the pocket floor (COPLANAR_MARGIN avoids coplanar with
  // pocket bottom at Z=-SOCKET_HEIGHT) and cuts downward by magnetDepth.
  // This leaves MAGNET_FLOOR of solid material at the bottom of each magnet hole.
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
/**
 * Build discrete dovetail connectors at grid cell boundary intersections along
 * join edges. Each connector is a small trapezoidal prism — the classic dovetail
 * fan shape visible from the top: narrower at the wall (BASE_HALF), wider at
 * the protruding tip (TIP_HALF).
 *
 *   Top view (X-Y) of one connector on a left edge:
 *
 *     wall
 *      |  A ──── B         Y = bPos + BASE_HALF (wall) / + TIP_HALF (tip)
 *      |  |  dt  |
 *      |  D ──── C         Y = bPos - BASE_HALF (wall) / - TIP_HALF (tip)
 *      |  ← P →
 *
 * The dovetail taper is in the X-Y plane, so pieces drop in from above (Z)
 * without interference. Once seated, the wider tip prevents horizontal pull-out.
 *
 * Convention: left/front = tongue (male, fused), right/back = groove (female, cut).
 *
 * All profiles are drawn on the XY plane (normal=+Z) and extruded downward,
 * matching the pre-Z-shift coordinate system (slab top at Z=0, bottom at Z=-totalHeight).
 */
function buildConnectors(
  params: BaseplateParams,
  totalHeight: number,
  totalW: number,
  totalD: number,
  slabOffsetX: number,
  slabOffsetY: number
): { nubs: Shape3D[]; holes: Shape3D[] } {
  const { edges, connectorNubs, invertDovetails } = params;
  const tongues: Shape3D[] = [];
  const grooves: Shape3D[] = [];

  if (!connectorNubs || !edges) return { nubs: tongues, holes: grooves };

  const invert = !!invertDovetails;

  const halfW = totalW / 2;
  const halfD = totalD / 2;
  const gridUnit = params.gridUnitMm;
  const P = TONGUE_PROTRUSION;
  const bW = TONGUE_BASE_HALF; // half-width at wall (narrow)
  const tW = TONGUE_TIP_HALF; // half-width at tip (wide)
  const cl = TONGUE_CLEARANCE;
  const ext = COPLANAR_MARGIN;

  type Side = 'left' | 'right' | 'front' | 'back';

  const edgeDefs: ReadonlyArray<{
    side: Side;
    isMale: boolean;
    wallPos: number;
    numBoundaries: number;
    boundaryPos: (k: number) => number;
    protrudeAxis: 'x' | 'y';
    protrudeDir: -1 | 1;
  }> = [
    {
      side: 'left',
      isMale: !invert,
      wallPos: -halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: invert,
      wallPos: halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: !invert,
      wallPos: -halfD + slabOffsetY,
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: invert,
      wallPos: halfD + slabOffsetY,
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
      protrudeAxis: 'y',
      protrudeDir: 1,
    },
  ];

  for (const def of edgeDefs) {
    if (edges[def.side] !== 'join' || def.numBoundaries <= 0) continue;

    // Build an XY point with wall/boundary coords assigned to the correct axis.
    // When protruding along X, wall is on X and boundary is on Y; vice versa for Y.
    const pt =
      def.protrudeAxis === 'x'
        ? (wallCoord: number, bpCoord: number): [number, number] => [wallCoord, bpCoord]
        : (wallCoord: number, bpCoord: number): [number, number] => [bpCoord, wallCoord];

    for (let k = 1; k <= def.numBoundaries; k++) {
      const bp = def.boundaryPos(k); // boundary position on parallel axis
      const w = def.wallPos;
      const d = def.protrudeDir;

      if (def.isMale) {
        // Dovetail tongue: trapezoidal plan view, wider at tip.
        // The base edge is extended COPLANAR_OVERLAP into the slab so the fuse
        // has shared volume rather than a degenerate coplanar interface at the
        // wall face. Coplanar fuses cause OCCT to produce non-manifold topology,
        // which slicers repair as solid infill (issue #1407).
        const profile = draw(pt(w - d * COPLANAR_OVERLAP, bp + bW))
          .lineTo(pt(w + d * P, bp + tW))
          .lineTo(pt(w + d * P, bp - tW))
          .lineTo(pt(w - d * COPLANAR_OVERLAP, bp - bW))
          .close();
        tongues.push(sketch(profile, 'XY', 0).extrude(-totalHeight));
      } else {
        // Dovetail groove: matching shape + clearance, extended beyond wall.
        const gB = bW + cl; // half-width at wall opening (narrow + clearance)
        const gT = tW + cl; // half-width at inner face (wide + clearance)
        const gP = P + cl; // groove depth
        const profile = draw(pt(w + d * ext, bp + gB))
          .lineTo(pt(w - d * gP, bp + gT))
          .lineTo(pt(w - d * gP, bp - gT))
          .lineTo(pt(w + d * ext, bp - gB))
          .close();
        // Extend groove in Z beyond slab faces to avoid coplanar booleans
        grooves.push(
          sketch(profile, 'XY', COPLANAR_MARGIN).extrude(-(totalHeight + 2 * COPLANAR_MARGIN))
        );
      }
    }
  }

  return { nubs: tongues, holes: grooves };
}
/** Segments per rounded corner arc for edge lines */
const EDGE_CORNER_SEGMENTS = 4;

/** Segments per magnet hole circle for edge lines (matches 10° angular tolerance) */
const EDGE_CIRCLE_SEGMENTS = 36;

/**
 * Generate points for a rounded rectangle centered at origin (CCW from +Z).
 * Used for computing edge line contours — matches the same profile as the BREP
 * slab and pocket geometry without requiring BREP edge extraction.
 */
function edgeRoundedRect(
  w: number,
  d: number,
  r: number,
  segments: number
): ReadonlyArray<readonly [number, number]> {
  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  if (effectiveR < 0.01) {
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  }

  const pts: Array<[number, number]> = [];
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI],
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2],
    [hw - effectiveR, hd - effectiveR, 0],
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2],
  ];

  for (const [cx, cy, startAngle] of corners) {
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (i / segments) * (Math.PI / 2);
      pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
    }
  }
  return pts;
}

/**
 * Generate a rounded rectangle with selective corner rounding.
 * Only rounds corners where both adjacent edges are exterior.
 */
function edgeRoundedRectSelective(
  w: number,
  d: number,
  r: number,
  segments: number,
  edges?: BaseplateParams['edges']
): ReadonlyArray<readonly [number, number]> {
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return edgeRoundedRect(w, d, r, segments);
  }

  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  const roundFL = edges.left === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundFR = edges.right === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundBR = edges.right === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;
  const roundBL = edges.left === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;

  const pts: Array<[number, number]> = [];
  const cornerDefs: ReadonlyArray<readonly [number, number, number, boolean]> = [
    [-hw + effectiveR, -hd + effectiveR, Math.PI, roundFL],
    [hw - effectiveR, -hd + effectiveR, (3 * Math.PI) / 2, roundFR],
    [hw - effectiveR, hd - effectiveR, 0, roundBR],
    [-hw + effectiveR, hd - effectiveR, Math.PI / 2, roundBL],
  ];
  const sharp: ReadonlyArray<readonly [number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];

  for (let c = 0; c < 4; c++) {
    const [cx, cy, startAngle, shouldRound] = cornerDefs[c];
    if (shouldRound) {
      for (let i = 0; i <= segments; i++) {
        const angle = startAngle + (i / segments) * (Math.PI / 2);
        pts.push([cx + effectiveR * Math.cos(angle), cy + effectiveR * Math.sin(angle)]);
      }
    } else {
      pts.push([sharp[c][0], sharp[c][1]]);
    }
  }
  return pts;
}

/** Push a closed polygon as line segments into an edge buffer. */
function pushEdgeLoop(
  buf: number[],
  pts: ReadonlyArray<readonly [number, number]>,
  z: number,
  ox: number,
  oy: number
): void {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    buf.push(pts[i][0] + ox, pts[i][1] + oy, z, pts[j][0] + ox, pts[j][1] + oy, z);
  }
}

/**
 * Compute the arc–straight transition points of a rounded rectangle.
 *
 * These are the 8 points (2 per corner) where arc segments meet straight
 * segments — exactly where BREP topology would place vertical edges because
 * the adjacent flat-wall and curved-corner faces meet at a sharp angle.
 *
 * For a sharp (unrounded) corner, only 1 point is returned for that corner.
 */
function roundedRectTransitionPts(w: number, d: number, r: number): Array<[number, number]> {
  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  if (effectiveR < 0.01) {
    // Sharp rectangle — 4 corner points
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ];
  }

  // 8 transition points: arc-start and arc-end for each corner.
  // Listed in CCW order matching edgeRoundedRect traversal.
  return [
    // Bottom-left corner (arc from π to 3π/2)
    [-hw, -hd + effectiveR], // arc start: left wall → arc
    [-hw + effectiveR, -hd], // arc end:   arc → bottom wall
    // Bottom-right corner (arc from 3π/2 to 2π)
    [hw - effectiveR, -hd], // arc start: bottom wall → arc
    [hw, -hd + effectiveR], // arc end:   arc → right wall
    // Top-right corner (arc from 0 to π/2)
    [hw, hd - effectiveR], // arc start: right wall → arc
    [hw - effectiveR, hd], // arc end:   arc → top wall
    // Top-left corner (arc from π/2 to π)
    [-hw + effectiveR, hd], // arc start: top wall → arc
    [-hw, hd - effectiveR], // arc end:   arc → left wall
  ];
}

/**
 * Transition points for a rounded rectangle with selective corner rounding.
 * Returns 1 point per sharp corner, 2 per rounded corner.
 */
function roundedRectTransitionPtsSelective(
  w: number,
  d: number,
  r: number,
  edges?: BaseplateParams['edges']
): Array<[number, number]> {
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return roundedRectTransitionPts(w, d, r);
  }

  const hw = w / 2;
  const hd = d / 2;
  const effectiveR = Math.max(Math.min(r, hw - 0.01, hd - 0.01), 0);

  const roundFL = edges.left === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundFR = edges.right === 'exterior' && edges.front === 'exterior' && effectiveR > 0.01;
  const roundBR = edges.right === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;
  const roundBL = edges.left === 'exterior' && edges.back === 'exterior' && effectiveR > 0.01;

  const pts: Array<[number, number]> = [];

  if (roundFL) {
    pts.push([-hw, -hd + effectiveR], [-hw + effectiveR, -hd]);
  } else {
    pts.push([-hw, -hd]);
  }
  if (roundFR) {
    pts.push([hw - effectiveR, -hd], [hw, -hd + effectiveR]);
  } else {
    pts.push([hw, -hd]);
  }
  if (roundBR) {
    pts.push([hw, hd - effectiveR], [hw - effectiveR, hd]);
  } else {
    pts.push([hw, hd]);
  }
  if (roundBL) {
    pts.push([-hw + effectiveR, hd], [-hw, hd - effectiveR]);
  } else {
    pts.push([-hw, hd]);
  }

  return pts;
}

/**
 * Push vertical edge lines connecting transition points between two Z levels.
 * Each pair of corresponding top/bottom points gets a vertical line segment.
 */
function pushVerticalEdges(
  buf: number[],
  topPts: ReadonlyArray<readonly [number, number]>,
  botPts: ReadonlyArray<readonly [number, number]>,
  zTop: number,
  zBot: number,
  ox: number,
  oy: number
): void {
  // When contours have the same number of points, connect them 1:1
  const n = Math.min(topPts.length, botPts.length);
  for (let i = 0; i < n; i++) {
    buf.push(
      topPts[i][0] + ox,
      topPts[i][1] + oy,
      zTop,
      botPts[i][0] + ox,
      botPts[i][1] + oy,
      zBot
    );
  }
}

/**
 * Compute edge line vertices procedurally from baseplate params.
 *
 * Generates contour loops at face boundaries (outer perimeter, pocket openings,
 * pocket floors, magnet holes) to produce the same visual "sketch look" as BREP
 * topology edges — without the cost of meshEdges().
 */
function computeBaseplateEdgeLines(params: BaseplateParams): Float32Array {
  const {
    width,
    depth,
    gridUnitMm,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges,
  } = params;

  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const cornerR = Math.min(PLATE_CORNER_RADIUS, maxRadius);
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;

  const buf: number[] = [];

  // ── Outer perimeter: horizontal contours + vertical corner edges ──
  const outerPts = edgeRoundedRectSelective(totalW, totalD, cornerR, EDGE_CORNER_SEGMENTS, edges);
  pushEdgeLoop(buf, outerPts, totalHeight, slabOffsetX, slabOffsetY);
  pushEdgeLoop(buf, outerPts, 0, slabOffsetX, slabOffsetY);

  // Vertical edges at outer perimeter corners (wall is not tapered, same XY at top and bottom)
  const outerTransition = roundedRectTransitionPtsSelective(totalW, totalD, cornerR, edges);
  pushVerticalEdges(
    buf,
    outerTransition,
    outerTransition,
    totalHeight,
    0,
    slabOffsetX,
    slabOffsetY
  );

  // ── Pocket openings, floors, and vertical wall edges for each cell ──
  const cellOpts: ForEachCellOptions = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };
  forEachCell(
    width,
    depth,
    (cell) => {
      const cellW = cell.widthUnits * gridUnitMm;
      const cellD = cell.depthUnits * gridUnitMm;
      const cr = pocketCornerRadius(cellW, cellD);

      // Pocket opening at top
      pushEdgeLoop(
        buf,
        edgeRoundedRect(cellW, cellD, cr, EDGE_CORNER_SEGMENTS),
        totalHeight,
        cell.centerX,
        cell.centerY
      );

      // Pocket floor + vertical wall edges
      const botW = cellW - 2 * INSET_BOT;
      const botD = cellD - 2 * INSET_BOT;
      const botR = Math.max(cr - INSET_BOT, 0.1);
      const pocketFloorZ = floorDepth > 0 ? floorDepth : 0;

      if (floorDepth > 0) {
        pushEdgeLoop(
          buf,
          edgeRoundedRect(botW, botD, botR, EDGE_CORNER_SEGMENTS),
          floorDepth,
          cell.centerX,
          cell.centerY
        );
      }

      // Vertical edges along the tapered pocket walls
      const topTransition = roundedRectTransitionPts(cellW, cellD, cr);
      const botTransition = roundedRectTransitionPts(botW, botD, botR);
      pushVerticalEdges(
        buf,
        topTransition,
        botTransition,
        totalHeight,
        pocketFloorZ,
        cell.centerX,
        cell.centerY
      );
    },
    cellOpts
  );

  // Magnet hole circles
  if (magnetHoles) {
    const magnetRadius = magnetDiameter / 2;
    const circlePts: Array<[number, number]> = [];
    for (let i = 0; i < EDGE_CIRCLE_SEGMENTS; i++) {
      const angle = (i / EDGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      circlePts.push([magnetRadius * Math.cos(angle), magnetRadius * Math.sin(angle)]);
    }

    forEachCell(
      width,
      depth,
      (cell) => {
        if (cell.widthUnits < 1 || cell.depthUnits < 1) return;
        for (const [dx, dy] of MAGNET_OFFSETS) {
          pushEdgeLoop(buf, circlePts, floorDepth, cell.centerX + dx, cell.centerY + dy);
          pushEdgeLoop(buf, circlePts, MAGNET_FLOOR, cell.centerX + dx, cell.centerY + dy);
        }
      },
      cellOpts
    );
  }

  return new Float32Array(buf);
}
function meshCacheKey(params: BaseplateParams, forExport: boolean): string {
  return buildCacheKey(
    'v1',
    quantize(params.width),
    quantize(params.depth),
    quantize(params.gridUnitMm),
    params.magnetHoles,
    quantize(params.magnetDiameter),
    quantize(params.magnetDepth),
    quantize(params.paddingLeft),
    quantize(params.paddingRight),
    quantize(params.paddingFront),
    quantize(params.paddingBack),
    params.fractionalEdgeX,
    params.fractionalEdgeY,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    params.connectorNubs ?? false,
    params.invertDovetails ?? false,
    params.lightweight ?? true,
    quantize(params.cornerRadius ?? -1),
    quantize(params.cornerRadii?.tl ?? -1),
    quantize(params.cornerRadii?.tr ?? -1),
    quantize(params.cornerRadii?.bl ?? -1),
    quantize(params.cornerRadii?.br ?? -1),
    forExport
  );
}

/**
 * Cache key for the intermediate slab-with-pockets solid.
 * Only includes params that affect slab geometry and pocket cuts — NOT magnet
 * holes or connectors, so toggling those reuses the cached intermediate.
 */
function slabPocketsCacheKey(params: BaseplateParams, forExport: boolean): string {
  return buildCacheKey(
    'v1',
    quantize(params.width),
    quantize(params.depth),
    quantize(params.gridUnitMm),
    params.magnetHoles,
    quantize(params.magnetDepth),
    quantize(params.paddingLeft),
    quantize(params.paddingRight),
    quantize(params.paddingFront),
    quantize(params.paddingBack),
    params.fractionalEdgeX,
    params.fractionalEdgeY,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    forExport
  );
}

/**
 * Build the 2D slab outline, rounding only exterior corners.
 *
 * A corner is "exterior" when both adjacent edges are exterior (not join edges).
 * For an unsplit baseplate (no edges info), all corners are rounded.
 *
 * Rectangle corners (centered at origin):
 *   front-left  (-w/2, -d/2) ← left  + front
 *   front-right (+w/2, -d/2) ← right + front
 *   back-right  (+w/2, +d/2) ← right + back
 *   back-left   (-w/2, +d/2) ← left  + back
 */
function buildSlabProfile(
  totalW: number,
  totalD: number,
  cornerRadii: { tl: number; tr: number; bl: number; br: number },
  edges?: BaseplateParams['edges']
): Drawing {
  const hw = totalW / 2;
  const hd = totalD / 2;
  const { tl, tr, bl, br } = cornerRadii;

  // Determine which corners are eligible for rounding (split piece logic)
  const isExt = (corner: 'tl' | 'tr' | 'bl' | 'br'): boolean => {
    if (!edges) return true;
    switch (corner) {
      case 'tl':
        return edges.left === 'exterior' && edges.back === 'exterior';
      case 'tr':
        return edges.right === 'exterior' && edges.back === 'exterior';
      case 'bl':
        return edges.left === 'exterior' && edges.front === 'exterior';
      case 'br':
        return edges.right === 'exterior' && edges.front === 'exterior';
    }
  };

  const rBL = isExt('bl') && bl > 0 ? bl : 0;
  const rBR = isExt('br') && br > 0 ? br : 0;
  const rTR = isExt('tr') && tr > 0 ? tr : 0;
  const rTL = isExt('tl') && tl > 0 ? tl : 0;

  // Fast path: all zero → plain rectangle
  if (rBL === 0 && rBR === 0 && rTR === 0 && rTL === 0) {
    return drawRectangle(totalW, totalD);
  }

  // Fast path: all same → use built-in rounded rectangle
  if (rBL === rBR && rBR === rTR && rTR === rTL) {
    return drawRoundedRectangle(totalW, totalD, rBL);
  }

  // Draw CCW starting from mid-bottom-edge so close() creates a real
  // edge through BL, allowing customCorner(rBL) to apply correctly.
  // Starting at a corner would make close() degenerate (zero-length).
  let pen = draw([0, -hd]);
  pen = pen.lineTo([hw, -hd]);
  if (rBR > 0) pen = pen.customCorner(rBR);
  pen = pen.lineTo([hw, hd]);
  if (rTR > 0) pen = pen.customCorner(rTR);
  pen = pen.lineTo([-hw, hd]);
  if (rTL > 0) pen = pen.customCorner(rTL);
  pen = pen.lineTo([-hw, -hd]);
  if (rBL > 0) pen = pen.customCorner(rBL);
  return pen.close();
}

/**
 * Wrap a BREP boolean expression and retag any thrown error with a named
 * operation prefix. Errors reach the worker's top-level handler as
 * `baseplate.<op>: <inner>`, which gives support reports a handle for which
 * boolean in the pipeline failed — OCCT/brepjs failures otherwise come back
 * as generic `Called unwrap on an Err: ...` strings.
 */
function tagOp<T>(op: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    const inner = e instanceof Error ? e.message : String(e);
    throw new Error(`baseplate.${op}: ${inner}`, { cause: e });
  }
}

/**
 * Validate and clamp baseplate params to safe ranges.
 * Throws on clearly invalid dimensions (NaN, zero, negative) to surface
 * upstream bugs. Clamps other fields to safe ranges to prevent OOM.
 */
function sanitizeParams(params: BaseplateParams): BaseplateParams {
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

  const clamp = (v: number, min: number, max: number): number =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;

  return {
    ...params,
    gridUnitMm: clamp(params.gridUnitMm, 1, 200),
    magnetDiameter: clamp(params.magnetDiameter, 0.5, 20),
    magnetDepth: clamp(params.magnetDepth, 0.5, 10),
    paddingLeft: clamp(params.paddingLeft, 0, 100),
    paddingRight: clamp(params.paddingRight, 0, 100),
    paddingFront: clamp(params.paddingFront, 0, 100),
    paddingBack: clamp(params.paddingBack, 0, 100),
  };
}

/**
 * Generate baseplate mesh for preview or export.
 */
export function generateBaseplate(
  rawParams: BaseplateParams,
  onProgress: ProgressFn,
  forExport: boolean,
  signal?: AbortSignal
): MeshData {
  const params = sanitizeParams(rawParams);
  onProgress('base', 0);
  checkCancelled(signal);

  // Check mesh cache — skips BREP booleans + tessellation entirely
  const cacheKey = meshCacheKey(params, forExport);
  const cached = meshResultCache.get(cacheKey);
  if (cached !== undefined) {
    onProgress('base', 1);
    return cached;
  }

  const baseplate = buildBaseplateSolid(params, forExport, (progress) => {
    onProgress('base', progress);
    checkCancelled(signal);
  });

  onProgress('base', 0.9);
  checkCancelled(signal);

  // Tessellate — match the bin designer's tolerance strategy.
  // Baseplates have magnet hole cylinders that need tight angular tolerance
  // and mostly flat surfaces where linear tolerance can be coarser.
  const totalW = params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight;
  const totalD = params.depth * params.gridUnitMm + params.paddingFront + params.paddingBack;
  const maxDimension = Math.max(totalW, totalD);
  let tolerance: number;
  let angularTolerance: number;

  if (forExport) {
    tolerance = 0.01;
    angularTolerance = 5;
  } else if (params.magnetHoles) {
    // Magnet holes have small cylinders — match bin designer's "with lip" tier
    tolerance = Math.min(0.1, Math.max(0.05, maxDimension / 2500));
    angularTolerance = 10;
  } else {
    // No magnets — mostly planar, match bin designer's "simple" tier
    tolerance = Math.min(0.4, Math.max(0.15, maxDimension / 600));
    angularTolerance = 12;
  }

  try {
    const meshResult = mesh(baseplate, { tolerance, angularTolerance });
    // Compute edge lines procedurally from params (avoids expensive meshEdges() on BREP)
    const edgeVerts = computeBaseplateEdgeLines(params);

    onProgress('base', 1);

    const result = toIndexedMeshData(meshResult, edgeVerts);
    meshResultCache.set(cacheKey, result);
    return result;
  } finally {
    baseplate.delete();
  }
}

/**
 * Maximum number of BREP tool shapes to cut in a single boolean pass.
 * Keeps WASM heap bounded — larger grids (16x16 = 1024 magnet holes)
 * would otherwise hold all shapes simultaneously, causing OOM.
 */
const BOOLEAN_BATCH_SIZE = 64;

/**
 * Cut an array of tool shapes from a solid in batches.
 * Each batch cuts up to BOOLEAN_BATCH_SIZE shapes, then disposes them
 * before building the next batch. This bounds peak WASM memory usage.
 *
 * Consumes `solid` on both success and failure — callers must not
 * reference it after this call. On error, disposes `result` and all
 * remaining unprocessed tools before rethrowing.
 */
function cutInBatches(solid: Shape3D, tools: Shape3D[]): Shape3D {
  if (tools.length === 0) return solid;

  let result = solid;
  let processed = 0;

  try {
    for (let i = 0; i < tools.length; i += BOOLEAN_BATCH_SIZE) {
      const end = Math.min(i + BOOLEAN_BATCH_SIZE, tools.length);
      const batch = tools.slice(i, end);
      const prev = result;
      result = unwrap(cutAll(result as ValidSolid, batch as ValidSolid[]));
      prev.delete();
      for (const t of batch) t.delete();
      processed = end;
    }
  } catch (e) {
    // Dispose remaining unprocessed tools and the current result solid
    for (let j = processed; j < tools.length; j++) tools[j].delete();
    result.delete();
    throw e;
  }

  return result;
}

/**
 * Diagnostic probe invoked at each baseplate construction milestone.
 *
 * Test-only. `shape` is a *borrowed* handle valid only for the synchronous
 * duration of the call — do not retain, delete, or mutate it. Later build
 * steps may dispose the underlying WASM object, making any retained reference
 * a use-after-free.
 */
export type BaseplateProbe = (label: string, shape: Shape3D) => void;

/**
 * Build the complete baseplate BREP solid.
 *
 * Without magnets: slab height = SOCKET_HEIGHT (5mm). Pockets are through-cut
 * (no floor), leaving just walls between cells.
 *
 * With magnets: slab height = SOCKET_HEIGHT + MAGNET_FLOOR + magnetDepth.
 * Pockets cut to SOCKET_HEIGHT depth only, leaving a solid continuous floor.
 * Magnet holes are blind cylindrical pockets cut downward from the pocket
 * floor, leaving a thin retaining floor (MAGNET_FLOOR) at the bottom.
 *
 * The slab profile has rounded exterior corners (PLATE_CORNER_RADIUS),
 * which carry through the full height including the magnet floor.
 */
export function buildBaseplateSolid(
  params: BaseplateParams,
  forExport: boolean = true,
  onProgress?: (progress: number) => void,
  probe?: BaseplateProbe
): Shape3D {
  const {
    width,
    depth,
    gridUnitMm,
    magnetHoles,
    magnetDiameter,
    magnetDepth,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges,
  } = params;

  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;
  const cellOpts = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };

  // This is cached separately so that toggling magnets or connectors doesn't
  // redo the pocket boolean cuts.
  const spKey = slabPocketsCacheKey(params, forExport);
  const cachedSlab = slabWithPocketsCache.get(spKey);
  let baseplate: Shape3D;

  if (cachedSlab !== undefined) {
    baseplate = unwrap(clone(cachedSlab));
    onProgress?.(0.5);
  } else {
    // Build solid slab with RECTANGULAR profile for caching — pocket cuts are
    // independent of corner radius, so we cache the rectangular slab+pockets
    // and apply corner rounding as a post-cache step. This avoids expensive
    // pocket re-cuts when only corner radius changes.
    const rectProfile = drawRectangle(totalW, totalD);
    const extrudedSlab = (
      rectProfile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
    ).extrude(-totalHeight);
    baseplate = translate(extrudedSlab, [slabOffsetX, slabOffsetY, 0]);
    extrudedSlab.delete();
    probe?.('slabExtruded', baseplate);

    onProgress?.(0.2);

    // Cut pockets — through-cut when no magnets, partial when magnets leave a floor
    const throughCut = !magnetHoles;
    const pockets: Shape3D[] = [];
    forEachCell(
      width,
      depth,
      (cell) => {
        const cellW_mm = cell.widthUnits * gridUnitMm;
        const cellD_mm = cell.depthUnits * gridUnitMm;
        const pocket = getPocketTemplate(cellW_mm, cellD_mm, forExport, throughCut);
        // pocket from getPocketTemplate is a clone owned by caller — translate
        // produces a new shape, so dispose the pre-translation clone.
        const positioned = translate(pocket, [cell.centerX, cell.centerY, 0]);
        pocket.delete();
        pockets.push(positioned);
      },
      cellOpts
    );

    if (pockets.length > 0) {
      baseplate = cutInBatches(baseplate, pockets);
    }

    slabWithPocketsCache.set(spKey, baseplate);
    // Clone after caching so subsequent mutations don't corrupt the cached solid
    baseplate = unwrap(clone(baseplate));
    onProgress?.(0.5);
  }
  probe?.('pocketsCut', baseplate);

  // Apply corner rounding as a post-cache step — this is fast (single boolean
  // cut) and avoids redoing expensive pocket cuts when corner radius changes.
  //
  // Max radius: half a grid unit + padding. The arc can enter the corner cell
  // but won't reach past the cell center, preserving the pocket structure.
  // Also clamped to half the slab to prevent degenerate geometry.
  const minPadding = Math.min(
    Math.min(paddingLeft, paddingRight),
    Math.min(paddingFront, paddingBack)
  );
  const cellLimit = gridUnitMm / 2 + minPadding;
  const geomLimit = Math.min(totalW, totalD) / 2 - 0.1;
  const maxRadius = Math.min(cellLimit, geomLimit);
  const cornerRadii = resolveCornerRadii(params, maxRadius);
  const hasRounding =
    cornerRadii.tl > 0 || cornerRadii.tr > 0 || cornerRadii.bl > 0 || cornerRadii.br > 0;
  if (hasRounding) {
    const roundedProfile = buildSlabProfile(totalW, totalD, cornerRadii, edges);
    const roundedSlab = (
      roundedProfile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
    ).extrude(-totalHeight);
    const roundedTranslated = translate(roundedSlab, [slabOffsetX, slabOffsetY, 0]);
    roundedSlab.delete();
    // Intersect: keep only material that's inside both the cached rectangular
    // slab-with-pockets AND the rounded profile.
    const oldBaseplate = baseplate;
    baseplate = tagOp('cornerClipIntersect', () => unwrap(intersect(baseplate, roundedTranslated)));
    oldBaseplate.delete();
    roundedTranslated.delete();
    probe?.('cornerIntersected', baseplate);
  }

  // 2a. Magnet hole cutters — built and cut in batches to limit WASM memory.
  // A 16x16 grid produces 1024 magnet holes; holding all simultaneously can OOM.
  if (magnetHoles) {
    const holes = buildMagnetHoles(width, depth, magnetDiameter / 2, magnetDepth, cellOpts);
    baseplate = cutInBatches(baseplate, holes);
    probe?.('magnetHolesCut', baseplate);
  }

  // 2a-ii. Lightweight floor cutters (cross-shaped material removal)
  if (magnetHoles && params.lightweight !== false) {
    const floorCutters = buildLightweightFloorCutters(
      width,
      depth,
      magnetDiameter / 2,
      magnetDepth,
      cellOpts
    );
    baseplate = cutInBatches(baseplate, floorCutters);
    probe?.('lightweightFloorCut', baseplate);
  }

  onProgress?.(0.4);

  // 2b. Connector groove cutters (small count — no batching needed)
  const { nubs, holes: connHoles } = buildConnectors(
    params,
    totalHeight,
    totalW,
    totalD,
    slabOffsetX,
    slabOffsetY
  );

  if (nubs.length > 0 || connHoles.length > 0) {
    const steps: BooleanPipelineStep[] = [
      ...nubs.map((n): BooleanPipelineStep => ({ op: 'fuse', tool: n })),
      ...connHoles.map((c): BooleanPipelineStep => ({ op: 'cut', tool: c })),
    ];
    const preBoolean = baseplate;
    const pipelineResult = booleanPipeline(baseplate, steps);
    let pipelineLabel = 'connectorPipeline';
    if (isOk(pipelineResult)) {
      baseplate = pipelineResult.value;
    } else {
      // Fallback: sequential fuseAll then cutAll. Tag the probe so the
      // diagnostic can tell which path produced the final solid (#1494).
      pipelineLabel = 'connectorPipelineFallback';
      if (nubs.length > 0) {
        baseplate = tagOp('connectorFuse', () =>
          unwrap(fuseAll([baseplate, ...nubs] as ValidSolid[]))
        );
      }
      if (connHoles.length > 0) {
        const preCut = baseplate;
        baseplate = tagOp('connectorCut', () =>
          unwrap(cutAll(baseplate as ValidSolid, connHoles as ValidSolid[]))
        );
        if (preCut !== preBoolean) preCut.delete();
      }
    }
    if (baseplate !== preBoolean) preBoolean.delete();
    for (const n of nubs) n.delete();
    for (const c of connHoles) c.delete();
    probe?.(pipelineLabel, baseplate);
  }

  onProgress?.(0.6);

  onProgress?.(0.8);

  // Probe before the final translate: the +Z shift preserves topology,
  // orientation, and signed volume, so the diagnostic sees identical
  // metrics either way — and a probe throw here can't strand `baseplate`
  // (already in scope, freed after `translate` returns) or `finalBaseplate`
  // (not yet created).
  probe?.('final', baseplate);
  const finalBaseplate = translate(baseplate, [0, 0, totalHeight]);
  baseplate.delete();
  return finalBaseplate;
}

/**
 * Export baseplate as STL or STEP file.
 */
export async function exportBaseplate(
  rawParams: BaseplateParams,
  format: ExportFormat,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const params = sanitizeParams(rawParams);
  // Use simplified pocket cutter (forExport=false) — the full-detail
  // multi-section loft creates BREP topologies that OCCT can't reliably
  // tessellate or export. The simplified version is geometrically equivalent
  // for 3D printing (same outer profile, slightly simplified taper).
  const baseplate = buildBaseplateSolid(params, false);
  try {
    const totalW = params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight;
    const totalD = params.depth * params.gridUnitMm + params.paddingFront + params.paddingBack;
    const name = `baseplate_${params.width}x${params.depth}_${Math.round(totalW)}x${Math.round(totalD)}mm`;

    if (format === 'step') {
      const blob = unwrap(exportSTEP(baseplate));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }

    // STL — mesh the BREP and pack the triangles into a binary STL.
    // OCCT's StlAPI.Write fails on baseplate geometries, so we tessellate
    // via brepjs `mesh()` and emit the records ourselves; brepjs already
    // produces face-consistent winding so no per-triangle correction is
    // applied (see #1472).
    const tol = tolerance ?? 0.01;
    const angTol = angularTolerance ?? 5;
    const meshResult = mesh(baseplate, { tolerance: tol, angularTolerance: angTol });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    baseplate.delete();
  }
}

/**
 * Build binary STL from brepjs mesh output.
 *
 * brepjs/OCCT historically emitted tessellated meshes whose face orientations
 * weren't consistent across the whole solid: for some baseplate piece configs
 * (corner-3, corner-4, edge-x-1) the bottom face and parts of the
 * dovetail/pocket walls were wound backwards, causing slicers to flag
 * thousands of "non-manifold edges" (#1490). The downstream `repairMeshWinding`
 * BFS pass corrects this before emitting the STL.
 *
 * Investigation status (#1494): with brepjs 15.6.1 + OCCT kernel, the repair
 * is currently a no-op for every known piece config — see
 * `__dual-kernel__/diagnoseBaseplateWinding.test.ts`. The pass is kept as a
 * defensive net for any future regression in brepjs/OCCT tessellation.
 *
 * (An even earlier version applied a per-triangle (cross · sum-of-vertex-
 * normals) heuristic which mis-fired on ~7% of triangles at curved/shared
 * edges; that was the issue tracked in #1472 and the heuristic was removed
 * in #1473.)
 *
 * The STL face normal is the cross-product of the (corrected) winding
 * edges, the same convention slicers reconstruct anyway.
 */
function buildBaseplateSTL(
  meshResult: {
    vertices: ArrayLike<number>;
    triangles: ArrayLike<number>;
  },
  name: string
): ArrayBuffer {
  const verts = meshResult.vertices;
  const tris = repairMeshWinding(meshResult.vertices, meshResult.triangles);
  const triangleCount = tris.length / 3;

  const HEADER_SIZE = 80;
  const COUNT_SIZE = 4;
  const TRIANGLE_SIZE = 50;
  const buffer = new ArrayBuffer(HEADER_SIZE + COUNT_SIZE + triangleCount * TRIANGLE_SIZE);
  const view = new DataView(buffer);

  const header = `Exported by Gridfinity Layout Tool - ${name}`;
  const headerBytes = new TextEncoder().encode(header);
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < headerBytes.length ? headerBytes[i] : 0);
  }
  view.setUint32(HEADER_SIZE, triangleCount, true);

  let offset = HEADER_SIZE + COUNT_SIZE;
  for (let t = 0; t < triangleCount; t++) {
    const i0 = tris[t * 3];
    const i1 = tris[t * 3 + 1];
    const i2 = tris[t * 3 + 2];

    const v0x = verts[i0 * 3];
    const v0y = verts[i0 * 3 + 1];
    const v0z = verts[i0 * 3 + 2];
    const v1x = verts[i1 * 3];
    const v1y = verts[i1 * 3 + 1];
    const v1z = verts[i1 * 3 + 2];
    const v2x = verts[i2 * 3];
    const v2y = verts[i2 * 3 + 1];
    const v2z = verts[i2 * 3 + 2];

    const ex = v1x - v0x;
    const ey = v1y - v0y;
    const ez = v1z - v0z;
    const fx = v2x - v0x;
    const fy = v2y - v0y;
    const fz = v2z - v0z;
    const cx = ey * fz - ez * fy;
    const cy = ez * fx - ex * fz;
    const cz = ex * fy - ey * fx;

    const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    view.setFloat32(offset, cx / len, true);
    view.setFloat32(offset + 4, cy / len, true);
    view.setFloat32(offset + 8, cz / len, true);
    offset += 12;

    for (const vi of [i0, i1, i2]) {
      view.setFloat32(offset, verts[vi * 3], true);
      view.setFloat32(offset + 4, verts[vi * 3 + 1], true);
      view.setFloat32(offset + 8, verts[vi * 3 + 2], true);
      offset += 12;
    }

    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}

/** Clear all baseplate shape caches, disposing WASM handles. */
export function clearBaseplateCaches(): void {
  pocketTemplateCache.dispose();
  meshResultCache.clear(); // MeshData is plain JS — no WASM disposal needed
  slabWithPocketsCache.dispose();
}

/** Collect stats from all baseplate LRU caches. */
export function getBaseplateCacheStats(): CacheStats[] {
  return [pocketTemplateCache, meshResultCache, slabWithPocketsCache].map((c) => c.getStats());
}

/** Reset stats counters on all baseplate LRU caches. */
export function resetBaseplateCacheStats(): void {
  pocketTemplateCache.resetStats();
  meshResultCache.resetStats();
  slabWithPocketsCache.resetStats();
}
