/**
 * Gridfinity bin generator using Replicad (OpenCascade WASM).
 *
 * Architecture follows the official Replicad Gridfinity example:
 * 1. buildBaseSocket() — Swept profile per grid cell (baseplate interface)
 * 2. buildBinBox() — Rounded rect extruded + shelled (walls + floor)
 * 3. buildTopShape() — Swept stacking lip profile around perimeter
 * 4. Features: dividers, scoops, inserts, magnet/screw holes via booleans
 *
 * Coordinate system:
 * - Z=0: bin floor level (where box meets socket)
 * - Socket: Z=-SOCKET_HEIGHT to Z=0
 * - Box body: Z=0 to Z=wallHeight
 * - Final mesh translated up by SOCKET_HEIGHT so Z=0 = absolute bottom
 */

import {
  draw,
  drawRoundedRectangle,
  drawCircle,
  drawRectangle,
  makeSolid,
  assembleWire,
  makeFace,
  EdgeFinder,
} from 'replicad';
import type { Solid, Shape3D, Sketch, Plane, Point, Edge, Wire } from 'replicad';
import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData, ExportFormat } from '../../bridge/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';

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
 * Socket profile callback for sweepSketch.
 * Draws the Gridfinity base socket cross-section in the XZ plane.
 * The profile traces the inner wall of the socket from Z=0 downward.
 */
function socketProfile(_plane: Plane, startPoint: Point): Sketch {
  const full = draw([-CLEARANCE / 2, 0])
    .vLine(-CLEARANCE / 2)
    .lineTo([-SOCKET_BIG_TAPER, -SOCKET_BIG_TAPER])
    .vLine(-SOCKET_VERTICAL_PART)
    .line(-SOCKET_SMALL_TAPER, -SOCKET_SMALL_TAPER)
    .done()
    .translate(CLEARANCE / 2, 0);

  return full.sketchOnPlane('XZ', startPoint) as unknown as Sketch;
}

/**
 * Build a single grid-cell base socket.
 * The socket is a swept profile around a rounded rectangle, closed into a solid.
 * Optional magnet/screw holes are cut at the four corners.
 */
function buildSingleSocket(
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number
): Shape3D {
  const baseSketch = drawRoundedRectangle(
    SIZE - CLEARANCE,
    SIZE - CLEARANCE,
    CORNER_RADIUS
  ).sketchOnPlane() as unknown as Sketch;

  const slotSide = baseSketch.sweepSketch(socketProfile, { withContact: true });

  // Close the solid by adding top and bottom faces
  let slot = makeSolid([
    slotSide,
    makeFace(
      assembleWire(
        new EdgeFinder().inPlane('XY', -SOCKET_HEIGHT).find(slotSide) as unknown as (Edge | Wire)[]
      )
    ),
    makeFace(
      assembleWire(
        new EdgeFinder().inPlane('XY', 0).find(slotSide) as unknown as (Edge | Wire)[]
      )
    ),
  ]) as Shape3D;

  // Cut magnet/screw holes at 4 corners (13mm from socket center per Gridfinity spec)
  if (withScrew || withMagnet) {
    const HOLE_OFFSET = 13; // mm from socket center to hole center
    const magnetCutout = withMagnet
      ? (drawCircle(magnetRadius).sketchOnPlane() as unknown as Sketch)
          .extrude(magnetDepth) as Shape3D
      : null;
    const screwCutout = withScrew
      ? (drawCircle(screwRadius).sketchOnPlane() as unknown as Sketch)
          .extrude(SOCKET_HEIGHT) as Shape3D
      : null;

    const cutout: Shape3D = magnetCutout && screwCutout
      ? magnetCutout.fuse(screwCutout)
      : (magnetCutout || screwCutout) as Shape3D;

    slot = slot
      .cut(cutout.clone().translate([-HOLE_OFFSET, -HOLE_OFFSET, -SOCKET_HEIGHT]))
      .cut(cutout.clone().translate([-HOLE_OFFSET, HOLE_OFFSET, -SOCKET_HEIGHT]))
      .cut(cutout.clone().translate([HOLE_OFFSET, HOLE_OFFSET, -SOCKET_HEIGHT]))
      .cut(cutout.clone().translate([HOLE_OFFSET, -HOLE_OFFSET, -SOCKET_HEIGHT]));
  }

  return slot;
}

/**
 * Build the complete base socket for all grid cells.
 * Clones the single-cell socket and fuses them at grid positions.
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
  const socket = buildSingleSocket(
    withMagnet,
    withScrew,
    magnetRadius,
    magnetDepth,
    screwRadius
  );

  // Position sockets on grid (centered around origin)
  const xCorr = ((gridW - 1) * SIZE) / 2;
  const yCorr = ((gridD - 1) * SIZE) / 2;

  // First cell becomes the initial base, then fuse remaining cells
  let base: Shape3D = socket.clone().translate([
    0 * SIZE - xCorr,
    0 * SIZE - yCorr,
    0,
  ]);

  for (let gx = 0; gx < gridW; gx++) {
    for (let gy = 0; gy < gridD; gy++) {
      if (gx === 0 && gy === 0) continue; // Already used as initial
      const movedSocket = socket.clone().translate([
        gx * SIZE - xCorr,
        gy * SIZE - yCorr,
        0,
      ]);
      base = base.fuse(movedSocket);
    }
  }

  return base;
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

  let box = (drawRoundedRectangle(outerW, outerD, CORNER_RADIUS)
    .sketchOnPlane() as unknown as Sketch)
    .extrude(wallHeight) as Shape3D;

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

    let basicShape = sketcher.close();

    // Apply clearance shifts and clip to valid region
    let shiftedShape = basicShape
      .translate(AXIS_CLEARANCE, -AXIS_CLEARANCE)
      .intersect(
        drawRoundedRectangle(10, 10).translate(-5, includeLip ? 0 : 5)
      );

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
  const boxSketch = drawRoundedRectangle(outerW, outerD, CORNER_RADIUS)
    .sketchOnPlane() as unknown as Sketch;

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
          const wall = (drawRectangle(thickness, segLength)
            .sketchOnPlane('XY') as unknown as Sketch)
            .extrude(wallHeight) as Shape3D;
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
      const wall = (drawRectangle(thickness, segLength)
        .sketchOnPlane('XY') as unknown as Sketch)
        .extrude(wallHeight) as Shape3D;
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
          const wall = (drawRectangle(segLength, thickness)
            .sketchOnPlane('XY') as unknown as Sketch)
            .extrude(wallHeight) as Shape3D;
          const positioned = wall.translate([xCenter, yPos, 0]);
          dividers = dividers ? dividers.fuse(positioned) : positioned;
          segStart = null;
        }
      }
    }
    if (segStart !== null) {
      const segLength = (cols - segStart) * cellW;
      const xCenter = -innerW / 2 + (segStart + (cols - segStart) / 2) * cellW;
      const wall = (drawRectangle(segLength, thickness)
        .sketchOnPlane('XY') as unknown as Sketch)
        .extrude(wallHeight) as Shape3D;
      const positioned = wall.translate([xCenter, yPos, 0]);
      dividers = dividers ? dividers.fuse(positioned) : positioned;
    }
  }

  return dividers;
}

/**
 * Build scoop cuts — quarter-cylinder cuts from the front wall interior.
 */
function buildScoops(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  xDividers: number
): Shape3D | null {
  if (!params.scoop.enabled) return null;

  const compartmentW = innerW / (xDividers + 1);
  const compartmentD = innerD / params.compartments.rows;
  const autoRadius = Math.min(compartmentW / 3, compartmentD / 3, 15);
  const maxRadius = wallHeight * 0.75;
  const radius = Math.min(
    params.scoop.radius === 'auto' ? autoRadius : params.scoop.radius,
    maxRadius
  );

  if (radius <= 0.5) return null;

  let scoops: Shape3D | null = null;
  const cols = xDividers + 1;
  const rows = params.compartments.rows;
  const rowCount = params.scoop.allRows ? rows : 1;

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = -innerW / 2 + compartmentW * (col + 0.5);
      const cy = -innerD / 2 + compartmentD * (row + 0.5);

      // Scoop is a cylinder at the front wall of the compartment
      const scoopCylinder = (drawCircle(radius)
        .sketchOnPlane('XZ', cy - compartmentD / 2) as unknown as Sketch)
        .extrude(compartmentW * 0.8) as Shape3D;

      const positioned = scoopCylinder.translate([cx, 0, 0]);
      scoops = scoops ? scoops.fuse(positioned) : positioned;
    }
  }

  return scoops;
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
        solid = (drawCircle(insert.width / 2)
          .sketchOnPlane('XY') as unknown as Sketch)
          .extrude(insert.cutDepth) as Shape3D;
        break;
      }
      case 'rounded-rect': {
        solid = (drawRoundedRectangle(insert.width, insert.depth, insert.cornerRadius)
          .sketchOnPlane('XY') as unknown as Sketch)
          .extrude(insert.cutDepth) as Shape3D;
        break;
      }
      case 'hexagon': {
        // Approximate hexagon with circle (Replicad polygon support TBD)
        solid = (drawCircle(insert.width / 2)
          .sketchOnPlane('XY') as unknown as Sketch)
          .extrude(insert.cutDepth) as Shape3D;
        break;
      }
      case 'slot': {
        solid = (drawRoundedRectangle(
          insert.width, insert.depth,
          Math.min(insert.width, insert.depth) / 2
        ).sketchOnPlane('XY') as unknown as Sketch)
          .extrude(insert.cutDepth) as Shape3D;
        break;
      }
      case 'rectangle':
      default: {
        solid = (drawRectangle(insert.width, insert.depth)
          .sketchOnPlane('XY') as unknown as Sketch)
          .extrude(insert.cutDepth) as Shape3D;
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
 * Then features: dividers, scoops, inserts
 */
export function generateBin(
  params: BinParams,
  onProgress?: ProgressFn
): MeshData {
  const wallThickness = params.wallThickness;
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  // Wall height = total minus base height (first unit is base)
  // But in our coordinate system, the box floor is at Z=0 and socket is below.
  // The cavity height is (height - 1) height units (first unit = base, no cavity).
  const wallHeight = totalHeight - GRIDFINITY.BASE_HEIGHT;

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const keepFull = params.style === 'solid';

  // Determine base features
  const withMagnet = params.base.style === 'magnet' || params.base.style === 'magnet_and_screw';
  const withScrew = params.base.style === 'screw' || params.base.style === 'magnet_and_screw';

  // Stage 1: Build base socket (per-cell, with optional holes)
  onProgress?.('base', 0.1);
  const base = buildBaseSocket(
    params.width,
    params.depth,
    withMagnet,
    withScrew,
    params.base.magnetDiameter / 2,
    params.base.magnetDepth,
    params.base.screwDiameter / 2
  );

  // Stage 2: Build bin box (walls + floor)
  onProgress?.('shell', 0.3);
  const box = buildBinBox(
    params.width,
    params.depth,
    wallHeight,
    wallThickness,
    keepFull
  );

  // Stage 3: Build stacking lip
  onProgress?.('features', 0.4);
  let bin: Shape3D;
  if (params.base.stackingLip && !keepFull) {
    try {
      const top = buildTopShape(
        params.width,
        params.depth,
        true, // includeLip
        wallThickness
      ).translateZ(wallHeight);
      // Assemble: socket + box + top
      bin = base
        .fuse(box, { optimisation: 'commonFace' })
        .fuse(top, { optimisation: 'commonFace' });
    } catch {
      // Top shape may fail — assemble without it
      bin = base.fuse(box, { optimisation: 'commonFace' });
    }
  } else {
    bin = base.fuse(box, { optimisation: 'commonFace' });
  }

  // Stage 4: Features (dividers, scoops, inserts)
  onProgress?.('features', 0.5);

  if (!keepFull) {
    // Compartment divider walls (positioned from Z=0 = bin floor)
    const compartmentWalls = buildCompartmentWalls(params, innerW, innerD, wallHeight);
    if (compartmentWalls) {
      try {
        bin = bin.fuse(compartmentWalls);
      } catch {
        // Boolean fusion may fail — continue without dividers
      }
    }

    // Scoops (boolean cut from interior)
    const xDividers = params.compartments.cols - 1;
    const scoopCut = buildScoops(params, innerW, innerD, wallHeight, xDividers);
    if (scoopCut) {
      try {
        bin = bin.cut(scoopCut);
      } catch {
        // Scoop cut may fail — continue without scoops
      }
    }

    // Insert cavities (positioned at Z=0 = bin floor)
    const insertCuts = buildInsertCuts(params);
    if (insertCuts) {
      try {
        bin = bin.cut(insertCuts);
      } catch {
        // Insert cuts may fail — continue without them
      }
    }
  }

  // Stage 5: Translate so Z=0 = absolute bottom (socket bottom)
  onProgress?.('merge', 0.8);
  bin = bin.translateZ(SOCKET_HEIGHT);

  // Stage 6: Tessellate to triangle mesh
  onProgress?.('merge', 0.9);
  lastSolid = bin as unknown as Solid;

  const shapeMesh = bin.mesh({
    tolerance: 0.1,        // mm chord tolerance (preview quality)
    angularTolerance: 15,  // degrees (preview quality)
  });

  onProgress?.('merge', 1.0);
  return indexedMeshToFlat(shapeMesh);
}
