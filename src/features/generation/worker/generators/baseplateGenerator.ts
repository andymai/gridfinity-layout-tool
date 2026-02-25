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
  drawCircle,
  draw,
  unwrap,
  cutAll,
  clone,
  translate,
  fuseAll,
  mesh,
  meshEdges,
  exportSTEP,
} from 'brepjs';
import type { Shape3D, Sketch, Drawing } from 'brepjs';
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
  TONGUE_PROTRUSION,
  TONGUE_BASE_HALF,
  TONGUE_TIP_HALF,
  TONGUE_CLEARANCE,
} from './generatorTypes';
import type { ProgressFn, ForEachCellOptions } from './generatorTypes';
import { LRUCache } from './lruCache';

// ─── Pocket Template Cache ──────────────────────────────────────────────────
// LRU cache for pocket templates keyed by cell size + forExport + floorDepth.
// Build one loft per unique cell size, then clone+translate for each grid position.

const pocketTemplateCache = new LRUCache<Shape3D>(8);

// ─── Mesh Result Cache ──────────────────────────────────────────────────────
// Caches the fully tessellated mesh data (vertices, normals, indices, edges)
// keyed by generation params. Skips BREP booleans + tessellation entirely on
// cache hit — the most expensive operations in the pipeline.

const meshResultCache = new LRUCache<MeshData>(4);

function pocketCacheKey(
  cellW: number,
  cellD: number,
  forExport: boolean,
  throughCut: boolean
): string {
  return `${cellW}|${cellD}|${forExport}|${throughCut}`;
}

// ─── Pocket Builders ────────────────────────────────────────────────────────

/** Insets at each Z breakpoint — same taper profile as bin socket but at full cell size */
const INSET_TOP = 0;
const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm

/** Z extension above/below to avoid coplanar boolean failures */
const COPLANAR_MARGIN = 1;

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
    return clone(cached);
  }
  const template = forExport
    ? buildPocketCutter(cellW_mm, cellD_mm, throughCut)
    : buildSimplifiedPocketCutter(cellW_mm, cellD_mm, throughCut);
  pocketTemplateCache.set(key, template);
  return clone(template);
}

// ─── Magnet Holes ───────────────────────────────────────────────────────────

/**
 * Build magnet hole cutters that open from the pocket floor (top side).
 *
 * Each magnet hole is a blind cylindrical pocket cut downward from the pocket
 * floor into the solid floor below. The hole extends down by magnetDepth,
 * leaving a thin retaining floor (MAGNET_FLOOR = 0.5mm) at the bottom.
 * Magnets are dropped in from the pocket side and held by gravity.
 *
 * Builds one template cylinder and clones it for each hole position.
 * Only full-size (1.0+ unit) cells get magnet holes.
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
  const magnetTemplate = sketch(drawCircle(magnetRadius), 'XY', cutterZ).extrude(-cutterDepth);

  const holes: Shape3D[] = [];
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

      for (const [dx, dy] of MAGNET_OFFSETS) {
        holes.push(translate(clone(magnetTemplate), [cell.centerX + dx, cell.centerY + dy, 0]));
      }
    },
    cellOpts
  );

  return holes;
}

// ─── Dovetail Connectors ─────────────────────────────────────────────────────

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
  const { edges, connectorNubs } = params;
  const tongues: Shape3D[] = [];
  const grooves: Shape3D[] = [];

  if (!connectorNubs || !edges) return { nubs: tongues, holes: grooves };

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
      isMale: true,
      wallPos: -halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: -1,
    },
    {
      side: 'right',
      isMale: false,
      wallPos: halfW + slabOffsetX,
      numBoundaries: Math.ceil(params.depth) - 1,
      boundaryPos: (k) => k * gridUnit - (params.depth * gridUnit) / 2,
      protrudeAxis: 'x',
      protrudeDir: 1,
    },
    {
      side: 'front',
      isMale: true,
      wallPos: -halfD + slabOffsetY,
      numBoundaries: Math.ceil(params.width) - 1,
      boundaryPos: (k) => k * gridUnit - (params.width * gridUnit) / 2,
      protrudeAxis: 'y',
      protrudeDir: -1,
    },
    {
      side: 'back',
      isMale: false,
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
        const profile = draw(pt(w, bp + bW))
          .lineTo(pt(w + d * P, bp + tW))
          .lineTo(pt(w + d * P, bp - tW))
          .lineTo(pt(w, bp - bW))
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

// ─── Public API ─────────────────────────────────────────────────────────────

function meshCacheKey(params: BaseplateParams, forExport: boolean): string {
  return [
    params.width,
    params.depth,
    params.gridUnitMm,
    params.magnetHoles,
    params.magnetDiameter,
    params.magnetDepth,
    params.paddingLeft,
    params.paddingRight,
    params.paddingFront,
    params.paddingBack,
    params.fractionalEdgeX,
    params.fractionalEdgeY,
    params.edges?.left ?? '',
    params.edges?.right ?? '',
    params.edges?.front ?? '',
    params.edges?.back ?? '',
    params.connectorNubs ?? false,
    forExport,
  ].join('|');
}

// ─── Slab Profile Builder ──────────────────────────────────────────────────

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
  cornerR: number,
  edges?: BaseplateParams['edges']
): Drawing {
  // No edges info (unsplit) or all edges exterior → round all corners
  if (
    !edges ||
    (edges.left === 'exterior' &&
      edges.right === 'exterior' &&
      edges.front === 'exterior' &&
      edges.back === 'exterior')
  ) {
    return drawRoundedRectangle(totalW, totalD, cornerR);
  }

  // A corner should be rounded only when BOTH adjacent edges are exterior
  const hw = totalW / 2;
  const hd = totalD / 2;

  type Point2D = [number, number];
  const exteriorCorners: Point2D[] = [];

  if (edges.left === 'exterior' && edges.front === 'exterior') {
    exteriorCorners.push([-hw, -hd]);
  }
  if (edges.right === 'exterior' && edges.front === 'exterior') {
    exteriorCorners.push([hw, -hd]);
  }
  if (edges.right === 'exterior' && edges.back === 'exterior') {
    exteriorCorners.push([hw, hd]);
  }
  if (edges.left === 'exterior' && edges.back === 'exterior') {
    exteriorCorners.push([-hw, hd]);
  }

  // No exterior corners → plain rectangle
  if (exteriorCorners.length === 0) {
    return drawRectangle(totalW, totalD);
  }

  // Start with sharp rectangle, then fillet only the exterior corners
  return drawRectangle(totalW, totalD).fillet(cornerR, (f) => f.inList(exteriorCorners));
}

/**
 * Generate baseplate mesh for preview or export.
 */
export function generateBaseplate(
  params: BaseplateParams,
  onProgress: ProgressFn,
  forExport: boolean,
  signal?: AbortSignal
): MeshData {
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

  // Tessellate — baseplates are mostly flat slabs, so preview can use coarse settings.
  // Dovetail connectors are large prismatic features that tessellate fine at 0.5mm.
  const tolerance = forExport ? 0.01 : 0.5;
  const angularTolerance = forExport ? 5 : 45;
  const meshResult = mesh(baseplate, { tolerance, angularTolerance });
  const edgeMesh = forExport ? null : meshEdges(baseplate, { tolerance: 0.5 });
  const edgeVerts = edgeMesh ? new Float32Array(edgeMesh.lines) : new Float32Array(0);

  onProgress('base', 1);

  const result = toIndexedMeshData(meshResult, false, edgeVerts);
  meshResultCache.set(cacheKey, result);
  return result;
}

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
function buildBaseplateSolid(
  params: BaseplateParams,
  forExport: boolean = true,
  onProgress?: (progress: number) => void
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

  // 1. Build solid slab — taller when magnets require a solid floor
  const floorDepth = magnetHoles ? MAGNET_FLOOR + magnetDepth : 0;
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const totalHeight = SOCKET_HEIGHT + floorDepth;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const cornerR = Math.min(PLATE_CORNER_RADIUS, maxRadius);

  // Slab center offset — grid pockets stay at origin, slab shifts to accommodate asymmetric padding
  const slabOffsetX = (paddingRight - paddingLeft) / 2;
  const slabOffsetY = (paddingBack - paddingFront) / 2;

  // Build slab profile — selectively round only exterior corners for split pieces
  const profile = buildSlabProfile(totalW, totalD, cornerR, edges);
  let baseplate: Shape3D = (
    profile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
  ).extrude(-totalHeight);

  // Shift slab so grid portion remains centered at origin
  baseplate = translate(baseplate, [slabOffsetX, slabOffsetY, 0]);

  onProgress?.(0.2);

  // 2. Collect all subtractive tools (pockets, magnet holes, connector grooves)
  // into a single array for one batched cutAll operation. This avoids rebuilding
  // the BREP topology between separate boolean passes.
  const throughCut = !magnetHoles;
  const cellOpts = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };
  const allCuts: Shape3D[] = [];

  // 2a. Pocket cutters
  forEachCell(
    width,
    depth,
    (cell) => {
      const cellW_mm = cell.widthUnits * gridUnitMm;
      const cellD_mm = cell.depthUnits * gridUnitMm;
      const pocket = getPocketTemplate(cellW_mm, cellD_mm, forExport, throughCut);
      allCuts.push(translate(pocket, [cell.centerX, cell.centerY, 0]));
    },
    cellOpts
  );

  // 2b. Magnet hole cutters
  if (magnetHoles) {
    const holes = buildMagnetHoles(width, depth, magnetDiameter / 2, magnetDepth, cellOpts);
    allCuts.push(...holes);
  }

  onProgress?.(0.4);

  // 2c. Connector groove cutters
  const { nubs, holes: connHoles } = buildConnectors(
    params,
    totalHeight,
    totalW,
    totalD,
    slabOffsetX,
    slabOffsetY
  );
  allCuts.push(...connHoles);

  // 3. Batch-fuse connector tongues (single fuseAll instead of sequential fuse loop)
  if (nubs.length > 0) {
    baseplate = unwrap(fuseAll([baseplate, ...nubs]));
  }

  onProgress?.(0.6);

  // 4. Single batched cut of all subtractive tools
  if (allCuts.length > 0) {
    baseplate = unwrap(cutAll(baseplate, allCuts));
  }

  onProgress?.(0.8);

  // 5. Shift up so bottom face sits at Z=0, matching the bin convention
  baseplate = translate(baseplate, [0, 0, totalHeight]);

  return baseplate;
}

/**
 * Export baseplate as STL or STEP file.
 */
export async function exportBaseplate(
  params: BaseplateParams,
  format: ExportFormat,
  tolerance?: number,
  angularTolerance?: number
): Promise<{ data: ArrayBuffer; fileName: string }> {
  // Use simplified pocket cutter (forExport=false) — the full-detail
  // multi-section loft creates BREP topologies that OCCT can't reliably
  // tessellate or export. The simplified version is geometrically equivalent
  // for 3D printing (same outer profile, slightly simplified taper).
  const baseplate = buildBaseplateSolid(params, false);
  const totalW = params.width * params.gridUnitMm + params.paddingLeft + params.paddingRight;
  const totalD = params.depth * params.gridUnitMm + params.paddingFront + params.paddingBack;
  const name = `baseplate_${params.width}x${params.depth}_${Math.round(totalW)}x${Math.round(totalD)}mm`;

  if (format === 'step') {
    const blob = unwrap(exportSTEP(baseplate));
    const data = await blob.arrayBuffer();
    return { data, fileName: `${name}.step` };
  }

  // STL — mesh the BREP and build binary STL with winding correction.
  // OCCT's StlAPI.Write fails on baseplate geometries, so we tessellate
  // manually and fix triangle winding to match the STL right-hand rule.
  const tol = tolerance ?? 0.01;
  const angTol = angularTolerance ?? 5;
  const meshResult = mesh(baseplate, { tolerance: tol, angularTolerance: angTol });
  const data = buildBaseplateSTL(meshResult, name);
  return { data, fileName: `${name}.stl` };
}

/**
 * Build binary STL from brepjs mesh output, correcting triangle winding.
 *
 * brepjs mesh() produces vertex normals that point outward from the solid,
 * but the triangle winding may not match STL's right-hand rule convention.
 * For each triangle we compute the cross-product normal from the winding
 * and flip the vertex order if it disagrees with the BREP normal.
 */
function buildBaseplateSTL(
  meshResult: {
    vertices: ArrayLike<number>;
    normals: ArrayLike<number>;
    triangles: ArrayLike<number>;
  },
  name: string
): ArrayBuffer {
  const verts = meshResult.vertices;
  const norms = meshResult.normals;
  const tris = meshResult.triangles;
  const triangleCount = tris.length / 3;

  const HEADER_SIZE = 80;
  const COUNT_SIZE = 4;
  const TRIANGLE_SIZE = 50;
  const buffer = new ArrayBuffer(HEADER_SIZE + COUNT_SIZE + triangleCount * TRIANGLE_SIZE);
  const view = new DataView(buffer);

  // Header
  const header = `Exported by Gridfinity Layout Tool - ${name}`;
  const headerBytes = new TextEncoder().encode(header);
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < headerBytes.length ? headerBytes[i] : 0);
  }
  view.setUint32(HEADER_SIZE, triangleCount, true);

  let offset = HEADER_SIZE + COUNT_SIZE;
  for (let t = 0; t < triangleCount; t++) {
    const i0 = tris[t * 3];
    let i1 = tris[t * 3 + 1];
    let i2 = tris[t * 3 + 2];

    // Vertex positions
    const v0x = verts[i0 * 3],
      v0y = verts[i0 * 3 + 1],
      v0z = verts[i0 * 3 + 2];
    const v1x = verts[i1 * 3],
      v1y = verts[i1 * 3 + 1],
      v1z = verts[i1 * 3 + 2];
    const v2x = verts[i2 * 3],
      v2y = verts[i2 * 3 + 1],
      v2z = verts[i2 * 3 + 2];

    // Cross-product normal from winding order
    const ex = v1x - v0x,
      ey = v1y - v0y,
      ez = v1z - v0z;
    const fx = v2x - v0x,
      fy = v2y - v0y,
      fz = v2z - v0z;
    let cx = ey * fz - ez * fy;
    let cy = ez * fx - ex * fz;
    let cz = ex * fy - ey * fx;

    // BREP vertex normal (average of triangle's vertex normals for comparison)
    const bnx = norms[i0 * 3] + norms[i1 * 3] + norms[i2 * 3];
    const bny = norms[i0 * 3 + 1] + norms[i1 * 3 + 1] + norms[i2 * 3 + 1];
    const bnz = norms[i0 * 3 + 2] + norms[i1 * 3 + 2] + norms[i2 * 3 + 2];

    // If cross-product disagrees with BREP normal, flip winding
    const dot = cx * bnx + cy * bny + cz * bnz;
    if (dot < 0) {
      // Swap i1 and i2 to reverse winding
      const tmp = i1;
      i1 = i2;
      i2 = tmp;
      cx = -cx;
      cy = -cy;
      cz = -cz;
    }

    // Normalize for STL face normal
    const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    view.setFloat32(offset, cx / len, true);
    view.setFloat32(offset + 4, cy / len, true);
    view.setFloat32(offset + 8, cz / len, true);
    offset += 12;

    // Vertices (using possibly-swapped order)
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
