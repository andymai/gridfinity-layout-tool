/**
 * Gridfinity bin generator using Replicad (OpenCascade WASM).
 *
 * Architecture follows the official Replicad Gridfinity example:
 * 1. buildBaseSocket() — Per-cell segmented sockets (full 42mm + half 21mm cells)
 * 2. buildBinBox() — Rounded rect extruded + shelled (walls + floor)
 * 3. buildTopShape() — Swept stacking lip profile around perimeter
 * 4. Features: dividers, inserts, magnet/screw holes via booleans
 *
 * Coordinate system:
 * - Z=0: bin floor level (where box meets socket)
 * - Socket: Z=-SOCKET_HEIGHT to Z=0
 * - Box body: Z=0 to Z=wallHeight
 * - Final mesh translated up by SOCKET_HEIGHT so Z=0 = absolute bottom
 */

import { draw, drawRoundedRectangle, drawCircle, drawRectangle } from 'replicad';
import type { Solid, Shape3D, Sketch, Plane, Point } from 'replicad';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData, ExportFormat } from '../../bridge/types';
import { GRIDFINITY } from '@/shared/constants/bin';

/** Progress callback for reporting generation stages */
export type ProgressFn = (stage: string, progress: number) => void;

// ─── Gridfinity Socket Constants ──────────────────────────────────────────────

const SIZE = GRIDFINITY.GRID_SIZE;
const CLEARANCE = GRIDFINITY.TOLERANCE;
const CORNER_RADIUS = GRIDFINITY.SOCKET_CORNER_RADIUS;
const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;
const SOCKET_SMALL_TAPER = GRIDFINITY.SOCKET_SMALL_TAPER;
const SOCKET_BIG_TAPER = GRIDFINITY.SOCKET_BIG_TAPER;
const SOCKET_VERTICAL_PART = SOCKET_HEIGHT - SOCKET_SMALL_TAPER - SOCKET_BIG_TAPER;
const SOCKET_TAPER_WIDTH = SOCKET_SMALL_TAPER + SOCKET_BIG_TAPER;
const AXIS_CLEARANCE = (CLEARANCE * Math.sqrt(2)) / 4;
const TOP_FILLET = GRIDFINITY.TOP_FILLET;

// ─── Stacking Lip Constants (per spec v5) ─────────────────────────────────────

const LIP_SMALL_TAPER = GRIDFINITY.LIP_SMALL_TAPER; // 0.7mm bottom chamfer
const LIP_VERTICAL_PART = GRIDFINITY.LIP_VERTICAL_PART; // 1.8mm vertical
const LIP_BIG_TAPER = GRIDFINITY.LIP_BIG_TAPER; // 1.9mm top chamfer
const LIP_HEIGHT = LIP_SMALL_TAPER + LIP_VERTICAL_PART + LIP_BIG_TAPER; // 4.4mm total
const LIP_TAPER_WIDTH = LIP_SMALL_TAPER + LIP_BIG_TAPER; // 2.6mm horizontal inset

// ─── Socket Builder ───────────────────────────────────────────────────────────

/**
 * Decompose a grid dimension (in units) into an array of cell sizes (in units).
 * Full cells are 1.0 unit; a trailing half-cell is 0.5 unit.
 *
 * Examples:
 *   2.0 → [1, 1]
 *   1.5 → [1, 0.5]
 *   0.5 → [0.5]
 *   3.0 → [1, 1, 1]
 */
function decomposeCells(gridUnits: number): number[] {
  const fullCells = Math.floor(gridUnits);
  const hasHalf = gridUnits - fullCells >= 0.5 - 1e-10;
  const cells: number[] = Array(fullCells).fill(1);
  if (hasHalf) cells.push(0.5);
  return cells;
}

/** Cell position info for iteration */
interface CellInfo {
  /** Cell size in grid units (1 or 0.5) */
  readonly widthUnits: number;
  readonly depthUnits: number;
  /** Cell center position in mm (relative to bin center) */
  readonly centerX: number;
  readonly centerY: number;
}

/**
 * Iterate over all cells in a grid, calling the callback with cell info.
 * Encapsulates the common pattern of nested cell iteration with position tracking.
 */
function forEachCell(gridW: number, gridD: number, callback: (cell: CellInfo) => void): void {
  const cellsW = decomposeCells(gridW);
  const cellsD = decomposeCells(gridD);
  const totalW_mm = gridW * SIZE;
  const totalD_mm = gridD * SIZE;

  let xOffset = 0;
  for (const cellW_units of cellsW) {
    const centerX = xOffset + (cellW_units * SIZE) / 2 - totalW_mm / 2;
    let yOffset = 0;

    for (const cellD_units of cellsD) {
      const centerY = yOffset + (cellD_units * SIZE) / 2 - totalD_mm / 2;

      callback({
        widthUnits: cellW_units,
        depthUnits: cellD_units,
        centerX,
        centerY,
      });

      yOffset += cellD_units * SIZE;
    }
    xOffset += cellW_units * SIZE;
  }
}

/**
 * Build a single socket cell solid at the origin using multi-section loft.
 *
 * The socket is a frustum-like solid whose cross-section shrinks with depth,
 * following the standard Gridfinity tapered profile. Built as a ruled loft
 * through 5 sections corresponding to the profile breakpoints:
 *   Z=0:     outer boundary (top face, mates with bin body)
 *   Z=-0.25: same as top (vertical clearance step)
 *   Z=-2.4:  inset by 2.15mm (end of big taper)
 *   Z=-4.2:  same inset (vertical wall section)
 *   Z=-5.0:  inset by 2.95mm (end of small taper, bottom face)
 *
 * This approach avoids EdgeFinder limitations with non-square cells.
 *
 * @param cellW_mm Physical width of this cell in mm (after clearance)
 * @param cellD_mm Physical depth of this cell in mm (after clearance)
 */
function buildSingleCellSocket(cellW_mm: number, cellD_mm: number): Shape3D {
  // Clamp corner radius to fit within cell dimensions
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  // Profile insets from outer boundary at each Z breakpoint
  // (derived from socketProfile after translate(CLEARANCE/2, 0))
  const INSET_TOP = 0;
  const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

  // Z positions of profile breakpoints
  const Z1 = 0;
  const Z2 = -(CLEARANCE / 2); // -0.25
  const Z3 = -SOCKET_BIG_TAPER; // -2.4
  const Z4 = -(SOCKET_BIG_TAPER + SOCKET_VERTICAL_PART); // -4.2
  const Z5 = -SOCKET_HEIGHT; // -5.0

  // Helper to create a rounded rect sketch at a given Z with a given inset
  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as unknown as Sketch;
  };

  // Build 5 cross-sections matching the socket profile breakpoints
  const s1 = sectionAt(Z1, INSET_TOP);
  const s2 = sectionAt(Z2, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_MID);
  const s4 = sectionAt(Z4, INSET_MID);
  const s5 = sectionAt(Z5, INSET_BOT);

  // Ruled loft through all sections — straight-line connections between
  // corresponding points, matching the angular profile exactly
  return s1.loftWith([s2, s3, s4, s5], { ruled: true }) as Shape3D;
}

/**
 * Build a simplified 3-section socket cell for preview rendering.
 *
 * Uses only 3 sections (top, mid, bottom) instead of the full 5-section
 * profile. Visually similar but generates fewer triangles for faster
 * preview updates. Export mode uses buildSingleCellSocket for full fidelity.
 */
function buildSimplifiedCellSocket(cellW_mm: number, cellD_mm: number): Shape3D {
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  const INSET_TOP = 0;
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2;

  const Z1 = 0;
  const Z3 = -SOCKET_HEIGHT;

  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as unknown as Sketch;
  };

  const s1 = sectionAt(Z1, INSET_TOP);
  const s3 = sectionAt(Z3, INSET_BOT);

  return s1.loftWith([s3], { ruled: true }) as Shape3D;
}

/**
 * Build the segmented base socket grid for the bin.
 *
 * Decomposes the bin footprint into per-cell sockets (full 42mm or half 21mm cells),
 * each with the standard Gridfinity tapered profile. This ensures proper baseplate
 * interface for any half-bin dimension.
 *
 * Magnet/screw holes are placed only in full-size (1.0 × 1.0 unit) cells where
 * they physically fit.
 *
 * @param forExport If true, uses full 5-section socket profile. Preview uses 3-section.
 */
function buildBaseSocket(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport = false
): Shape3D {
  // Build and position each cell socket
  let baseSocket: Shape3D | null = null;

  forEachCell(gridW, gridD, (cell) => {
    const cellW_mm = cell.widthUnits * SIZE - CLEARANCE;
    const cellD_mm = cell.depthUnits * SIZE - CLEARANCE;
    // Use simplified 3-section socket for preview, full 5-section for export
    const cellSocket = (
      forExport
        ? buildSingleCellSocket(cellW_mm, cellD_mm)
        : buildSimplifiedCellSocket(cellW_mm, cellD_mm)
    ).translate([cell.centerX, cell.centerY, 0]);
    baseSocket = baseSocket ? baseSocket.fuse(cellSocket) : cellSocket;
  });

  // baseSocket is guaranteed to be defined for valid grid dimensions (gridW >= 1, gridD >= 1)
  if (!baseSocket) {
    throw new Error('Invalid grid dimensions: at least one cell required');
  }
  let result: Shape3D = baseSocket;

  // Cut magnet/screw holes only in full-size (1.0 × 1.0 unit) cells
  if (withScrew || withMagnet) {
    const HOLE_OFFSET = 13; // mm from cell center to hole center

    const magnetCutout = withMagnet
      ? ((drawCircle(magnetRadius).sketchOnPlane() as unknown as Sketch).extrude(
          magnetDepth
        ) as Shape3D)
      : null;
    const screwCutout = withScrew
      ? ((drawCircle(screwRadius).sketchOnPlane() as unknown as Sketch).extrude(
          SOCKET_HEIGHT
        ) as Shape3D)
      : null;

    const cutout: Shape3D =
      magnetCutout && screwCutout
        ? magnetCutout.fuse(screwCutout)
        : ((magnetCutout || screwCutout) as Shape3D);

    // 4 holes per full cell at ±HOLE_OFFSET from center (hoisted to avoid repeated allocation)
    const holeOffsets: ReadonlyArray<readonly [number, number]> = [
      [-HOLE_OFFSET, -HOLE_OFFSET],
      [-HOLE_OFFSET, HOLE_OFFSET],
      [HOLE_OFFSET, HOLE_OFFSET],
      [HOLE_OFFSET, -HOLE_OFFSET],
    ];

    forEachCell(gridW, gridD, (cell) => {
      // Only cut holes in full-size cells
      if (cell.widthUnits < 1 || cell.depthUnits < 1) return;

      for (const [dx, dy] of holeOffsets) {
        result = result.cut(
          cutout.clone().translate([cell.centerX + dx, cell.centerY + dy, -SOCKET_HEIGHT])
        );
      }
    });
  }

  return result;
}

// ─── Box Body Builder ─────────────────────────────────────────────────────────

/**
 * Build the bin box: a rounded-rectangle extrusion, shelled from the top.
 * The box starts at Z=0 (socket interface) and goes up to wallHeight.
 * Shell removes the top face, leaving walls + solid floor.
 */
function buildBinBox(
  gridW: number,
  gridD: number,
  wallHeight: number,
  wallThickness: number,
  keepFull: boolean
): Shape3D {
  const outerW = gridW * SIZE - CLEARANCE;
  const outerD = gridD * SIZE - CLEARANCE;

  let box = (
    drawRoundedRectangle(outerW, outerD, CORNER_RADIUS).sketchOnPlane() as unknown as Sketch
  ).extrude(wallHeight) as Shape3D;

  if (!keepFull) {
    box = box.shell(wallThickness, (f) => f.inPlane('XY', wallHeight));
  }

  return box;
}

// ─── Top Shape (Stacking Lip) Builder ─────────────────────────────────────────

/**
 * Build the stacking lip at the top of the bin.
 *
 * The lip provides the mating interface that allows bins to stack.
 * Profile per Gridfinity spec v5: 0.7mm + 1.8mm + 1.9mm = 4.4mm total height.
 * The profile sweeps around the bin perimeter, then gets filleted at the peak.
 *
 * Profile traces (in XZ plane, X=outward, Z=up):
 *   Lip taper shape upward (mates with socket cavity when stacked)
 *   + wall extension downward (if includeLip, replaces top wall section)
 *
 * Built at Z=0 locally, caller translates to wallHeight.
 */
function buildTopShape(
  gridW: number,
  gridD: number,
  includeLip: boolean,
  wallThickness: number
): Shape3D {
  const outerW = gridW * SIZE - CLEARANCE;
  const outerD = gridD * SIZE - CLEARANCE;

  const topProfile = (_plane: Plane, _startPoint: Point): Sketch => {
    // Draw the lip profile (going upward from the sweep path)
    // Per spec: 0.7mm bottom chamfer, 1.8mm vertical, 1.9mm top chamfer
    let sketcher = draw([-LIP_TAPER_WIDTH, 0])
      .line(LIP_SMALL_TAPER, LIP_SMALL_TAPER)
      .vLine(LIP_VERTICAL_PART)
      .line(LIP_BIG_TAPER, LIP_BIG_TAPER);

    if (includeLip) {
      // Extend wall downward to replace top wall section
      sketcher = sketcher
        .vLineTo(-(LIP_TAPER_WIDTH + wallThickness))
        .lineTo([-LIP_TAPER_WIDTH, -wallThickness]);
    } else {
      sketcher = sketcher.vLineTo(0);
    }

    const basicShape = sketcher.close();

    // Apply clearance shifts and clip to valid region
    const shiftedShape = basicShape
      .translate(AXIS_CLEARANCE, -AXIS_CLEARANCE)
      .intersect(drawRoundedRectangle(10, 10).translate(-5, includeLip ? 0 : 5));

    // Shave off the clearance
    let topProfileShape = shiftedShape
      .translate(CLEARANCE / 2, 0)
      .intersect(drawRoundedRectangle(10, 10).translate(-5, 0));

    if (includeLip) {
      // Remove the wall portion that the lip replaces
      topProfileShape = topProfileShape.cut(
        drawRoundedRectangle(wallThickness, 10).translate(-wallThickness / 2, -5)
      );
    }

    return topProfileShape.sketchOnPlane('XZ', _startPoint) as unknown as Sketch;
  };

  // Sweep around the bin perimeter (built at Z=0, caller translates)
  const boxSketch = drawRoundedRectangle(
    outerW,
    outerD,
    CORNER_RADIUS
  ).sketchOnPlane() as unknown as Sketch;

  return boxSketch
    .sweepSketch(topProfile, { withContact: true })
    .fillet(TOP_FILLET, (e) =>
      e.inBox(
        [-gridW * SIZE, -gridD * SIZE, LIP_HEIGHT],
        [gridW * SIZE, gridD * SIZE, LIP_HEIGHT - 1]
      )
    );
}

// ─── Feature Builders ─────────────────────────────────────────────────────────

/**
 * Add a wall segment to the dividers, fusing if needed.
 */
function addWallSegment(
  dividers: Shape3D | null,
  w: number,
  d: number,
  height: number,
  x: number,
  y: number
): Shape3D {
  const wall = (drawRectangle(w, d).sketchOnPlane('XY') as unknown as Sketch).extrude(
    height
  ) as Shape3D;
  const positioned = wall.translate([x, y, 0]);
  return dividers ? dividers.fuse(positioned) : positioned;
}

/**
 * Find consecutive wall segments along a boundary line.
 * Returns array of [start, end) index pairs where walls are needed.
 */
function findWallSegments(
  count: number,
  needsWall: (i: number) => boolean
): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let segStart: number | null = null;

  for (let i = 0; i < count; i++) {
    if (needsWall(i)) {
      if (segStart === null) segStart = i;
    } else if (segStart !== null) {
      segments.push([segStart, i]);
      segStart = null;
    }
  }
  if (segStart !== null) {
    segments.push([segStart, count]);
  }
  return segments;
}

/**
 * Build compartment divider walls inside the bin.
 *
 * Uses the compartment grid to derive wall segments: walls appear at
 * boundaries between cells with different compartment IDs. This supports
 * non-uniform compartment layouts (merged cells have no wall between them).
 *
 * Positioned from Z=0 (floor) to Z=wallHeight.
 */
function buildCompartmentWalls(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  const { cols, rows, thickness, cells } = params.compartments;

  // Single compartment = no walls needed
  if (cols <= 1 && rows <= 1) return null;
  if (new Set(cells).size <= 1) return null;

  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Effective free space per cell after accounting for internal divider thickness
  const effectiveCellW = (innerW - (cols - 1) * thickness) / cols;
  const effectiveCellD = (innerD - (rows - 1) * thickness) / rows;

  // Safety net: skip wall generation if cells are too small for viable geometry
  if (effectiveCellW < thickness * 2 || effectiveCellD < thickness * 2) return null;

  let dividers: Shape3D | null = null;

  // Vertical walls: between column boundaries
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const xPos = -innerW / 2 + colBoundary * cellW;
    const segments = findWallSegments(rows, (row) => {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      return leftId !== rightId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellD;
      const yCenter = -innerD / 2 + (start + (end - start) / 2) * cellD;
      dividers = addWallSegment(dividers, thickness, segLength, wallHeight, xPos, yCenter);
    }
  }

  // Horizontal walls: between row boundaries
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const yPos = -innerD / 2 + rowBoundary * cellD;
    const segments = findWallSegments(cols, (col) => {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      return topId !== bottomId;
    });

    for (const [start, end] of segments) {
      const segLength = (end - start) * cellW;
      const xCenter = -innerW / 2 + (start + (end - start) / 2) * cellW;
      dividers = addWallSegment(dividers, segLength, thickness, wallHeight, xCenter, yPos);
    }
  }

  return dividers;
}

/**
 * Build insert cavity cuts.
 */
function buildInsertCuts(params: BinParams): Shape3D | null {
  if (params.inserts.length === 0) return null;

  let cuts: Shape3D | null = null;

  for (const insert of params.inserts) {
    let solid: Shape3D;

    switch (insert.shape) {
      case 'circle': {
        solid = (drawCircle(insert.width / 2).sketchOnPlane('XY') as unknown as Sketch).extrude(
          insert.cutDepth
        ) as Shape3D;
        break;
      }
      case 'rounded-rect': {
        solid = (
          drawRoundedRectangle(insert.width, insert.depth, insert.cornerRadius).sketchOnPlane(
            'XY'
          ) as unknown as Sketch
        ).extrude(insert.cutDepth) as Shape3D;
        break;
      }
      case 'hexagon': {
        // Approximate hexagon with circle (Replicad polygon support TBD)
        solid = (drawCircle(insert.width / 2).sketchOnPlane('XY') as unknown as Sketch).extrude(
          insert.cutDepth
        ) as Shape3D;
        break;
      }
      case 'slot': {
        solid = (
          drawRoundedRectangle(
            insert.width,
            insert.depth,
            Math.min(insert.width, insert.depth) / 2
          ).sketchOnPlane('XY') as unknown as Sketch
        ).extrude(insert.cutDepth) as Shape3D;
        break;
      }
      case 'rectangle':
      default: {
        solid = (
          drawRectangle(insert.width, insert.depth).sketchOnPlane('XY') as unknown as Sketch
        ).extrude(insert.cutDepth) as Shape3D;
        break;
      }
    }

    const positioned = solid.translate([insert.x, insert.y, 0]);
    cuts = cuts ? cuts.fuse(positioned) : positioned;
  }

  return cuts;
}

// ─── Mesh Conversion ────────────────────────────────────────────────────────

/**
 * Convert Replicad's indexed mesh to flat triangle arrays (our MeshData format).
 *
 * @param mesh Replicad mesh with indexed vertices/normals/triangles
 * @param skipNormals If true, returns empty normals array (GPU will use flat shading)
 */
function indexedMeshToFlat(
  mesh: {
    vertices: number[];
    normals: number[];
    triangles: number[];
  },
  skipNormals = false
): MeshData {
  const triCount = mesh.triangles.length / 3;
  const flatVertices = new Float32Array(mesh.triangles.length * 3);
  const flatNormals = skipNormals
    ? new Float32Array(0)
    : new Float32Array(mesh.triangles.length * 3);

  for (let i = 0; i < mesh.triangles.length; i++) {
    const vi = mesh.triangles[i];
    flatVertices[i * 3] = mesh.vertices[vi * 3];
    flatVertices[i * 3 + 1] = mesh.vertices[vi * 3 + 1];
    flatVertices[i * 3 + 2] = mesh.vertices[vi * 3 + 2];
    if (!skipNormals) {
      flatNormals[i * 3] = mesh.normals[vi * 3];
      flatNormals[i * 3 + 1] = mesh.normals[vi * 3 + 1];
      flatNormals[i * 3 + 2] = mesh.normals[vi * 3 + 2];
    }
  }

  return {
    vertices: flatVertices,
    normals: flatNormals,
    triangleCount: triCount,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/** Last generated solid — cached for instant export without re-generation. */
let lastSolid: Solid | null = null;

/** Get the last generated solid for export operations. */
export function getLastSolid(): Solid | null {
  return lastSolid;
}

/** Export result with binary data and suggested file name. */
export interface ExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

/**
 * Export the last generated solid in the requested format.
 * If no solid is cached (e.g., worker restarted), regenerates from params.
 *
 * STL: binary mesh with configurable tessellation quality
 * STEP: exact BREP geometry (lossless, CAD-interoperable)
 */
export async function exportBin(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<ExportResult> {
  // Regenerate if no cached solid
  if (!lastSolid) {
    generateBin(params);
  }

  const solid = lastSolid;
  if (!solid) {
    throw new Error('Failed to generate solid for export');
  }

  const name = `gridfinity-${params.width}x${params.depth}x${params.height}`;

  if (format === 'step') {
    const blob = (solid as unknown as Shape3D).blobSTEP();
    const data = await blob.arrayBuffer();
    return { data, fileName: `${name}.step` };
  }

  // STL with configurable quality
  const blob = (solid as unknown as Shape3D).blobSTL({
    tolerance,
    angularTolerance,
    binary: true,
  });
  const data = await blob.arrayBuffer();
  return { data, fileName: `${name}.stl` };
}

/**
 * Generate a complete Gridfinity bin from parameters.
 * Assembly order: base socket + box body + top shape (stacking lip)
 * Then features: dividers, inserts
 *
 * @param params Bin configuration parameters
 * @param onProgress Optional progress callback
 * @param forExport If true, generates full-fidelity geometry for 3D printing.
 *                  Preview mode uses simplified geometry for faster rendering.
 */
export function generateBin(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false
): MeshData {
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  // Wall extends from socket top to bin top. Per Gridfinity spec, base is 1u (7mm),
  // but the physical socket structure is 5mm deep. Wall = total - socket depth.
  // Total height: e.g., 3u + lip = 21 + 4.4 = 25.4mm
  const wallHeight = totalHeight - SOCKET_HEIGHT;

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const keepFull = params.style === 'solid';

  const withMagnet = params.base.style === 'magnet' || params.base.style === 'magnet_and_screw';
  const withScrew = params.base.style === 'screw' || params.base.style === 'magnet_and_screw';

  // Dynamic quality: small bins (< 4x4) get higher fidelity preview
  const cellCount = params.width * params.depth;
  const isSmallBin = cellCount < 16; // 4x4 = 16 cells threshold
  const useHighQuality = forExport || isSmallBin;

  // Stage 1: Build base socket
  onProgress?.('base', 0.1);
  const base = buildBaseSocket(
    params.width,
    params.depth,
    withMagnet,
    withScrew,
    params.base.magnetDiameter / 2,
    params.base.magnetDepth,
    params.base.screwDiameter / 2,
    useHighQuality
  );

  // Stage 2: Build bin box (walls + floor)
  onProgress?.('shell', 0.3);
  const box = buildBinBox(params.width, params.depth, wallHeight, wallThickness, keepFull);

  // Stage 3: Assemble base + shell + stacking lip
  onProgress?.('features', 0.4);
  let bin: Shape3D;
  if (params.base.stackingLip && !keepFull) {
    try {
      const top = buildTopShape(params.width, params.depth, true, wallThickness).translateZ(
        wallHeight
      );
      bin = base
        .fuse(box, { optimisation: 'commonFace' })
        .fuse(top, { optimisation: 'commonFace' });
    } catch {
      bin = base.fuse(box, { optimisation: 'commonFace' });
    }
  } else {
    bin = base.fuse(box, { optimisation: 'commonFace' });
  }

  // Stage 4: Features (dividers, inserts)
  // Features always rebuild because they apply boolean cuts to the assembly.
  // When only feature params changed, assembly is reused as starting point.
  onProgress?.('features', 0.5);

  if (!keepFull) {
    const compartmentWalls = buildCompartmentWalls(params, innerW, innerD, wallHeight);
    if (compartmentWalls) {
      try {
        bin = bin.fuse(compartmentWalls);
      } catch (e) {
        console.warn(
          '[BinGen] Divider fusion failed, skipping:',
          e instanceof Error ? e.message : e
        );
      }
    }

    const insertCuts = buildInsertCuts(params);
    if (insertCuts) {
      try {
        bin = bin.cut(insertCuts);
      } catch (e) {
        console.warn('[BinGen] Insert cut failed, skipping:', e instanceof Error ? e.message : e);
      }
    }
  }

  // Stage 5: Translate so Z=0 = absolute bottom (socket bottom)
  onProgress?.('merge', 0.8);
  bin = bin.translateZ(SOCKET_HEIGHT);

  // Stage 6: Tessellate to triangle mesh
  onProgress?.('merge', 0.9);
  lastSolid = bin as unknown as Solid;

  // Dynamic tessellation: export gets fine quality, preview adapts to bin size
  const maxDimension = Math.max(params.width, params.depth) * SIZE;
  let tolerance: number;
  let angularTolerance: number;

  if (forExport) {
    // Export: fine tessellation for smooth curves
    tolerance = 0.01;
    angularTolerance = 5;
  } else if (isSmallBin) {
    // Small bin preview: moderate quality (fast but still smooth)
    tolerance = Math.min(0.5, Math.max(0.2, maxDimension / 500));
    angularTolerance = 15;
  } else {
    // Large bin preview: coarse tessellation for speed
    tolerance = Math.min(3, Math.max(1, maxDimension / 100));
    angularTolerance = 30;
  }

  const shapeMesh = bin.mesh({ tolerance, angularTolerance });

  onProgress?.('merge', 1.0);
  // Skip normals for large bin preview (GPU flat shading is faster)
  return indexedMeshToFlat(shapeMesh, !useHighQuality);
}
