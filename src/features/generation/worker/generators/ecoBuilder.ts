/**
 * Eco mode geometry builders for material-saving bin features.
 *
 * Three builders:
 * 1. buildHoneycombFloorCuts — hex grid cutouts in the bin floor
 * 2. buildHoneycombWallCuts — hex pockets/perforations on outer walls
 * 3. buildSinusoidalWallBox — sine wave walls replacing standard shell
 *
 * All builders return Shape3D | null. Null means the feature is disabled
 * or no geometry could be generated (e.g., bin too small for hex grid).
 */

import { draw, drawRoundedRectangle, drawRectangle } from 'replicad';
import type { Shape3D, Sketch } from 'replicad';
import type { BinParams } from '@/shared/types/bin';
import { buildHexCompound } from './hexGrid';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default honeycomb floor cell size when 'auto' */
const AUTO_FLOOR_CELL_SIZE = 8; // mm
/** Default honeycomb wall cell size when 'auto' */
const AUTO_WALL_CELL_SIZE = 6; // mm
/** Default wave amplitude multiplier relative to wall thickness */
const AUTO_WAVE_AMPLITUDE_FACTOR = 1.5;
/** Default wave cycles per grid unit */
const AUTO_WAVE_FREQUENCY = 2;
/** Corner post size for sinusoidal wall corners (mm) */
const CORNER_POST_SIZE = 2; // mm

// ─── Floor Honeycomb ─────────────────────────────────────────────────────────

/**
 * Build hex grid cutouts for the bin floor.
 *
 * The floor is at Z=0 after shelling. Cutouts extrude through the full
 * floor thickness (= wallThickness after shell operation).
 *
 * @param params Bin parameters
 * @param innerW Interior width in mm (outerW - 2×wallThickness)
 * @param innerD Interior depth in mm (outerD - 2×wallThickness)
 * @returns Shape3D compound for boolean cutting, or null if disabled/empty
 */
export function buildHoneycombFloorCuts(
  params: BinParams,
  innerW: number,
  innerD: number
): Shape3D | null {
  const { honeycombFloor } = params.eco;
  if (!honeycombFloor.enabled) return null;

  const cellSize =
    honeycombFloor.cellSize === 'auto' ? AUTO_FLOOR_CELL_SIZE : honeycombFloor.cellSize;

  // Floor thickness = wall thickness (from shell operation)
  const floorThickness = params.wallThickness + 0.1; // small overlap for clean cut

  const compound = buildHexCompound({
    boundsW: innerW,
    boundsD: innerD,
    cellSize,
    margin: honeycombFloor.margin,
    height: floorThickness,
  });

  if (!compound) return null;

  // Position at Z=0 (floor level, cutting downward into the floor)
  // The floor is the bottom of the shelled box, slightly above Z=0
  return compound.translateZ(-0.05);
}

// ─── Wall Honeycomb ──────────────────────────────────────────────────────────

/**
 * Build hex grid cutouts for the four outer walls.
 *
 * For each wall, generates a 2D hex grid projected onto the wall plane,
 * then extrudes inward (pocketed) or through (perforated).
 *
 * Solid zones at top (lip clearance) and bottom (structural) are respected
 * via the topMargin and bottomMargin parameters.
 *
 * @param params Bin parameters
 * @param innerW Interior width in mm
 * @param innerD Interior depth in mm
 * @param wallHeight Wall height in mm (from socket top to bin top)
 * @returns Shape3D compound for boolean cutting, or null if disabled/empty
 */
export function buildHoneycombWallCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number
): Shape3D | null {
  const { honeycombWall } = params.eco;
  if (honeycombWall.mode === 'none') return null;

  const wallThickness = params.wallThickness;
  const cellSize = honeycombWall.cellSize === 'auto' ? AUTO_WALL_CELL_SIZE : honeycombWall.cellSize;

  // Pattern zone height (excluding solid margins at top and bottom)
  const patternHeight = wallHeight - honeycombWall.topMargin - honeycombWall.bottomMargin;
  if (patternHeight <= cellSize) return null; // Too short for even one hex row

  // Cut depth: pocketed = 60% of wall, perforated = through wall
  const cutDepth = honeycombWall.mode === 'pocketed' ? wallThickness * 0.6 : wallThickness + 0.1;

  // Z offset for the pattern zone (above bottom margin)
  const patternZ = honeycombWall.bottomMargin;

  const wallCuts: Shape3D[] = [];

  // Helper: build hex grid for a wall face, then position it
  const addWallHexes = (
    wallLength: number,
    translateX: number,
    translateY: number,
    translateZ: number,
    rotateZ: number
  ): void => {
    // Build hex grid on XZ plane (boundsW = wall length, boundsD = pattern height)
    const compound = buildHexCompound({
      boundsW: wallLength,
      boundsD: patternHeight,
      cellSize,
      margin: honeycombWall.bottomMargin > 0 ? 1 : cellSize / 2,
      height: cutDepth,
    });
    if (!compound) return;

    // Rotate from XY plane to vertical (XZ), then rotate around Z for wall orientation
    let positioned: Shape3D = compound
      .rotate(90, [0, 0, 0], [1, 0, 0]) // XY -> XZ plane
      .translateZ(patternHeight / 2 + patternZ); // Move up to pattern zone

    if (rotateZ !== 0) {
      positioned = positioned.rotate(rotateZ, [0, 0, 0], [0, 0, 1]);
    }
    positioned = positioned.translate([translateX, translateY, translateZ]);
    wallCuts.push(positioned);
  };

  // Front wall (Y = -outerD/2, looking inward = +Y direction)
  addWallHexes(
    innerW, // wall length
    0, // x
    -innerD / 2 - cutDepth / 2, // y: interior face of front wall
    0, // z
    0 // no rotation
  );

  // Back wall (Y = +outerD/2, looking inward = -Y direction)
  addWallHexes(innerW, 0, innerD / 2 + cutDepth / 2, 0, 180);

  // Left wall (X = -outerW/2, looking inward = +X direction)
  addWallHexes(innerD, -innerW / 2 - cutDepth / 2, 0, 0, 90);

  // Right wall (X = +outerW/2, looking inward = -X direction)
  addWallHexes(innerD, innerW / 2 + cutDepth / 2, 0, 0, -90);

  if (wallCuts.length === 0) return null;

  // Fuse all wall cuts into single compound
  let compound = wallCuts[0];
  for (let i = 1; i < wallCuts.length; i++) {
    compound = compound.fuse(wallCuts[i]);
  }

  return compound;
}

// ─── Sinusoidal Wall Box ─────────────────────────────────────────────────────

/**
 * Build a bin body with sinusoidal (wave) walls instead of standard shell.
 *
 * Replaces buildBinBox() for wave-wall bins. Instead of shell operation,
 * directly constructs:
 * 1. Solid floor plate
 * 2. Four sine-wave walls
 * 3. Solid corner posts for watertight geometry
 *
 * @param params Bin parameters
 * @param gridW Grid width in units
 * @param gridD Grid depth in units
 * @param wallHeight Wall height in mm
 * @param forExport If true, uses higher segment count for smooth printing
 * @returns Shape3D bin body with wave walls
 */
export function buildSinusoidalWallBox(
  params: BinParams,
  gridW: number,
  gridD: number,
  wallHeight: number,
  forExport: boolean
): Shape3D {
  const gridSize = params.gridUnitMm;
  const tolerance = 0.5; // GRIDFINITY.TOLERANCE
  const outerW = gridW * gridSize - tolerance;
  const outerD = gridD * gridSize - tolerance;
  const wallThickness = params.wallThickness;

  const { sinusoidalWall } = params.eco;
  const amplitude =
    sinusoidalWall.amplitude === 'auto'
      ? wallThickness * AUTO_WAVE_AMPLITUDE_FACTOR
      : sinusoidalWall.amplitude;
  const frequency =
    sinusoidalWall.frequency === 'auto' ? AUTO_WAVE_FREQUENCY : sinusoidalWall.frequency;
  const baseThickness = sinusoidalWall.baseThickness;

  // Segments per wavelength: more for export, fewer for preview
  const segmentsPerWave = forExport ? 24 : 8;

  // Build floor plate
  const cornerRadius = 4; // GRIDFINITY.SOCKET_CORNER_RADIUS
  const floor = (
    drawRoundedRectangle(outerW, outerD, cornerRadius).sketchOnPlane('XY') as unknown as Sketch
  ).extrude(wallThickness);

  // Build corner posts (small solid columns at each corner for watertight geometry)
  const postSize = Math.max(CORNER_POST_SIZE, wallThickness + amplitude);
  const postSketch = drawRectangle(postSize, postSize).sketchOnPlane('XY') as unknown as Sketch;
  const postHeight = wallHeight;

  const halfW = outerW / 2;
  const halfD = outerD / 2;

  let body: Shape3D = floor;

  // Add corner posts
  const cornerPositions = [
    [-halfW + postSize / 2, -halfD + postSize / 2],
    [halfW - postSize / 2, -halfD + postSize / 2],
    [-halfW + postSize / 2, halfD - postSize / 2],
    [halfW - postSize / 2, halfD - postSize / 2],
  ];

  for (const [cx, cy] of cornerPositions) {
    const post = postSketch.extrude(postHeight).translate([cx, cy, 0]);
    body = body.fuse(post);
  }

  // Build each wave wall
  const buildWaveWall = (wallLength: number): Shape3D => {
    const totalCycles = frequency * (wallLength / gridSize);
    const totalSegments = Math.max(4, Math.round(totalCycles * segmentsPerWave));
    const segmentLength = wallLength / totalSegments;

    // Build 2D sine wave profile as a closed polygon
    // Outer path: sine wave offset outward
    // Inner path: sine wave offset inward
    // Then close to form a solid strip
    const outerPoints: Array<[number, number]> = [];
    const innerPoints: Array<[number, number]> = [];

    for (let i = 0; i <= totalSegments; i++) {
      const x = -wallLength / 2 + i * segmentLength;
      const t = (i / totalSegments) * totalCycles * 2 * Math.PI;
      const sineVal = Math.sin(t) * amplitude;
      outerPoints.push([x, sineVal + baseThickness / 2]);
      innerPoints.push([x, sineVal - baseThickness / 2]);
    }

    // Build closed polygon: outer path forward, inner path backward
    let sketcher = draw(outerPoints[0]);
    for (let i = 1; i < outerPoints.length; i++) {
      sketcher = sketcher.lineTo(outerPoints[i]);
    }
    // Connect to inner path (reversed)
    for (let i = innerPoints.length - 1; i >= 0; i--) {
      sketcher = sketcher.lineTo(innerPoints[i]);
    }
    const profile = sketcher.close().sketchOnPlane('XY') as unknown as Sketch;

    // Extrude upward to wall height
    return profile.extrude(postHeight);
  };

  // Front wall: along X axis at Y = -outerD/2
  const frontWall = buildWaveWall(outerW - 2 * postSize)
    .rotate(90, [0, 0, 0], [1, 0, 0]) // XY plane -> XZ plane
    .translate([0, -halfD + wallThickness / 2, wallHeight / 2]);
  body = body.fuse(frontWall);

  // Back wall: along X axis at Y = +outerD/2
  const backWall = buildWaveWall(outerW - 2 * postSize)
    .rotate(90, [0, 0, 0], [1, 0, 0])
    .translate([0, halfD - wallThickness / 2, wallHeight / 2]);
  body = body.fuse(backWall);

  // Left wall: along Y axis at X = -outerW/2
  const leftWall = buildWaveWall(outerD - 2 * postSize)
    .rotate(90, [0, 0, 0], [1, 0, 0])
    .rotate(90, [0, 0, 0], [0, 0, 1])
    .translate([-halfW + wallThickness / 2, 0, wallHeight / 2]);
  body = body.fuse(leftWall);

  // Right wall: along Y axis at X = +outerW/2
  const rightWall = buildWaveWall(outerD - 2 * postSize)
    .rotate(90, [0, 0, 0], [1, 0, 0])
    .rotate(90, [0, 0, 0], [0, 0, 1])
    .translate([halfW - wallThickness / 2, 0, wallHeight / 2]);
  body = body.fuse(rightWall);

  return body;
}
