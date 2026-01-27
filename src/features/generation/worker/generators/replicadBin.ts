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
function buildSingleCellSocket(cellW_mm: number, cellD_mm: number, forExport: boolean): Shape3D {
  // Clamp corner radius to fit within cell dimensions
  const maxRadius = Math.min(cellW_mm, cellD_mm) / 2 - 0.1;
  const cornerR = Math.min(CORNER_RADIUS, maxRadius);

  // Profile insets from outer boundary at each Z breakpoint
  const INSET_MID = SOCKET_BIG_TAPER - CLEARANCE / 2; // 2.15mm
  const INSET_BOT = SOCKET_TAPER_WIDTH - CLEARANCE / 2; // 2.95mm

  // Helper to create a rounded rect sketch at a given Z with a given inset
  const sectionAt = (z: number, inset: number): Sketch => {
    const w = cellW_mm - 2 * inset;
    const d = cellD_mm - 2 * inset;
    const r = Math.max(cornerR - inset, 0.1);
    return drawRoundedRectangle(w, d, r).sketchOnPlane('XY', z) as unknown as Sketch;
  };

  if (forExport) {
    // Full Gridfinity spec: 5-section loft matching exact profile
    const Z1 = 0;
    const Z2 = -(CLEARANCE / 2); // -0.25
    const Z3 = -SOCKET_BIG_TAPER; // -2.4
    const Z4 = -(SOCKET_BIG_TAPER + SOCKET_VERTICAL_PART); // -4.2
    const Z5 = -SOCKET_HEIGHT; // -5.0

    const s1 = sectionAt(Z1, 0);
    const s2 = sectionAt(Z2, 0);
    const s3 = sectionAt(Z3, INSET_MID);
    const s4 = sectionAt(Z4, INSET_MID);
    const s5 = sectionAt(Z5, INSET_BOT);

    return s1.loftWith([s2, s3, s4, s5], { ruled: true }) as Shape3D;
  }

  // Preview: simplified 2-section loft (fast, visually similar)
  const top = sectionAt(0, 0);
  const bottom = sectionAt(-SOCKET_HEIGHT, INSET_BOT);

  return top.loftWith([bottom], { ruled: true }) as Shape3D;
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
 */
function buildBaseSocket(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport: boolean
): Shape3D {
  const cellsW = decomposeCells(gridW);
  const cellsD = decomposeCells(gridD);

  // Total bin footprint in mm (for computing cell positions relative to center)
  const totalW_mm = gridW * SIZE;
  const totalD_mm = gridD * SIZE;

  // Build and position each cell socket
  // OPTIMIZATION: Collect all sockets, then batch fuse (Phase 2.3)
  const allSockets: Shape3D[] = [];

  // Track X position as we iterate cells
  let xOffset = 0; // mm from left edge
  for (let ix = 0; ix < cellsW.length; ix++) {
    const cellW_units = cellsW[ix];
    const cellW_mm = cellW_units * SIZE - CLEARANCE;
    const cellCenterX = xOffset + (cellW_units * SIZE) / 2 - totalW_mm / 2;

    let yOffset = 0;
    for (let iy = 0; iy < cellsD.length; iy++) {
      const cellD_units = cellsD[iy];
      const cellD_mm = cellD_units * SIZE - CLEARANCE;
      const cellCenterY = yOffset + (cellD_units * SIZE) / 2 - totalD_mm / 2;

      const cellSocket = buildSingleCellSocket(cellW_mm, cellD_mm, forExport).translate([
        cellCenterX,
        cellCenterY,
        0,
      ]);

      allSockets.push(cellSocket);

      yOffset += cellD_units * SIZE;
    }
    xOffset += cellW_units * SIZE;
  }

  // Batch fuse: single operation instead of O(cells) fuses
  let result = allSockets[0];
  for (let i = 1; i < allSockets.length; i++) {
    result = result.fuse(allSockets[i]);
  }

  // Cut magnet/screw holes only in full-size (1.0 × 1.0 unit) cells
  // OPTIMIZATION: Batch all holes into a single cut operation
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

    // Collect all hole positions, then batch into a single compound cut
    const allHoles: Shape3D[] = [];

    xOffset = 0;
    for (let ix = 0; ix < cellsW.length; ix++) {
      const cellW_units = cellsW[ix];
      if (cellW_units < 1) {
        xOffset += cellW_units * SIZE;
        continue;
      }
      const cellCenterX = xOffset + (cellW_units * SIZE) / 2 - totalW_mm / 2;

      let yOffset2 = 0;
      for (let iy = 0; iy < cellsD.length; iy++) {
        const cellD_units = cellsD[iy];
        if (cellD_units < 1) {
          yOffset2 += cellD_units * SIZE;
          continue;
        }
        const cellCenterY = yOffset2 + (cellD_units * SIZE) / 2 - totalD_mm / 2;

        // 4 holes per full cell at ±HOLE_OFFSET from center
        allHoles.push(
          cutout
            .clone()
            .translate([cellCenterX - HOLE_OFFSET, cellCenterY - HOLE_OFFSET, -SOCKET_HEIGHT]),
          cutout
            .clone()
            .translate([cellCenterX - HOLE_OFFSET, cellCenterY + HOLE_OFFSET, -SOCKET_HEIGHT]),
          cutout
            .clone()
            .translate([cellCenterX + HOLE_OFFSET, cellCenterY + HOLE_OFFSET, -SOCKET_HEIGHT]),
          cutout
            .clone()
            .translate([cellCenterX + HOLE_OFFSET, cellCenterY - HOLE_OFFSET, -SOCKET_HEIGHT])
        );

        yOffset2 += cellD_units * SIZE;
      }
      xOffset += cellW_units * SIZE;
    }

    // Batch cut: fuse all holes into compound, then single cut
    if (allHoles.length > 0) {
      let holeCompound = allHoles[0];
      for (let i = 1; i < allHoles.length; i++) {
        holeCompound = holeCompound.fuse(allHoles[i]);
      }
      result = result.cut(holeCompound);
    }
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
 * The lip is the inverse of the socket profile — it provides the mating
 * interface that allows bins to stack. The profile sweeps around the bin
 * perimeter, then gets filleted at the peak for a smooth junction.
 *
 * Profile traces (in XZ plane, X=outward, Z=up):
 *   Socket taper shape upward (matching socket cavity when stacked)
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
    // Draw the socket profile inverted (going upward from the sweep path)
    let sketcher = draw([-SOCKET_TAPER_WIDTH, 0])
      .line(SOCKET_SMALL_TAPER, SOCKET_SMALL_TAPER)
      .vLine(SOCKET_VERTICAL_PART)
      .line(SOCKET_BIG_TAPER, SOCKET_BIG_TAPER);

    if (includeLip) {
      // Extend wall downward to replace top wall section
      sketcher = sketcher
        .vLineTo(-(SOCKET_TAPER_WIDTH + wallThickness))
        .lineTo([-SOCKET_TAPER_WIDTH, -wallThickness]);
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
        [-gridW * SIZE, -gridD * SIZE, SOCKET_HEIGHT],
        [gridW * SIZE, gridD * SIZE, SOCKET_HEIGHT - 1]
      )
    );
}

// ─── Feature Builders ─────────────────────────────────────────────────────────

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

  // Collect all wall segments, then batch fuse (Phase 2.2 optimization)
  const allWalls: Shape3D[] = [];

  // Derive wall segments from cell boundaries

  // Vertical walls: between column boundaries
  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    const xPos = -innerW / 2 + colBoundary * cellW;

    // Find consecutive row spans where left cell != right cell
    let segStart: number | null = null;

    for (let row = 0; row < rows; row++) {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];

      if (leftId !== rightId) {
        if (segStart === null) segStart = row;
      } else {
        if (segStart !== null) {
          // Create wall segment from segStart to row (exclusive)
          const segLength = (row - segStart) * cellD;
          const yCenter = -innerD / 2 + (segStart + (row - segStart) / 2) * cellD;
          const wall = (
            drawRectangle(thickness, segLength).sketchOnPlane('XY') as unknown as Sketch
          ).extrude(wallHeight) as Shape3D;
          allWalls.push(wall.translate([xPos, yCenter, 0]));
          segStart = null;
        }
      }
    }
    // Close trailing segment
    if (segStart !== null) {
      const segLength = (rows - segStart) * cellD;
      const yCenter = -innerD / 2 + (segStart + (rows - segStart) / 2) * cellD;
      const wall = (
        drawRectangle(thickness, segLength).sketchOnPlane('XY') as unknown as Sketch
      ).extrude(wallHeight) as Shape3D;
      allWalls.push(wall.translate([xPos, yCenter, 0]));
    }
  }

  // Horizontal walls: between row boundaries
  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    const yPos = -innerD / 2 + rowBoundary * cellD;

    let segStart: number | null = null;

    for (let col = 0; col < cols; col++) {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];

      if (topId !== bottomId) {
        if (segStart === null) segStart = col;
      } else {
        if (segStart !== null) {
          const segLength = (col - segStart) * cellW;
          const xCenter = -innerW / 2 + (segStart + (col - segStart) / 2) * cellW;
          const wall = (
            drawRectangle(segLength, thickness).sketchOnPlane('XY') as unknown as Sketch
          ).extrude(wallHeight) as Shape3D;
          allWalls.push(wall.translate([xCenter, yPos, 0]));
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      const segLength = (cols - segStart) * cellW;
      const xCenter = -innerW / 2 + (segStart + (cols - segStart) / 2) * cellW;
      const wall = (
        drawRectangle(segLength, thickness).sketchOnPlane('XY') as unknown as Sketch
      ).extrude(wallHeight) as Shape3D;
      allWalls.push(wall.translate([xCenter, yPos, 0]));
    }
  }

  // Batch fuse: single operation instead of O(walls) fuses
  if (allWalls.length === 0) return null;
  let dividers = allWalls[0];
  for (let i = 1; i < allWalls.length; i++) {
    dividers = dividers.fuse(allWalls[i]);
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
 * For preview, skipNormals=true to save time - Three.js computes flat normals on GPU.
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

  for (let i = 0; i < mesh.triangles.length; i++) {
    const vi = mesh.triangles[i];
    flatVertices[i * 3] = mesh.vertices[vi * 3];
    flatVertices[i * 3 + 1] = mesh.vertices[vi * 3 + 1];
    flatVertices[i * 3 + 2] = mesh.vertices[vi * 3 + 2];
  }

  // Skip normals for preview - Three.js will compute flat normals on GPU
  if (skipNormals) {
    return {
      vertices: flatVertices,
      normals: null as unknown as Float32Array, // BinMesh handles null
      triangleCount: triCount,
    };
  }

  const flatNormals = new Float32Array(mesh.triangles.length * 3);
  for (let i = 0; i < mesh.triangles.length; i++) {
    const vi = mesh.triangles[i];
    flatNormals[i * 3] = mesh.normals[vi * 3];
    flatNormals[i * 3 + 1] = mesh.normals[vi * 3 + 1];
    flatNormals[i * 3 + 2] = mesh.normals[vi * 3 + 2];
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
 * Export the bin in the requested format with full Gridfinity-spec geometry.
 * Always regenerates with forExport=true to ensure print-quality geometry
 * (full 5-section socket profile, fine tessellation).
 *
 * STL: binary mesh with fine tessellation (0.01mm tolerance, 5° angular)
 * STEP: exact BREP geometry (lossless, CAD-interoperable)
 */
export async function exportBin(
  params: BinParams,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = 5
): Promise<ExportResult> {
  // Always regenerate with full quality for export
  generateBin(params, undefined, true);

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
 */
export function generateBin(params: BinParams, onProgress?: ProgressFn, forExport = false): MeshData {
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalHeight - GRIDFINITY.BASE_HEIGHT;

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const keepFull = params.style === 'solid';

  // Dynamic quality: small bins (< 4x4) get higher fidelity preview
  const cellCount = params.width * params.depth;
  const isSmallBin = cellCount < 16; // 4x4 = 16 cells threshold
  const useHighQuality = forExport || isSmallBin;

  const withMagnet = params.base.style === 'magnet' || params.base.style === 'magnet_and_screw';
  const withScrew = params.base.style === 'screw' || params.base.style === 'magnet_and_screw';

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
    useHighQuality // Full socket detail for small bins + export
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

  // Dynamic tessellation based on bin size:
  // - Small bins (< 4x4): fine tessellation for smooth curves
  // - Large bins (>= 4x4): coarse tessellation for speed
  // - Export: highest quality for 3D printing
  const maxDimension = Math.max(outerW, outerD, totalHeight);
  let tolerance: number;
  let angularTolerance: number;

  if (forExport) {
    // Export: highest quality for 3D printing
    tolerance = 0.01;
    angularTolerance = 5;
  } else if (isSmallBin) {
    // Small bins: smooth preview (~24-sided corners)
    tolerance = Math.min(0.5, Math.max(0.2, maxDimension / 500));
    angularTolerance = 15;
  } else {
    // Large bins: fast preview (~12-sided corners)
    tolerance = Math.min(3, Math.max(1, maxDimension / 100));
    angularTolerance = 30;
  }

  const shapeMesh = bin.mesh({ tolerance, angularTolerance });

  onProgress?.('merge', 1.0);
  // Skip normals for large bin preview (flat shading on GPU)
  // Compute normals for small bins + export (smooth shading)
  return indexedMeshToFlat(shapeMesh, !useHighQuality);
}
