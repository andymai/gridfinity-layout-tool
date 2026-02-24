/**
 * Baseplate geometry generation for Gridfinity baseplates.
 *
 * Builds a baseplate as a solid block with pockets cut from the top surface.
 * Each pocket receives a bin's tapered socket profile. The pocket shape is
 * the bin socket profile at full grid size (no clearance reduction), so that
 * bin sockets (which are reduced by CLEARANCE) fit with the intended gap.
 *
 * Coordinate system (after final Z-shift):
 * - Z=0: bottom face of baseplate
 * - Z=totalHeight: top face (bin interface), pockets open here
 * - Pockets extend from Z=totalHeight down to Z=BASE_THICKNESS (or Z=0 when no magnets)
 */

import {
  drawRoundedRectangle,
  drawRectangle,
  drawCircle,
  unwrap,
  cutAll,
  clone,
  translate,
  mesh,
  meshEdges,
  exportSTEP,
} from 'brepjs';
import type { Shape3D, Sketch, Drawing } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';
import {
  CORNER_RADIUS,
  SOCKET_HEIGHT,
  SOCKET_BIG_TAPER,
  SOCKET_TAPER_WIDTH,
  CLEARANCE,
  forEachCell,
  toIndexedMeshData,
  checkCancelled,
  sketch,
} from './generatorTypes';
import type { ProgressFn, ForEachCellOptions } from './generatorTypes';
import { LRUCache } from './lruCache';

// ─── Baseplate Constants ──────────────────────────────────────────────────────

/** Thickness of the solid base under the pockets (mm) */
const BASE_THICKNESS = 1.4;

/** Corner radius for the baseplate outer perimeter */
const PLATE_CORNER_RADIUS = GRIDFINITY.SOCKET_CORNER_RADIUS;

// ─── Pocket Template Cache ──────────────────────────────────────────────────
// LRU cache for pocket templates keyed by cell size + forExport + throughCut.
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
const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

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

function pocketCornerRadius(cellW_mm: number, cellD_mm: number): number {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  return Math.min(CORNER_RADIUS, maxRadius);
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
 * The cutter extends above Z=0 to avoid coplanar faces with the block
 * top surface, which would cause BREP boolean failures.
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
 * Build magnet hole cutouts for the underside of the baseplate.
 *
 * Builds one template cylinder and clones it for each hole position.
 * Magnet holes are placed at the standard 4-corner positions within each
 * full-size (1.0 x 1.0 unit) cell. Holes cut upward from the bottom face.
 */
function buildMagnetHoles(
  gridW: number,
  gridD: number,
  magnetRadius: number,
  magnetDepth: number,
  cellOpts?: ForEachCellOptions
): Shape3D[] {
  const totalHeight = SOCKET_HEIGHT + BASE_THICKNESS;
  const HOLE_OFFSET = 13; // mm from cell center (Gridfinity spec constant)

  const holeOffsets: ReadonlyArray<readonly [number, number]> = [
    [-HOLE_OFFSET, -HOLE_OFFSET],
    [-HOLE_OFFSET, HOLE_OFFSET],
    [HOLE_OFFSET, HOLE_OFFSET],
    [HOLE_OFFSET, -HOLE_OFFSET],
  ];

  // Build one template cylinder, clone for each position
  const magnetTemplate = sketch(drawCircle(magnetRadius), 'XY', -totalHeight).extrude(magnetDepth);

  const holes: Shape3D[] = [];
  forEachCell(
    gridW,
    gridD,
    (cell) => {
      // Only place holes in full-size cells (skip half-unit fractional edge cells)
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

      for (const [dx, dy] of holeOffsets) {
        holes.push(translate(clone(magnetTemplate), [cell.centerX + dx, cell.centerY + dy, 0]));
      }
    },
    cellOpts
  );

  return holes;
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

  // Tessellate — baseplates are mostly flat slabs, so preview can use very coarse settings
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
 * Without magnets: block height = SOCKET_HEIGHT only. Pockets cut all the
 * way through, leaving just walls between cells (no floor).
 *
 * With magnets: block height = SOCKET_HEIGHT + BASE_THICKNESS. Pockets cut
 * to SOCKET_HEIGHT depth, leaving a thin floor for magnet hole pockets.
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

  // 1. Build solid block — only add BASE_THICKNESS when magnets need a floor
  const totalW = width * gridUnitMm + paddingLeft + paddingRight;
  const totalD = depth * gridUnitMm + paddingFront + paddingBack;
  const totalHeight = magnetHoles ? SOCKET_HEIGHT + BASE_THICKNESS : SOCKET_HEIGHT;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const cornerR = Math.min(PLATE_CORNER_RADIUS, maxRadius);

  // Slab center offset — grid pockets stay at origin, slab shifts to accommodate asymmetric padding
  // paddingRight pushes slab center in +X so the right edge extends further right
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

  // 2. Build pocket cutters using template cloning (one loft per unique cell size)
  // When no magnets, pockets cut all the way through (throughCut)
  const throughCut = !magnetHoles;
  const pockets: Shape3D[] = [];
  const cellOpts = { fractionalEdgeX, fractionalEdgeY, gridUnitMm };
  forEachCell(
    width,
    depth,
    (cell) => {
      // Full cell size — no CLEARANCE reduction (clearance is on the bin side)
      const cellW_mm = cell.widthUnits * gridUnitMm;
      const cellD_mm = cell.depthUnits * gridUnitMm;
      const pocket = getPocketTemplate(cellW_mm, cellD_mm, forExport, throughCut);
      pockets.push(translate(pocket, [cell.centerX, cell.centerY, 0]));
    },
    cellOpts
  );

  if (pockets.length > 0) {
    baseplate = unwrap(cutAll(baseplate, pockets));
  }

  onProgress?.(0.6);

  // 3. Cut magnet holes from the bottom
  if (magnetHoles) {
    const holes = buildMagnetHoles(width, depth, magnetDiameter / 2, magnetDepth, cellOpts);
    if (holes.length > 0) {
      baseplate = unwrap(cutAll(baseplate, holes));
    }
  }

  // 4. Shift up so bottom face sits at Z=0, matching the bin convention
  // (pockets open at Z=totalHeight, bottom at Z=0)
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
