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
  drawCircle,
  unwrap,
  cutAll,
  clone,
  translate,
  mesh,
  meshEdges,
  exportSTL,
  exportSTEP,
} from 'brepjs';
import type { Shape3D, Sketch } from 'brepjs';
import type { BaseplateParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';
import {
  SIZE,
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
import type { ProgressFn } from './generatorTypes';
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

function pocketCacheKey(
  cellW: number,
  cellD: number,
  forExport: boolean,
  throughCut: boolean
): string {
  return `${cellW}|${cellD}|${forExport}|${throughCut}`;
}

// ─── Pocket Builders ────────────────────────────────────────────────────────

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
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  // Insets at each Z breakpoint — same taper profile as bin socket
  // but starting from the full cell size (no CLEARANCE reduction)
  const INSET_TOP = 0;
  const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

  // Z positions — extends above Z=0 to avoid coplanar boolean failures
  const Z0 = 1; // above block top face
  const Z1 = 0;
  const Z2 = -(CLEARANCE / 2); // -0.25
  const Z3 = -SOCKET_BIG_TAPER; // -2.4
  const Z4 = -(SOCKET_BIG_TAPER + (SOCKET_HEIGHT - SOCKET_TAPER_WIDTH)); // -4.2
  const Z5 = -SOCKET_HEIGHT; // -5.0
  // When throughCut, extend below block bottom to avoid coplanar faces
  const Z6 = throughCut ? -SOCKET_HEIGHT - 1 : NaN;

  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  const s0 = sectionAt(Z0, INSET_TOP); // extends above block
  const s1 = sectionAt(Z1, INSET_TOP);
  const s2 = sectionAt(Z2, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_MID);
  const s4 = sectionAt(Z4, INSET_MID);
  const s5 = sectionAt(Z5, INSET_BOT);

  const sections = [s1, s2, s3, s4, s5];
  if (throughCut) {
    sections.push(sectionAt(Z6, INSET_BOT));
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
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  const INSET_TOP = 0;
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2;

  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as Sketch;
  };

  const s0 = sectionAt(1, INSET_TOP); // above block
  const s1 = sectionAt(-SOCKET_HEIGHT, INSET_BOT);
  // Extend below block bottom to avoid coplanar boolean failures
  const sections = throughCut ? [s1, sectionAt(-SOCKET_HEIGHT - 1, INSET_BOT)] : [s1];

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
  magnetDepth: number
): Shape3D[] {
  const totalHeight = SOCKET_HEIGHT + BASE_THICKNESS;
  const HOLE_OFFSET = 13; // mm from cell center

  const holeOffsets: ReadonlyArray<readonly [number, number]> = [
    [-HOLE_OFFSET, -HOLE_OFFSET],
    [-HOLE_OFFSET, HOLE_OFFSET],
    [HOLE_OFFSET, HOLE_OFFSET],
    [HOLE_OFFSET, -HOLE_OFFSET],
  ];

  // Build one template cylinder, clone for each position
  const magnetTemplate = sketch(drawCircle(magnetRadius), 'XY', -totalHeight).extrude(magnetDepth);

  const holes: Shape3D[] = [];
  forEachCell(gridW, gridD, (cell) => {
    // Only place holes in full-size cells
    if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

    for (const [dx, dy] of holeOffsets) {
      holes.push(translate(clone(magnetTemplate), [cell.centerX + dx, cell.centerY + dy, 0]));
    }
  });

  return holes;
}

// ─── Public API ─────────────────────────────────────────────────────────────

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

  const baseplate = buildBaseplateSolid(params, forExport, (progress) => {
    onProgress('base', progress);
    checkCancelled(signal);
  });

  onProgress('base', 0.9);
  checkCancelled(signal);

  // Tessellate
  const tolerance = forExport ? 0.01 : 0.1;
  const angularTolerance = forExport ? 5 : 20;
  const meshResult = mesh(baseplate, { tolerance, angularTolerance });
  const edgeMesh = forExport ? null : meshEdges(baseplate, { tolerance });
  const edgeVerts = edgeMesh ? new Float32Array(edgeMesh.lines) : new Float32Array(0);

  onProgress('base', 1);

  return toIndexedMeshData(meshResult, false, edgeVerts);
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
  const { width, depth, magnetHoles, magnetDiameter, magnetDepth, paddingMm } = params;

  // 1. Build solid block — only add BASE_THICKNESS when magnets need a floor
  const totalW = width * SIZE + 2 * paddingMm;
  const totalD = depth * SIZE + 2 * paddingMm;
  const totalHeight = magnetHoles ? SOCKET_HEIGHT + BASE_THICKNESS : SOCKET_HEIGHT;
  const maxRadius = Math.min(totalW, totalD) / 2 - 0.1;
  const cornerR = Math.min(PLATE_CORNER_RADIUS, maxRadius);

  const profile = drawRoundedRectangle(totalW, totalD, cornerR);
  let baseplate: Shape3D = (
    profile.sketchOnPlane('XY', 0) as { extrude: (h: number) => Shape3D }
  ).extrude(-totalHeight);

  onProgress?.(0.2);

  // 2. Build pocket cutters using template cloning (one loft per unique cell size)
  // When no magnets, pockets cut all the way through (throughCut)
  const throughCut = !magnetHoles;
  const pockets: Shape3D[] = [];
  forEachCell(width, depth, (cell) => {
    // Full cell size — no CLEARANCE reduction (clearance is on the bin side)
    const cellW_mm = cell.widthUnits * SIZE;
    const cellD_mm = cell.depthUnits * SIZE;
    const pocket = getPocketTemplate(cellW_mm, cellD_mm, forExport, throughCut);
    pockets.push(translate(pocket, [cell.centerX, cell.centerY, 0]));
  });

  if (pockets.length > 0) {
    baseplate = unwrap(cutAll(baseplate, pockets));
  }

  onProgress?.(0.6);

  // 3. Cut magnet holes from the bottom
  if (magnetHoles) {
    const holes = buildMagnetHoles(width, depth, magnetDiameter / 2, magnetDepth);
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
  const baseplate = buildBaseplateSolid(params);
  const name = `baseplate_${params.width}x${params.depth}`;

  if (format === 'step') {
    const blob = unwrap(exportSTEP(baseplate));
    const data = await blob.arrayBuffer();
    return { data, fileName: `${name}.step` };
  }

  // STL export
  const blob = unwrap(
    exportSTL(baseplate, {
      tolerance: tolerance ?? 0.01,
      angularTolerance: angularTolerance ?? 5,
      binary: true,
    })
  );
  const data = await blob.arrayBuffer();

  return { data, fileName: `${name}.stl` };
}
