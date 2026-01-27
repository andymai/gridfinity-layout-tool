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
import type { StageCache, InvalidationLevel } from '../stageCache';

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
  screwRadius: number
): Shape3D {
  const cellsW = decomposeCells(gridW);
  const cellsD = decomposeCells(gridD);

  // Total bin footprint in mm (for computing cell positions relative to center)
  const totalW_mm = gridW * SIZE;
  const totalD_mm = gridD * SIZE;

  // Build and position each cell socket
  let baseSocket: Shape3D | null = null;

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

      const cellSocket = buildSingleCellSocket(cellW_mm, cellD_mm).translate([
        cellCenterX,
        cellCenterY,
        0,
      ]);

      baseSocket = baseSocket ? baseSocket.fuse(cellSocket) : cellSocket;

      yOffset += cellD_units * SIZE;
    }
    xOffset += cellW_units * SIZE;
  }

  let result = baseSocket as Shape3D;

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

    // Iterate cells again and cut holes only where both axes are full-unit
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
        result = result
          .cut(
            cutout
              .clone()
              .translate([cellCenterX - HOLE_OFFSET, cellCenterY - HOLE_OFFSET, -SOCKET_HEIGHT])
          )
          .cut(
            cutout
              .clone()
              .translate([cellCenterX - HOLE_OFFSET, cellCenterY + HOLE_OFFSET, -SOCKET_HEIGHT])
          )
          .cut(
            cutout
              .clone()
              .translate([cellCenterX + HOLE_OFFSET, cellCenterY + HOLE_OFFSET, -SOCKET_HEIGHT])
          )
          .cut(
            cutout
              .clone()
              .translate([cellCenterX + HOLE_OFFSET, cellCenterY - HOLE_OFFSET, -SOCKET_HEIGHT])
          );

        yOffset2 += cellD_units * SIZE;
      }
      xOffset += cellW_units * SIZE;
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

  let dividers: Shape3D | null = null;

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
          const positioned = wall.translate([xPos, yCenter, 0]);
          dividers = dividers ? dividers.fuse(positioned) : positioned;
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
      const positioned = wall.translate([xPos, yCenter, 0]);
      dividers = dividers ? dividers.fuse(positioned) : positioned;
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
          const positioned = wall.translate([xCenter, yPos, 0]);
          dividers = dividers ? dividers.fuse(positioned) : positioned;
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
      const positioned = wall.translate([xCenter, yPos, 0]);
      dividers = dividers ? dividers.fuse(positioned) : positioned;
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
 */
function indexedMeshToFlat(mesh: {
  vertices: number[];
  normals: number[];
  triangles: number[];
}): MeshData {
  const triCount = mesh.triangles.length / 3;
  const flatVertices = new Float32Array(mesh.triangles.length * 3);
  const flatNormals = new Float32Array(mesh.triangles.length * 3);

  for (let i = 0; i < mesh.triangles.length; i++) {
    const vi = mesh.triangles[i];
    flatVertices[i * 3] = mesh.vertices[vi * 3];
    flatVertices[i * 3 + 1] = mesh.vertices[vi * 3 + 1];
    flatVertices[i * 3 + 2] = mesh.vertices[vi * 3 + 2];
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
 * When a StageCache is provided, skips recomputation of stages whose
 * parameters haven't changed since the last generation.
 */
export function generateBin(
  params: BinParams,
  onProgress?: ProgressFn,
  stageCache?: StageCache
): MeshData {
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalHeight - GRIDFINITY.BASE_HEIGHT;

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const keepFull = params.style === 'solid';

  const withMagnet = params.base.style === 'magnet' || params.base.style === 'magnet_and_screw';
  const withScrew = params.base.style === 'screw' || params.base.style === 'magnet_and_screw';

  // Determine which stages need rebuilding
  const invalidationLevel: InvalidationLevel = stageCache
    ? stageCache.getInvalidationLevel(params)
    : 'base';

  if (stageCache) {
    stageCache.invalidateFrom(invalidationLevel);
  }

  // Stage 1: Build base socket
  onProgress?.('base', 0.1);
  let base: Shape3D;
  if (invalidationLevel === 'base' || !stageCache?.getBase()) {
    base = buildBaseSocket(
      params.width,
      params.depth,
      withMagnet,
      withScrew,
      params.base.magnetDiameter / 2,
      params.base.magnetDepth,
      params.base.screwDiameter / 2
    );
    stageCache?.setBase(base);
  } else {
    // Safe: else branch only reachable when stageCache is defined (condition checks stageCache?.getBase())
    base = (stageCache as StageCache).getBase() as Shape3D;
  }

  // Stage 2: Build bin box (walls + floor)
  onProgress?.('shell', 0.3);
  let box: Shape3D;
  const needsShell =
    invalidationLevel === 'base' || invalidationLevel === 'shell' || !stageCache?.getShell();
  if (needsShell) {
    box = buildBinBox(params.width, params.depth, wallHeight, wallThickness, keepFull);
    stageCache?.setShell(box);
  } else {
    // Safe: else branch only reachable when stageCache is defined (needsShell false implies getShell() truthy)
    box = (stageCache as StageCache).getShell() as Shape3D;
  }

  // Stage 3: Assemble base + shell + stacking lip
  onProgress?.('features', 0.4);
  let bin: Shape3D;
  const needsAssembly =
    needsShell || invalidationLevel === 'assembly' || !stageCache?.getAssembly();
  if (needsAssembly) {
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
    stageCache?.setAssembly(bin);
  } else {
    // Safe: else branch only reachable when stageCache is defined (needsAssembly false implies getAssembly() truthy)
    bin = (stageCache as StageCache).getAssembly() as Shape3D;
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

  // Update cache with current params
  stageCache?.setParams(params);

  const shapeMesh = bin.mesh({
    tolerance: 0.1,
    angularTolerance: 15,
  });

  onProgress?.('merge', 1.0);
  return indexedMeshToFlat(shapeMesh);
}
