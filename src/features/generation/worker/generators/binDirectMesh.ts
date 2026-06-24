/**
 * Direct mesh generation for Gridfinity bins (instant draft preview).
 *
 * Emits bin geometry procedurally — vertices and triangles computed
 * mathematically — without the brepjs B-rep kernel (solid modelling, boolean
 * fuse/cut, tessellation). This is the bin-side counterpart to
 * `baseplateDirectMesh.ts`: it runs synchronously on the main thread so the
 * designer can paint a draft in <50ms while the worker computes the exact
 * B-rep mesh that replaces it. The export path is untouched (full B-rep).
 *
 * Scope (first slice): the common rectangular bin — hollow body, optional
 * stacking lip, and the per-cell tapered gridfinity feet. Anything the
 * procedural path can't render faithfully (compartments, scoops, label tabs,
 * wall cutouts, handles, cutouts, inserts, wall patterns, lids, custom masks,
 * overhang, magnet/screw holes, non-standard base/body styles) forces a
 * fallback via `canBinUseDirectMesh` — a draft that silently dropped a visible
 * feature would be a regression, so the gate is an allowlist.
 *
 * Coordinate system (matches the exact mesh after `translateStage`):
 * - Z=0: foot underside (absolute bottom).
 * - Z=SOCKET_HEIGHT: foot top / socket interface (mates with the body).
 * - Z=SOCKET_HEIGHT + wallThickness: interior cavity floor.
 * - Z=totalHeight (= SOCKET_HEIGHT + wallHeight): body wall top.
 * - With a lip: the outer wall extends to totalHeight + LIP_HEIGHT − LIP_OVERLAP.
 * - XY centered at the origin; per-cell feet are CLEARANCE smaller than the
 *   nominal cell so they seat in a baseplate pocket.
 */

import type { BinParams } from '@/shared/types/bin';
import { CONSTRAINTS } from '@/core/constants';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { MeshData } from '../../bridge/types';
import type { ProgressFn } from './meshUtils';
import { MeshBuilder, CORNER_SEGMENTS } from './directMeshBuilder';
import { roundedRectPoints } from './directMeshShapes';
import { addOuterWalls } from './directMeshWalls';
import { creaseEdges } from './utils/creaseEdges';
import { forEachCell } from './cellDecomposition';
import {
  SIZE,
  HEIGHT_UNIT,
  CLEARANCE,
  CORNER_RADIUS,
  BOX_CORNER_RADIUS,
  SOCKET_HEIGHT,
  SOCKET_TAPER_WIDTH,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  LIP_OVERLAP,
  MIN_PRINTABLE_TILE_MM,
} from './generatorConstants';

type Pt = readonly [number, number];

/** Smallest ring half-dimension we keep; below this the rounded-rect sampler
 *  collapses to sharp corners and the top/bottom rings stop matching. */
const MIN_RING_DIM = 0.5;

/** Inset of the foot bottom ring from the cell edge — matches `socketBuilder`'s
 *  simplified (preview) profile so the draft lines up with the on-screen exact. */
const FOOT_BOTTOM_INSET = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

function abortIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('Generation cancelled');
}

/**
 * Tapered tube between an upper ring (`topPts` @ `zTop`) and a lower ring
 * (`botPts` @ `zBot`). The two rings must have the same vertex count. `outward`
 * selects the winding so face normals point away from (`cx`,`cy`) for exterior
 * walls/feet, or toward the axis for interior cavity/lip walls. Ring vertices
 * are shared across adjacent quads so `computeVertexNormals` smooths the rounded
 * corners while the crease threshold keeps arc→flat transitions crisp.
 */
function addTaperedTube(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  topPts: readonly Pt[],
  botPts: readonly Pt[],
  zTop: number,
  zBot: number,
  outward: boolean
): void {
  const n = topPts.length;
  const topRing = new Array<number>(n);
  const botRing = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    topRing[i] = mb.pushVertex(topPts[i][0] + cx, topPts[i][1] + cy, zTop, 0, 0, 0);
    botRing[i] = mb.pushVertex(botPts[i][0] + cx, botPts[i][1] + cy, zBot, 0, 0, 0);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (outward) {
      mb.pushQuad(topRing[i], topRing[j], botRing[j], botRing[i]);
    } else {
      mb.pushQuad(topRing[j], topRing[i], botRing[i], botRing[j]);
    }
  }
}

/** Solid disc/cap over one ring at height `z`, facing +Z (`faceUp`) or −Z. */
function addSolidCap(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  pts: readonly Pt[],
  z: number,
  faceUp: boolean
): void {
  const nz = faceUp ? 1 : -1;
  const center = mb.pushVertex(cx, cy, z, 0, 0, nz);
  const verts = pts.map((p) => mb.pushVertex(p[0] + cx, p[1] + cy, z, 0, 0, nz));
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (faceUp) mb.pushTriangle(center, verts[i], verts[j]);
    else mb.pushTriangle(center, verts[j], verts[i]);
  }
}

/**
 * Flat annulus between an outer ring and an inner ring at the same height `z`.
 * Both rings must share a vertex count. `faceUp` selects the normal direction.
 */
function addRingCap(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  outerPts: readonly Pt[],
  innerPts: readonly Pt[],
  z: number,
  faceUp: boolean
): void {
  const nz = faceUp ? 1 : -1;
  const n = outerPts.length;
  const outer = new Array<number>(n);
  const inner = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    outer[i] = mb.pushVertex(outerPts[i][0] + cx, outerPts[i][1] + cy, z, 0, 0, nz);
    inner[i] = mb.pushVertex(innerPts[i][0] + cx, innerPts[i][1] + cy, z, 0, 0, nz);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (faceUp) mb.pushQuad(outer[i], outer[j], inner[j], inner[i]);
    else mb.pushQuad(outer[i], inner[i], inner[j], outer[j]);
  }
}

/** Clamp a cell-socket corner radius to fit the cell and stay in the rounded
 *  sampler regime (so every ring has the same vertex count). */
function footCornerRadius(cellW: number, cellD: number): number {
  return Math.max(Math.min(CORNER_RADIUS, Math.min(cellW, cellD) / 2 - 0.1), 0.1);
}

/**
 * One gridfinity foot: a closed tapered frustum from the cell footprint at
 * Z=SOCKET_HEIGHT down to the inset bottom ring at Z=0. Built as its own closed
 * solid; its top cap sits coincident with the body's bottom cap (an interior,
 * non-visible join) so the overlap never z-fights.
 */
function addBaseFoot(mb: MeshBuilder, cx: number, cy: number, cellW: number, cellD: number): void {
  const cornerR = footCornerRadius(cellW, cellD);
  const botW = Math.max(cellW - 2 * FOOT_BOTTOM_INSET, MIN_RING_DIM);
  const botD = Math.max(cellD - 2 * FOOT_BOTTOM_INSET, MIN_RING_DIM);
  const botR = Math.max(cornerR - FOOT_BOTTOM_INSET, 0.1);

  const topPts = roundedRectPoints(cellW, cellD, cornerR, CORNER_SEGMENTS);
  const botPts = roundedRectPoints(botW, botD, botR, CORNER_SEGMENTS);

  addTaperedTube(mb, cx, cy, topPts, botPts, SOCKET_HEIGHT, 0, true);
  addSolidCap(mb, cx, cy, botPts, 0, false); // underside
  addSolidCap(mb, cx, cy, topPts, SOCKET_HEIGHT, true); // interface with body
}

interface BinBodyDims {
  readonly outerW: number;
  readonly outerD: number;
  readonly wallThickness: number;
  readonly totalHeight: number;
  readonly hasLip: boolean;
}

/**
 * The hollow bin body: outer walls (rising from the socket interface), a closed
 * bottom slab, the interior cavity walls + floor, and either a flat top rim
 * (no lip) or a tapered stacking-lip collar.
 */
function addBinBody(mb: MeshBuilder, dims: BinBodyDims): void {
  const { outerW, outerD, wallThickness, totalHeight, hasLip } = dims;

  const innerW = Math.max(outerW - 2 * wallThickness, MIN_RING_DIM);
  const innerD = Math.max(outerD - 2 * wallThickness, MIN_RING_DIM);
  const innerR = Math.max(BOX_CORNER_RADIUS - wallThickness, 0.1);

  const outerPts = roundedRectPoints(outerW, outerD, BOX_CORNER_RADIUS, CORNER_SEGMENTS);
  const innerPts = roundedRectPoints(innerW, innerD, innerR, CORNER_SEGMENTS);

  const zBodyBot = SOCKET_HEIGHT;
  const zFloorTop = SOCKET_HEIGHT + wallThickness;
  const zWallTop = totalHeight; // = SOCKET_HEIGHT + wallHeight
  const zOuterTop = hasLip ? totalHeight + LIP_HEIGHT - LIP_OVERLAP : zWallTop;

  // Outer wall: flush from the socket interface up to the wall top (or lip peak).
  addOuterWalls(mb, outerPts, 0, 0, zOuterTop, zBodyBot);
  // Closed underside at the socket interface (the foot top caps overlap here,
  // hidden inside the join — no visible coincident faces).
  addSolidCap(mb, 0, 0, outerPts, zBodyBot, false);
  // Interior cavity wall (vertical, inward-facing) from the floor to the rim.
  addTaperedTube(mb, 0, 0, innerPts, innerPts, zWallTop, zFloorTop, false);
  // Interior floor.
  addSolidCap(mb, 0, 0, innerPts, zFloorTop, true);

  if (!hasLip) {
    // Flat rim ring closing the wall top between the outer and inner edges.
    addRingCap(mb, 0, 0, outerPts, innerPts, zWallTop, true);
    return;
  }

  // Stacking lip: the outer face is flush (already extended to the peak). The
  // lip's inner profile starts inset by LIP_TAPER_WIDTH at the rim and tapers
  // back to flush at the peak, where it meets the outer wall in a sharp ridge.
  // The inner inset can't sit outside the cavity wall — when wallThickness
  // reaches LIP_TAPER_WIDTH (2.6mm is a valid wall option) the lip base lands
  // on the cavity edge and the overhang vanishes, so clamp to wallThickness to
  // avoid an inverted/zero-area underside ring (matches the exact path, which
  // can't overhang past its own wall either).
  const lipInnerInset = Math.max(LIP_TAPER_WIDTH, wallThickness);
  const lipBaseW = Math.max(outerW - 2 * lipInnerInset, MIN_RING_DIM);
  const lipBaseD = Math.max(outerD - 2 * lipInnerInset, MIN_RING_DIM);
  const lipBaseR = Math.max(BOX_CORNER_RADIUS - lipInnerInset, 0.1);
  const lipBasePts = roundedRectPoints(lipBaseW, lipBaseD, lipBaseR, CORNER_SEGMENTS);

  // Underside of the lip overhang: from the cavity edge (inset wallThickness)
  // inward to the lip base (inset lipInnerInset), facing down into the cavity.
  // Skipped when there's no real overhang (lip base on the cavity edge).
  if (lipInnerInset > wallThickness + 1e-3) {
    addRingCap(mb, 0, 0, innerPts, lipBasePts, zWallTop, false);
  }
  // Lip inner taper rising from the base ring to the flush peak.
  addTaperedTube(mb, 0, 0, outerPts, lipBasePts, zOuterTop, zWallTop, false);
}

/**
 * Generate bin draft mesh data procedurally, without the B-rep kernel.
 *
 * Caller must gate with {@link canBinUseDirectMesh} first; this still validates
 * and throws on degenerate input so the caller can fall back to the async path.
 */
export function generateBinDirect(
  params: BinParams,
  onProgress?: ProgressFn,
  signal?: AbortSignal
): MeshData {
  const { width, depth, height } = params;
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(depth) ||
    depth <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new Error(`Invalid bin dimensions: ${width}x${depth}x${height}`);
  }
  if (width > CONSTRAINTS.GRID_MAX || depth > CONSTRAINTS.GRID_MAX) {
    throw new Error(`Bin dimensions ${width}x${depth} exceed maximum ${CONSTRAINTS.GRID_MAX}`);
  }

  onProgress?.('base', 0);
  abortIfCancelled(signal);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- legacy designs may lack gridUnitMm/heightUnitMm
  const gridUnit = params.gridUnitMm ?? SIZE;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- legacy designs may lack heightUnitMm
  const heightUnit = params.heightUnitMm ?? HEIGHT_UNIT;
  const totalHeight = height * heightUnit;

  const mb = new MeshBuilder();

  addBinBody(mb, {
    outerW: width * gridUnit - CLEARANCE,
    outerD: depth * gridUnit - CLEARANCE,
    wallThickness: params.wallThickness,
    totalHeight,
    hasLip: params.base.stackingLip,
  });

  onProgress?.('base', 0.5);
  abortIfCancelled(signal);

  // Per-cell feet — replicates `socketBuilder`'s non-mask cell walk (half
  // sockets, or fractional feet dropping sub-printable slivers) so foot count
  // and placement match the exact path bit-for-bit. Masked bins fall back.
  const footOpts = params.base.halfSockets
    ? ({ halfSockets: true, gridUnitMm: gridUnit } as const)
    : ({
        gridUnitMm: gridUnit,
        fractional: true,
        minFractionUnits: MIN_PRINTABLE_TILE_MM / gridUnit,
        fractionalEdgeX: params.fractionalEdgeX,
        fractionalEdgeY: params.fractionalEdgeY,
      } as const);

  forEachCell(
    width,
    depth,
    (cell) => {
      addBaseFoot(
        mb,
        cell.centerX,
        cell.centerY,
        cell.widthUnits * gridUnit - CLEARANCE,
        cell.depthUnits * gridUnit - CLEARANCE
      );
    },
    footOpts
  );

  onProgress?.('base', 0.9);
  abortIfCancelled(signal);

  const built = mb.build();
  // Recover OCCT-style feature edges from the assembled mesh so the draft gets
  // the same crisp edge overlay as the BREP render (the builder omits edges).
  const result: MeshData = {
    ...built,
    edgeVertices: creaseEdges({ vertices: built.vertices, triangles: built.indices }),
  };
  onProgress?.('base', 1);
  return result;
}

/**
 * Base styles the direct path renders faithfully. magnet/screw/magnet_and_screw
 * only differ from standard by holes on the (camera-invisible) foot underside,
 * so they share the solid-foot draft; flat/weighted change the visible base.
 */
const DIRECT_MESH_BASE_STYLES: ReadonlySet<BinParams['base']['style']> = new Set([
  'standard',
  'magnet',
  'screw',
  'magnet_and_screw',
]);

/**
 * Whether `generateBinDirect` can faithfully render `params`. This is an
 * allowlist: it returns true only for the rectangular bins the direct path
 * covers (hollow body, optional lip, plain feet) and falls back for every
 * feature the procedural path does not yet emit. Erring toward fallback keeps a
 * dropped feature from ever reaching the screen — a fallback only costs the
 * instant draft, never correctness.
 */
export function canBinUseDirectMesh(params: BinParams): boolean {
  const { base } = params;

  // Base style: magnet/screw/magnet_and_screw share the same body + feet as
  // standard — they only add holes to the foot UNDERSIDE, which the preview
  // camera never sees (and which the exact mesh fills in on the swap, exactly
  // as the baseplate draft leaves its own magnet holes for the exact pass). So
  // they ride the direct path with solid feet. `flat` (no socket — different Z
  // model) and `weighted` (internal weight cavity) genuinely differ.
  // Explicit ALLOWLIST so a future base style defaults to fallback, not to a
  // silently-wrong draft.
  if (!DIRECT_MESH_BASE_STYLES.has(base.style)) return false;
  if (base.solid || base.lightweight) return false;

  // Body style: slotted/solid change the walls and floor.
  if (params.style !== 'standard') return false;

  // Interior features.
  if (params.compartments.cols !== 1 || params.compartments.rows !== 1) return false;
  if (params.scoop.enabled) return false;
  if (params.label.enabled) return false;
  if (params.walls.enabled) return false;
  if (params.handles.enabled) return false;
  // slotConfig is inert unless the body style is 'slotted' (already rejected
  // above), so it needs no separate gate — and it defaults to x.enabled = true.
  if (params.inserts.length > 0) return false;
  if (params.cutouts.length > 0) return false;
  if (params.wallPattern.enabled) return false;
  if (params.lid.enabled) return false;

  // Footprint / placement modifiers.
  if (isPartialMask(params.cellMask)) return false;
  if (params.splitConnectors?.enabled) return false;
  const ov = params.overhang;
  if (ov && (ov.feet || ov.left > 0 || ov.right > 0 || ov.front > 0 || ov.back > 0)) {
    return false;
  }

  return true;
}
